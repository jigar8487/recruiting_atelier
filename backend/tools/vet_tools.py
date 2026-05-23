"""Vetting tools — duplicate-resume detection (D2 extension).

Kavya the Vetter calls these BEFORE Meera plans the rest of the pipeline.
The point is to catch the same CV being uploaded twice (within a run or
across runs) so the agent doesn't waste tokens re-scoring it.

Same shape as the rest of the tool modules:
  TOOLS list      — JSON schema the LLM sees (advertised in /tools).
  Tool functions  — pure Python that does the real work.
  TOOL_MAP dict   — name → function.

Detection strategy:
  1. Normalize the resume text (lowercase, collapse whitespace).
  2. SHA-256 of the normalized text → the content key.
  3. Also extract an email address if one is present → the secondary key.
  4. Check both keys against a persistent JSON store; either hit ⇒ duplicate.
  5. Otherwise record both keys with this candidate's id + timestamp.

Persistence lives at SEEN_RESUMES_PATH (default ./.seen-resumes.json) so
the system can flag duplicates across backend restarts.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path

from production.schemas import DedupResult

log = logging.getLogger(__name__)

_DEFAULT_PATH = "./.seen-resumes.json"
_lock = threading.Lock()
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")


# =====================================================================
# TOOLS — Tool Definitions (what the LLM sees)
# =====================================================================

TOOLS: list[dict] = [
    {
        "name": "check_duplicate_resume",
        "description": (
            "Check whether a candidate's resume has been seen before — either "
            "earlier in this run or in any past run on this backend. Returns a "
            "DedupResult with is_duplicate, the matched prior candidate_id (if "
            "any), and the timestamp of that prior scan. Kavya the Vetter "
            "calls this BEFORE Anaya screens, so the rest of the pipeline "
            "can skip duplicates instead of re-parsing and re-scoring them."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resume_text": {
                    "type": "string",
                    "description": (
                        "Full plain-text resume content. Normalisation "
                        "(lowercase + whitespace collapse) is applied "
                        "internally before hashing."
                    ),
                },
                "candidate_id": {
                    "type": "string",
                    "description": (
                        "Stable id for the candidate (e.g. file stem). "
                        "Recorded against the content hash on first sight."
                    ),
                },
                "record": {
                    "type": "boolean",
                    "description": (
                        "If true (default), record the new resume after "
                        "checking. Set false for a read-only check."
                    ),
                },
            },
            "required": ["resume_text", "candidate_id"],
        },
    },
]


# =====================================================================
# Tool function
# =====================================================================

def check_duplicate_resume(
    resume_text: str,
    candidate_id: str,
    record: bool = True,
) -> DedupResult:
    """Return a DedupResult; optionally record this resume for future runs."""
    content_key = _content_hash(resume_text)
    email = _extract_email(resume_text)

    seen = _load()
    prior_by_content = seen.get("by_content", {}).get(content_key)
    prior_by_email = seen.get("by_email", {}).get(email) if email else None
    prior = prior_by_content or prior_by_email

    if prior is not None:
        reason_bits: list[str] = []
        if prior_by_content:
            reason_bits.append("identical content (sha-256 match)")
        elif prior_by_email:
            reason_bits.append(f"same email: {email}")
        return DedupResult(
            candidate_id=candidate_id,
            is_duplicate=True,
            matched_id=prior["candidate_id"],
            matched_when=prior["when"],
            reason="; ".join(reason_bits),
        )

    if record:
        _record(content_key, email, candidate_id)

    return DedupResult(
        candidate_id=candidate_id,
        is_duplicate=False,
        reason="first sighting",
    )


# =====================================================================
# TOOL_MAP — name → function
# =====================================================================

TOOL_MAP = {
    "check_duplicate_resume": check_duplicate_resume,
}


def register_into(registry) -> None:
    """Convenience: register every (TOOLS, TOOL_MAP) pair into the registry."""
    import sys
    registry.register_module(sys.modules[__name__])


# =====================================================================
# Helpers
# =====================================================================

def _path() -> Path:
    return Path(os.environ.get("SEEN_RESUMES_PATH", _DEFAULT_PATH))


def _content_hash(text: str) -> str:
    norm = re.sub(r"\s+", " ", text.lower()).strip()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def _extract_email(text: str) -> str | None:
    m = _EMAIL_RE.search(text)
    return m.group(0).lower() if m else None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load() -> dict:
    with _lock:
        p = _path()
        if not p.exists():
            return {"by_content": {}, "by_email": {}}
        try:
            data = json.loads(p.read_text())
            data.setdefault("by_content", {})
            data.setdefault("by_email", {})
            return data
        except (ValueError, OSError) as e:
            log.warning("seen-resumes store at %s unreadable (%s); resetting", p, e)
            return {"by_content": {}, "by_email": {}}


def _record(content_key: str, email: str | None, candidate_id: str) -> None:
    with _lock:
        p = _path()
        try:
            data = json.loads(p.read_text()) if p.exists() else {}
        except (ValueError, OSError):
            data = {}
        data.setdefault("by_content", {})
        data.setdefault("by_email", {})
        entry = {"candidate_id": candidate_id, "when": _now()}
        data["by_content"][content_key] = entry
        if email:
            data["by_email"][email] = entry
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))


def reset() -> None:
    """Test helper — drop the on-disk store."""
    with _lock:
        p = _path()
        if p.exists():
            p.unlink()
