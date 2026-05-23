"""Long-term shortlist memory (D5).

Persistent Chroma at SHORTLIST_CHROMA_PATH. Survives backend restarts —
the KB does not (by design); shortlists do.
"""
from __future__ import annotations

import logging
import os
import threading
import uuid

from llm import factory as llm_factory
from production.schemas import EmbeddingRequest, Shortlist

log = logging.getLogger(__name__)

COLLECTION = "hr-shortlists"
_lock = threading.Lock()


class VectorStore:
    _instance: "VectorStore | None" = None

    def __init__(self) -> None:
        import chromadb  # type: ignore

        path = os.environ.get("SHORTLIST_CHROMA_PATH", "./.chroma-shortlists")
        self.client = chromadb.PersistentClient(path=path)
        self.col = self.client.get_or_create_collection(
            name=COLLECTION,
            embedding_function=None,  # type: ignore[arg-type]
        )

    @classmethod
    def get(cls) -> "VectorStore":
        with _lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    def store(self, job_id: str, shortlist: Shortlist) -> None:
        """Embed the shortlist's JSON form and persist it."""
        body = shortlist.model_dump_json()
        try:
            vec = llm_factory.traced_embed(None, EmbeddingRequest(text=body)).vector
        except Exception as e:
            log.warning("embed failed during store: %s", e)
            # Persist without embedding — retrieval by job_id still works.
            vec = [0.0] * 32
        self.col.add(
            ids=[uuid.uuid4().hex],
            embeddings=[vec],
            documents=[body],
            metadatas=[{"job_id": job_id, "created": shortlist.created}],
        )
        log.info("stored shortlist job=%s candidates=%d", job_id, len(shortlist.candidates))

    def retrieve(self, job_id: str) -> list[Shortlist]:
        res = self.col.get(where={"job_id": job_id})
        docs = res.get("documents") or []
        out: list[Shortlist] = []
        for d in docs:
            try:
                out.append(Shortlist.model_validate_json(d))
            except Exception as e:  # pragma: no cover
                log.warning("bad shortlist doc skipped: %s", e)
        out.sort(key=lambda s: s.created, reverse=True)
        return out


def vector_store() -> VectorStore:
    return VectorStore.get()
