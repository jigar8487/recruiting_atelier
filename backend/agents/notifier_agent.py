"""Pipeline step 4 — draft + send hiring-manager email (D7)."""
from __future__ import annotations

import logging
import time
from typing import Callable

from llm import factory as llm_factory
from memory.session import Session
from production import observability
from production.schemas import ChatRequest, NotifyResult, RunEvent, Shortlist
from tools.registry import ToolRegistry

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """You draft hiring-manager notification emails.

Given a shortlist JSON, produce a concise email body (plain text, 4-8 lines)
that:
- Greets the hiring manager
- Lists each shortlisted candidate by id with their score
- States the JD this shortlist is for
- Closes politely

Output ONLY the email body. No subject, no markdown, no preamble."""


class NotifierAgent:
    def __init__(self, session: Session, registry: ToolRegistry, run_id: str) -> None:
        self.session = session
        self.registry = registry
        self.run_id = run_id

    def run(
        self,
        shortlist: Shortlist,
        recipient: str = "hiring.manager@company.com",
        emit: Callable[[RunEvent], None] | None = None,
    ) -> NotifyResult:
        t0 = time.perf_counter()
        body = self._draft_body(shortlist)
        subject = f"Shortlist for {shortlist.job_id}"

        result = self.registry.call(
            "send_email", recipient=recipient, subject=subject, body=body,
        )

        notify = NotifyResult(
            sent=result.sent, recipient=result.recipient,
            timestamp=result.timestamp,
        )
        elapsed = int((time.perf_counter() - t0) * 1000)
        observability.trace_agent_call(
            self.run_id, "notifier",
            input={"job_id": shortlist.job_id, "recipient": recipient},
            output=notify.model_dump(),
            latency_ms=elapsed,
        )
        if emit:
            emit(RunEvent(
                run_id=self.run_id, step=0, stage="notify", event="complete",
                payload={"notify": notify.model_dump(),
                         "email": {"subject": subject, "body": body}},
            ))
        return notify

    def _draft_body(self, shortlist: Shortlist) -> str:
        req = ChatRequest(
            system=SYSTEM_PROMPT,
            user=shortlist.model_dump_json(),
            temperature=0.3,
            max_tokens=400,
        )
        try:
            r = llm_factory.traced_chat(self.run_id, req)
            text = r.text.strip()
            if text:
                return text
        except Exception as e:  # pragma: no cover
            log.warning("notifier llm draft failed: %s", e)

        # Fallback template if the model fails — keep the pipeline moving.
        lines = [
            f"Hello,\n\nThe following candidates have been shortlisted for {shortlist.job_id}:",
        ]
        for c in shortlist.candidates:
            lines.append(f"  - {c.candidate_id} (score {c.score})")
        lines.append("\nBest,\nThe Recruitment Agent")
        return "\n".join(lines)
