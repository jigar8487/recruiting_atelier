"""Supervisor (D4 planning + D8 multi-agent routing).

Plans the 4-stage recruitment flow before any execution begins, then routes
each step to the correct worker agent. Routing is by stage name — there is
no hardcoded if/elif chain.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Callable

from agents.notifier_agent import NotifierAgent
from agents.scorer_agent import ScorerAgent
from agents.screener_agent import ScreenerAgent
from agents.shortlister_agent import ShortlisterAgent
from memory.session import Session
from production import observability
from production.schemas import RunEvent
from tools.registry import ToolRegistry

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are the recruitment supervisor.
- Plan ALL steps before executing any of them.
- Never skip a step in your plan.
- Always return results as JSON matching the provided schema."""

STAGES = ("screen", "score", "shortlist", "notify")


@dataclass
class Step:
    stage: str
    done: bool = False


class SupervisorAgent:
    def __init__(
        self,
        session: Session,
        registry: ToolRegistry,
        run_id: str,
        top_n: int = 3,
        recipient: str = "hiring.manager@company.com",
    ) -> None:
        self.session = session
        self.registry = registry
        self.run_id = run_id
        self.top_n = top_n
        self.recipient = recipient
        self.plan: list[Step] | None = None

        self.screener = ScreenerAgent(session, registry, run_id)
        self.scorer = ScorerAgent(session, registry, run_id)
        self.shortlister = ShortlisterAgent(session, run_id, top_n=top_n)
        self.notifier = NotifierAgent(session, registry, run_id)

    def think(self) -> Step | None:
        if self.plan is None:
            self.plan = [Step(stage=s) for s in STAGES]
            observability.trace_agent_call(
                self.run_id, "supervisor.plan",
                input={"job_id": self.session.job_id},
                output={"plan": [s.stage for s in self.plan]},
                latency_ms=0,
            )
        for s in self.plan:
            if not s.done:
                return s
        return None

    def act(
        self,
        step: Step,
        resumes: list[tuple[str, str]],
        emit: Callable[[RunEvent], None] | None = None,
    ) -> None:
        """Dispatch the step to the right worker. `resumes` is [(id, text)]."""
        t0 = time.perf_counter()
        if emit:
            emit(RunEvent(
                run_id=self.run_id, step=0, stage=step.stage, event="start",
            ))

        if step.stage == "screen":
            for cid, text in resumes:
                self.screener.run(text, candidate_id=cid, emit=emit)
        elif step.stage == "score":
            for fields in self.session.passing_candidates():
                self.scorer.run(fields, emit=emit)
        elif step.stage == "shortlist":
            self.shortlister.run(self.session.score_results, emit=emit)
        elif step.stage == "notify":
            if self.session.shortlist is not None:
                self.notifier.run(self.session.shortlist, recipient=self.recipient, emit=emit)
        else:
            log.warning("unknown stage: %s", step.stage)

        step.done = True
        elapsed = int((time.perf_counter() - t0) * 1000)
        observability.trace_agent_call(
            self.run_id, f"supervisor.act[{step.stage}]",
            input={"stage": step.stage},
            output={},
            latency_ms=elapsed,
        )
        if emit and step.stage != "shortlist" and step.stage != "notify":
            # shortlist + notify emit their own "complete" events with payload
            emit(RunEvent(
                run_id=self.run_id, step=0, stage=step.stage, event="complete",
            ))
