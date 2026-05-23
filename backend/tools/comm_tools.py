"""Communication tools (D2).

The Tool Registry Pattern in practice — same shape as `resume_tools.py`:

  TOOLS list      — JSON schemas the LLM sees (declared first).
  TOOL_MAP dict   — name → function (declared after the implementations).
  Tool functions  — small, deterministic, idempotent.

Both tools are MOCKED — they never send real email or book a real calendar
slot. They print to the log and return a typed result. Idempotent: the same
inputs produce the same timestamp via an in-memory cache, so retries are
safe in the demo.
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from production.schemas import EmailResult, ScheduleResult

log = logging.getLogger(__name__)


# =====================================================================
# TOOLS — Tool Definitions (what the LLM sees)
# =====================================================================

TOOLS: list[dict] = [
    {
        "name": "send_email",
        "description": (
            "Send a notification email to a hiring manager or candidate. "
            "Mocked in this build — it prints to the server log and returns "
            "a typed EmailResult. Idempotent: the same (recipient, subject, "
            "body) always returns the same timestamp."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "recipient": {
                    "type": "string",
                    "description": (
                        "Destination email address, e.g. "
                        "'hiring.manager@company.com'."
                    ),
                },
                "subject": {
                    "type": "string",
                    "description": (
                        "Email subject line. Keep it concise and specific to "
                        "the recipient (e.g. mention the role)."
                    ),
                },
                "body": {
                    "type": "string",
                    "description": (
                        "Plain-text email body. Reference the shortlisted "
                        "candidates by name and include next steps."
                    ),
                },
            },
            "required": ["recipient", "subject", "body"],
        },
    },
    {
        "name": "schedule_interview",
        "description": (
            "Book an interview slot for a candidate. Mocked — does not hit a "
            "real calendar. Returns a typed ScheduleResult with the booked "
            "slot string. Idempotent on (candidate_id, date, time)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "candidate_id": {
                    "type": "string",
                    "description": (
                        "Stable candidate identifier from the screener stage."
                    ),
                },
                "date": {
                    "type": "string",
                    "description": (
                        "Interview date in ISO format (YYYY-MM-DD)."
                    ),
                },
                "time": {
                    "type": "string",
                    "description": (
                        "Interview time, 24-hour HH:MM in the recipient's "
                        "local timezone."
                    ),
                },
            },
            "required": ["candidate_id", "date", "time"],
        },
    },
]


# =====================================================================
# Tool functions (what your code actually runs)
# =====================================================================

# Stable timestamp cache keyed by content hash → idempotent retries.
_email_cache: dict[str, str] = {}
_schedule_cache: dict[str, str] = {}


def send_email(recipient: str, subject: str, body: str) -> EmailResult:
    """Mocked email. Prints to log. Idempotent."""
    key = hashlib.sha256(f"{recipient}|{subject}|{body}".encode()).hexdigest()
    ts = _email_cache.setdefault(key, _now())
    log.info("[email] to=%s subject=%s body=%d chars", recipient, subject, len(body))
    print(f"\n=== MOCKED EMAIL @ {ts} ===")
    print(f"To:      {recipient}")
    print(f"Subject: {subject}")
    print(f"---\n{body}\n=== end ===\n")
    return EmailResult(sent=True, recipient=recipient, subject=subject, timestamp=ts)


def schedule_interview(candidate_id: str, date: str, time: str) -> ScheduleResult:
    """Mocked interview booking."""
    slot = f"{date} {time}"
    key = hashlib.sha256(f"{candidate_id}|{slot}".encode()).hexdigest()
    ts = _schedule_cache.setdefault(key, _now())
    log.info("[schedule] candidate=%s slot=%s", candidate_id, slot)
    print(f"\n=== MOCKED INTERVIEW @ {ts} ===")
    print(f"Candidate: {candidate_id}")
    print(f"Slot:      {slot}")
    print("=== end ===\n")
    return ScheduleResult(booked=True, candidate_id=candidate_id, slot=slot, timestamp=ts)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# =====================================================================
# TOOL_MAP — name → function
# =====================================================================

TOOL_MAP = {
    "send_email": send_email,
    "schedule_interview": schedule_interview,
}


# =====================================================================
# Wiring into the shared registry
# =====================================================================

def register_into(registry) -> None:
    """Convenience: register every (TOOLS, TOOL_MAP) pair into the registry."""
    import sys
    registry.register_module(sys.modules[__name__])
