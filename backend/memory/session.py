"""Short-term per-run state (D5).

A fresh Session is constructed in runner.run() for every RunRequest and passed
by reference into every agent. Never a module-level global.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from production.schemas import (
    CandidateScore,
    ResumeFields,
    ScoreResult,
    ScreenResult,
    Shortlist,
)


@dataclass
class Session:
    job_id: str | None = None
    job_description: str = ""
    current_step: str | None = None
    candidates: list[ResumeFields] = field(default_factory=list)
    screen_results: list[ScreenResult] = field(default_factory=list)
    score_results: list[ScoreResult] = field(default_factory=list)
    shortlist: Shortlist | None = None
    tool_results: dict[str, Any] = field(default_factory=dict)

    def reset(self) -> None:
        self.job_id = None
        self.job_description = ""
        self.current_step = None
        self.candidates = []
        self.screen_results = []
        self.score_results = []
        self.shortlist = None
        self.tool_results = {}

    @classmethod
    def new(cls, job_id: str, job_description: str) -> "Session":
        s = cls()
        s.job_id = job_id
        s.job_description = job_description
        return s

    def passing_candidates(self) -> list[ResumeFields]:
        passing_ids = {r.candidate_id for r in self.screen_results if r.passed}
        return [c for c in self.candidates if c.candidate_id in passing_ids]
