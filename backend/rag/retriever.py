"""RAG retrieval over the in-memory KB (D6).

Top-K chunk retrieval. Callers MUST inject the returned strings into the
agent's SYSTEM prompt — never into the user message.
"""
from __future__ import annotations

import logging

from llm import factory as llm_factory
from production.schemas import EmbeddingRequest

from .knowledge_base import kb

log = logging.getLogger(__name__)


def retrieve(query: str, k: int = 3) -> list[str]:
    """Return the top-K chunks most relevant to `query`."""
    store = kb()
    if store.count() == 0:
        return []
    try:
        if store.backend == "provider":
            vec = llm_factory.traced_embed(None, EmbeddingRequest(text=query)).vector
            res = store.col.query(query_embeddings=[vec], n_results=max(1, k))
        else:
            # local backend — let Chroma's bundled embedder handle the query
            res = store.col.query(query_texts=[query], n_results=max(1, k))
    except Exception as e:
        log.warning("retrieve failed: %s", e)
        return []

    docs = (res.get("documents") or [[]])[0]
    return [d for d in docs if d]
