"""In-memory knowledge base (D6 + E1).

Uses chromadb.EphemeralClient — data lives only for the lifetime of the
backend process. Restart wipes the KB by design (per requirements).
Embeddings are produced via llm.factory.embed() so any configured provider
works.
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading
import uuid
from dataclasses import dataclass, field

from llm import factory as llm_factory
from llm.base import EmbeddingNotSupportedError
from production.schemas import EmbeddingRequest, KBDocument, UploadResult

log = logging.getLogger(__name__)

COLLECTION = "hr-knowledge-base"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50

# KB_EMBED_BACKEND controls how chunks are embedded:
#   "local"    — Chroma's bundled all-MiniLM-L6-v2 (default; offline, no key)
#   "provider" — llm_factory.embed() (uses configured embedding provider)
# Both backends pin the same model across ingest + retrieval — mixing is unsafe.
DEFAULT_BACKEND = "local"

_lock = threading.Lock()


@dataclass
class _Stats:
    bytes_in_memory: int = 0
    chunks_total: int = 0


class InMemoryKB:
    _instance: "InMemoryKB | None" = None

    def __init__(self) -> None:
        import chromadb  # type: ignore

        self.client = chromadb.EphemeralClient()
        self.backend = os.environ.get("KB_EMBED_BACKEND", DEFAULT_BACKEND).lower()
        if self.backend == "local":
            # Chroma's bundled ONNX embedder — downloads ~80MB once, then offline.
            from chromadb.utils import embedding_functions  # type: ignore

            self._embed_fn = embedding_functions.DefaultEmbeddingFunction()
            log.info("KB embed backend: local (Chroma default all-MiniLM-L6-v2)")
        else:
            self._embed_fn = None
            log.info("KB embed backend: provider (llm_factory.embed)")

        self.col = self.client.get_or_create_collection(
            name=COLLECTION,
            embedding_function=self._embed_fn,  # type: ignore[arg-type]
        )
        self.docs: dict[str, KBDocument] = {}
        self.texts: dict[str, str] = {}     # doc_id -> full original text
        self.stats = _Stats()
        self.alock = asyncio.Lock()

    @classmethod
    def get(cls) -> "InMemoryKB":
        with _lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        with _lock:
            cls._instance = None

    def ingest(
        self,
        text: str,
        filename: str,
        mime: str,
        warnings: list[str] | None = None,
    ) -> UploadResult:
        max_bytes = int(os.environ.get("KB_MAX_BYTES", 536870912))
        size = len(text.encode())
        if self.stats.bytes_in_memory + size > max_bytes:
            from production.schemas import APIErrorBody  # local import avoids cycle

            raise OverflowError(
                APIErrorBody(
                    code="kb_too_large",
                    message="In-memory KB would exceed KB_MAX_BYTES.",
                    details={"current": self.stats.bytes_in_memory, "incoming": size},
                ).model_dump_json()
            )

        doc_id = uuid.uuid4().hex
        chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
        if not chunks:
            return UploadResult(doc_id=doc_id, filename=filename, chunks=0, bytes=size,
                                warnings=warnings or ["empty document — nothing to index"])

        add_kwargs: dict = dict(
            ids=[f"{doc_id}:{i}" for i in range(len(chunks))],
            documents=chunks,
            metadatas=[{"doc_id": doc_id, "filename": filename} for _ in chunks],
        )
        if self.backend == "provider":
            # Try LLM-provider embeddings. If unsupported, fail loudly so the
            # user can switch backends (we don't silently mix vector spaces).
            try:
                add_kwargs["embeddings"] = [
                    llm_factory.traced_embed(None, EmbeddingRequest(text=c)).vector
                    for c in chunks
                ]
            except EmbeddingNotSupportedError as e:
                raise RuntimeError(
                    f"KB_EMBED_BACKEND=provider but the configured embed "
                    f"provider does not support embeddings ({e}). "
                    f"Set KB_EMBED_BACKEND=local in backend/.env."
                ) from e
        # else: backend == "local" — Chroma computes embeddings from documents.

        self.col.add(**add_kwargs)

        with _lock:
            self.docs[doc_id] = KBDocument(
                id=doc_id, filename=filename, mime=mime,
                chunks=len(chunks), bytes=size,
            )
            self.texts[doc_id] = text
            self.stats.bytes_in_memory += size
            self.stats.chunks_total += len(chunks)

        log.info("KB ingest doc=%s file=%s chunks=%d bytes=%d",
                 doc_id, filename, len(chunks), size)
        return UploadResult(
            doc_id=doc_id, filename=filename, chunks=len(chunks),
            bytes=size, warnings=warnings or [],
        )

    def update_text(
        self,
        doc_id: str,
        text: str,
        filename: str | None = None,
    ) -> UploadResult | None:
        """Replace a doc's text in place: delete old chunks, re-chunk & re-embed.

        Returns None if doc_id is unknown. The doc_id is preserved so the
        frontend doesn't have to re-fetch the list after an edit.
        """
        with _lock:
            existing = self.docs.get(doc_id)
        if existing is None:
            return None

        new_filename = filename or existing.filename
        new_size = len(text.encode())
        max_bytes = int(os.environ.get("KB_MAX_BYTES", 536870912))
        # Reserve space: subtract old bytes before checking ceiling.
        projected = self.stats.bytes_in_memory - existing.bytes + new_size
        if projected > max_bytes:
            from production.schemas import APIErrorBody  # local import avoids cycle

            raise OverflowError(
                APIErrorBody(
                    code="kb_too_large",
                    message="In-memory KB would exceed KB_MAX_BYTES.",
                    details={
                        "current": self.stats.bytes_in_memory,
                        "incoming": new_size,
                    },
                ).model_dump_json()
            )

        # Drop old chunks from the vector store.
        self.col.delete(where={"doc_id": doc_id})

        chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
        if chunks:
            add_kwargs: dict = dict(
                ids=[f"{doc_id}:{i}" for i in range(len(chunks))],
                documents=chunks,
                metadatas=[
                    {"doc_id": doc_id, "filename": new_filename} for _ in chunks
                ],
            )
            if self.backend == "provider":
                try:
                    add_kwargs["embeddings"] = [
                        llm_factory.traced_embed(None, EmbeddingRequest(text=c)).vector
                        for c in chunks
                    ]
                except EmbeddingNotSupportedError as e:
                    raise RuntimeError(
                        f"KB_EMBED_BACKEND=provider but the configured embed "
                        f"provider does not support embeddings ({e}). "
                        f"Set KB_EMBED_BACKEND=local in backend/.env."
                    ) from e
            self.col.add(**add_kwargs)

        with _lock:
            self.docs[doc_id] = KBDocument(
                id=doc_id,
                filename=new_filename,
                mime=existing.mime,
                chunks=len(chunks),
                bytes=new_size,
                uploaded=existing.uploaded,
            )
            self.texts[doc_id] = text
            self.stats.bytes_in_memory += new_size - existing.bytes
            self.stats.chunks_total += len(chunks) - existing.chunks

        log.info("KB update doc=%s file=%s chunks=%d bytes=%d",
                 doc_id, new_filename, len(chunks), new_size)
        return UploadResult(
            doc_id=doc_id, filename=new_filename, chunks=len(chunks),
            bytes=new_size, warnings=[],
        )

    def remove(self, doc_id: str) -> bool:
        with _lock:
            doc = self.docs.pop(doc_id, None)
            self.texts.pop(doc_id, None)
        if doc is None:
            return False
        self.col.delete(where={"doc_id": doc_id})
        with _lock:
            self.stats.bytes_in_memory -= doc.bytes
            self.stats.chunks_total -= doc.chunks
        return True

    def list(self) -> list[KBDocument]:
        with _lock:
            # newest first — used by the UI to pick a default JD source
            return sorted(self.docs.values(), key=lambda d: d.uploaded, reverse=True)

    def count(self) -> int:
        return len(self.docs)

    def get_text(self, doc_id: str) -> str | None:
        with _lock:
            return self.texts.get(doc_id)


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Greedy character-based chunker with overlap.

    Splits long documents into ~size-character chunks that share `overlap`
    characters with their neighbours to preserve cross-boundary context.
    """
    text = text.strip()
    if not text:
        return []
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return chunks


def kb() -> InMemoryKB:
    return InMemoryKB.get()
