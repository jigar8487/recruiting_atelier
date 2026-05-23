"""Pipeline step 2 — deterministic 0-100 scoring (D7).

temperature=0 always. Same inputs ⇒ same score.
"""
from __future__ import annotations

import logging
import time
from typing import Callable

from llm import factory as llm_factory
from memory.session import Session
from production import observability
from production.guardrails import GuardrailError, with_retry
from production.schemas import (
    ChatRequest,
    ResumeFields,
    RunEvent,
    ScoreBreakdown,
    ScoreResult,
    ScoringConfig,
)
from production.scoring_config_store import get_config as get_scoring_config
from rag.retriever import retrieve
from tools.registry import ToolRegistry

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an HR scorer. Score the candidate against the JD on FOUR independent dimensions, each 0-100, using this exact rubric per dimension:
  80-100: strong match
  60-79:  good match
  40-59:  partial match
  0-39:   weak match

The four dimensions:
  skills        — coverage of technical / role-specific skills the JD requires
  experience    — years and seniority relative to what the JD requires
  education     — degree level + field relevance (0 if irrelevant; do not penalize unless JD explicitly requires)
  communication — written quality of the resume itself: clarity, structure, evidence of impact

Return a single JSON object:
  candidate_id (string)
  breakdown (object) with keys: skills, experience, education, communication (each integer 0-100)
  score (integer 0-100) — your overall estimate; the system also computes a weighted overall in Python
  justification (string, max 200 chars)

Rules:
- Be deterministic: same inputs must produce the same scores.
- Do not invent rubric criteria.
- Output ONLY the JSON object. No prose, no markdown fences."""


class ScorerAgent:
    def __init__(self, session: Session, registry: ToolRegistry, run_id: str) -> None:
        self.session = session
        self.registry = registry
        self.run_id = run_id

    def run(
        self,
        fields: ResumeFields,
        emit: Callable[[RunEvent], None] | None = None,
    ) -> ScoreResult:
        t0 = time.perf_counter()
        chunks = retrieve(
            f"scoring criteria for {self.session.job_id or 'this role'}", k=3
        )
        sys_prompt = SYSTEM_PROMPT
        if chunks:
            sys_prompt += "\n\nJD CONTEXT:\n" + "\n---\n".join(chunks)

        user_payload = {
            "candidate_id": fields.candidate_id,
            "fields": fields.model_dump(exclude={"raw_text"}),
            "resume_text": fields.raw_text,
            "job_description": self.session.job_description,
        }
        req = ChatRequest(
            system=sys_prompt,
            user=str_dumps(user_payload),
            temperature=0.0,  # determinism (requirements §5.2)
            max_tokens=256,
        )

        try:
            result: ScoreResult = with_retry(
                llm_factory.traced_chat, ScoreResult, self.run_id, req
            )
            result.candidate_id = fields.candidate_id
            # If the LLM produced a per-dimension breakdown, compute the
            # weighted overall ourselves using the user-set config. That keeps
            # the math auditable and the score deterministic for given inputs
            # + a given config.
            if result.breakdown is not None:
                cfg = get_scoring_config()
                result.score = _weighted_overall(result.breakdown, cfg)
            else:
                result.score = max(0, min(100, int(result.score)))
        except GuardrailError as e:
            log.error("scorer guardrail failed for %s: %s", fields.candidate_id, e)
            result = ScoreResult(
                candidate_id=fields.candidate_id, score=0,
                justification="model output was malformed after retries",
            )

        self.session.score_results.append(result)
        elapsed = int((time.perf_counter() - t0) * 1000)
        observability.trace_agent_call(
            self.run_id, "scorer",
            input={"candidate_id": fields.candidate_id},
            output=result.model_dump(),
            latency_ms=elapsed,
        )
        if emit:
            emit(RunEvent(
                run_id=self.run_id, step=0, stage="score", event="chunk",
                payload=result.model_dump(),
            ))
        return result


def _weighted_overall(b: ScoreBreakdown, cfg: ScoringConfig) -> int:
    """Compute the weighted overall 0-100. Normalises by the sum of weights
    so the result is well-behaved even if weights don't sum to 1."""
    w = [cfg.weight_skills, cfg.weight_experience, cfg.weight_education, cfg.weight_communication]
    s = [b.skills, b.experience, b.education, b.communication]
    total_w = sum(w)
    if total_w <= 0:
        return 0
    overall = sum(wi * si for wi, si in zip(w, s)) / total_w
    return max(0, min(100, int(round(overall))))


def str_dumps(obj) -> str:
    import json

    return json.dumps(obj, default=str)
