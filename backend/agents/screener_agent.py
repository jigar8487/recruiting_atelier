"""Pipeline step 1 — minimum-qualifications check (D7)."""
from __future__ import annotations

import logging
import time
from typing import Callable

from llm import factory as llm_factory
from memory.session import Session
from production import observability
from production.guardrails import GuardrailError, with_retry
from production.schemas import ChatRequest, ResumeFields, RunEvent, ScreenResult
from rag.retriever import retrieve
from tools.registry import ToolRegistry

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a recruitment screener. Given a job description (in JD CONTEXT below) and a candidate's structured resume fields, decide whether the candidate meets the minimum qualifications.

Return a single JSON object:
  candidate_id (string — copy from input)
  passed (boolean)
  reason (string — one sentence)

Rules:
- If the resume is unclear or fields are missing, return passed=false and explain.
- Never fabricate qualifications.
- Output ONLY the JSON object."""


class ScreenerAgent:
    def __init__(self, session: Session, registry: ToolRegistry, run_id: str) -> None:
        self.session = session
        self.registry = registry
        self.run_id = run_id

    def run(
        self,
        resume_text: str,
        candidate_id: str,
        emit: Callable[[RunEvent], None] | None = None,
    ) -> ScreenResult:
        t0 = time.perf_counter()

        # 1. RAG — retrieve relevant JD chunks for context.
        query = f"minimum qualifications for {self.session.job_id or 'this role'}"
        chunks = retrieve(query, k=3)

        # 2. Parse the resume via the tool registry (D3 contract).
        fields: ResumeFields = self.registry.call(
            "parse_resume", resume_text=resume_text, candidate_id=candidate_id
        )
        self.session.candidates.append(fields)

        # 3. Build the prompt; inject chunks into the SYSTEM prompt.
        sys_prompt = SYSTEM_PROMPT
        if chunks:
            sys_prompt += "\n\nJD CONTEXT:\n" + "\n---\n".join(chunks)
        user_payload = {
            "candidate_id": fields.candidate_id,
            "fields": fields.model_dump(exclude={"raw_text"}),
            "job_description": self.session.job_description,
        }
        req = ChatRequest(
            system=sys_prompt,
            user=str_dumps(user_payload),
            temperature=0.0,
            max_tokens=256,
        )

        # 4. LLM with guardrails.
        try:
            result: ScreenResult = with_retry(
                llm_factory.traced_chat, ScreenResult, self.run_id, req
            )
            # The model may have echoed wrong candidate_id; force the real one.
            result.candidate_id = fields.candidate_id
        except GuardrailError as e:
            log.error("screener guardrail failed for %s: %s", candidate_id, e)
            result = ScreenResult(
                candidate_id=fields.candidate_id, passed=False,
                reason="model output was malformed after retries",
            )

        self.session.screen_results.append(result)
        elapsed = int((time.perf_counter() - t0) * 1000)
        observability.trace_agent_call(
            self.run_id, "screener",
            input={"candidate_id": candidate_id},
            output=result.model_dump(),
            latency_ms=elapsed,
        )
        if emit:
            emit(RunEvent(
                run_id=self.run_id, step=0, stage="screen", event="chunk",
                payload=result.model_dump(),
            ))
        return result


def str_dumps(obj) -> str:
    import json

    return json.dumps(obj, default=str)
