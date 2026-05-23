"""Pipeline step 3 — sort scored candidates, persist top-N (D7 + D8).

No LLM call here; Python sorted() is the right tool. This is deliberate per
the requirements — agents that do not need a model should not use one.
"""
from __future__ import annotations

import logging
import time
from typing import Callable

from memory.session import Session
from memory.vector_store import vector_store
from production import observability
from production.schemas import CandidateScore, RunEvent, ScoreResult, Shortlist

log = logging.getLogger(__name__)


class ShortlisterAgent:
    def __init__(self, session: Session, run_id: str, top_n: int = 3) -> None:
        self.session = session
        self.run_id = run_id
        self.top_n = top_n

    def run(
        self,
        scored: list[ScoreResult],
        emit: Callable[[RunEvent], None] | None = None,
    ) -> Shortlist:
        t0 = time.perf_counter()
        ranked = sorted(scored, key=lambda s: s.score, reverse=True)[: self.top_n]
        candidates = [CandidateScore(candidate_id=s.candidate_id, score=s.score)
                      for s in ranked]
        shortlist = Shortlist(
            job_id=self.session.job_id or "unknown",
            candidates=candidates,
        )
        try:
            vector_store().store(shortlist.job_id, shortlist)
        except Exception as e:  # pragma: no cover
            log.warning("vector_store.store failed: %s", e)
        self.session.shortlist = shortlist

        elapsed = int((time.perf_counter() - t0) * 1000)
        observability.trace_agent_call(
            self.run_id, "shortlister",
            input={"scored": [s.model_dump() for s in scored]},
            output=shortlist.model_dump(),
            latency_ms=elapsed,
        )
        if emit:
            emit(RunEvent(
                run_id=self.run_id, step=0, stage="shortlist", event="complete",
                payload=shortlist.model_dump(),
            ))
        return shortlist
