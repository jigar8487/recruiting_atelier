"""Standalone smoke runner against a REAL LLM provider.

Bypasses the pytest FakeLLM fixture by running outside pytest. Reads creds and
provider choice from backend/.env. Prints each RunEvent as it streams so you
can watch the live pipeline.

Usage:
    cd backend && source .venv/bin/activate
    python -m tests.smoke_real_provider
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path

# Mute chromadb's posthog telemetry; must happen BEFORE any chromadb import.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

from dotenv import load_dotenv  # noqa: E402

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

# Even with ANONYMIZED_TELEMETRY=False, chromadb 0.5 + posthog mismatch still
# prints "Failed to send telemetry event …". Suppress at the logger level.
for name in ("chromadb.telemetry", "chromadb.telemetry.product.posthog",
             "chromadb", "posthog"):
    logging.getLogger(name).setLevel(logging.CRITICAL)

from production.schemas import ResumeInput, RunEvent, RunRequest  # noqa: E402
from runner import run as runner_run  # noqa: E402

DATA = BACKEND / "data"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


COLOURS = {
    "start": "\033[34m",     # blue
    "chunk": "\033[36m",     # cyan
    "complete": "\033[32m",  # green
    "error": "\033[31m",     # red
    "warning": "\033[33m",   # yellow
    "retry": "\033[35m",     # magenta
}
RESET = "\033[0m"


def pretty(ev: RunEvent) -> None:
    colour = COLOURS.get(ev.event, "")
    p = ev.payload
    if ev.stage == "screen" and ev.event == "chunk":
        ok = "PASSED" if p.get("passed") else "FAILED"
        line = f"{p.get('candidate_id'):>12s} → {ok}"
        if p.get("reason"):
            line += f"  ({p['reason']})"
    elif ev.stage == "score" and ev.event == "chunk":
        line = f"{p.get('candidate_id'):>12s} → score {p.get('score')} — {p.get('justification', '')[:80]}"
    elif ev.stage == "shortlist" and ev.event == "complete":
        cands = p.get("candidates") or []
        ids = ", ".join(f"{c['candidate_id']}({c['score']})" for c in cands)
        line = f"Shortlist [{ids}]"
    elif ev.stage == "notify" and ev.event == "complete":
        n = p.get("notify") or {}
        line = f"Email sent to {n.get('recipient')} (sent={n.get('sent')})"
    elif ev.stage == "run" and ev.event == "complete":
        summary = p.get("summary") or {}
        cost = summary.get("cost_usd", 0.0)
        line = (f"DONE — tokens in/out {summary.get('tokens_in', 0)}/"
                f"{summary.get('tokens_out', 0)}, "
                f"cost ${cost:.4f}, "
                f"latency {summary.get('latency_ms', 0)}ms, "
                f"spans {summary.get('spans', 0)}")
    elif ev.event == "error":
        line = f"ERROR: {p.get('message', json.dumps(p))[:200]}"
    else:
        line = ""
    prefix = f"[step {ev.step} {ev.stage:>10s} {ev.event:>8s}]"
    print(f"{colour}{prefix}{RESET} {line}", flush=True)


def main() -> int:
    import os

    provider = os.environ.get("LLM_CHAT_PROVIDER", "?")
    print(f"=== Smoke run via provider: {provider} ===\n")

    jd = _read(DATA / "job_descriptions" / "senior_react_developer.txt")
    resumes = [
        ResumeInput(candidate_id=f"resume_00{i}",
                    text=_read(DATA / "sample_resumes" / f"resume_00{i}.txt"))
        for i in (1, 2, 3)
    ]
    req = RunRequest(
        job_id="senior-react",
        job_description=jd,
        resumes=resumes,
        top_n=3,
    )

    t0 = time.perf_counter()
    events: list[RunEvent] = []

    def emit(ev: RunEvent) -> None:
        events.append(ev)
        pretty(ev)

    try:
        runner_run(req, emit=emit)
    except Exception as e:
        print(f"\n\033[31mRUNNER CRASHED: {e}\033[0m", file=sys.stderr)
        return 2

    elapsed = time.perf_counter() - t0
    print(f"\n=== Total wall-clock: {elapsed:.1f}s, events emitted: {len(events)} ===")

    # Quick assertions
    by_stage_event = {(e.stage, e.event): e for e in events}
    if ("run", "complete") not in by_stage_event:
        print("\033[31m✗ run.complete event missing\033[0m")
        return 1
    shortlist = events and events[-1].payload.get("shortlist")
    if not shortlist:
        print("\033[33m! no shortlist produced — check provider errors above\033[0m")
        return 1
    print(f"\033[32m✓ shortlist has {len(shortlist['candidates'])} candidate(s)\033[0m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
