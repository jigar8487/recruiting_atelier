"""Top-level ReAct loop (D1).

Called by the HTTP API for every `RunRequest`. Pushes `RunEvent` items into a
caller-supplied emit() so the API can stream them over SSE.

Loop pattern: Think → Act → (workers emit chunks) → Observe → Exit
"""
from __future__ import annotations

import logging
import os
import time
import uuid
from typing import Callable

from agents.supervisor_agent import SupervisorAgent
from memory.session import Session
from production import observability
from production.demo_config_store import get_config as get_demo_config
from production.observability import current_run_id
from production.schemas import RunEvent, RunRequest
from tools import comm_tools, resume_tools, vet_tools
from tools.registry import ToolRegistry

log = logging.getLogger(__name__)


def register_local_tools(registry: ToolRegistry) -> None:
    """Register the local tool modules into the singleton registry."""
    names = {t["name"] for t in registry.list_tools()}
    if "parse_resume" not in names:
        resume_tools.register_into(registry)
    if "send_email" not in names:
        comm_tools.register_into(registry)
    if "check_duplicate_resume" not in names:
        vet_tools.register_into(registry)


def run(req: RunRequest, emit: Callable[[RunEvent], None]) -> str:
    """Execute one full recruitment run. Returns the run_id."""
    run_id = uuid.uuid4().hex
    ctx_token = current_run_id.set(run_id)
    try:
        return _run_inner(run_id, req, emit)
    finally:
        current_run_id.reset(ctx_token)


def _run_inner(run_id: str, req: RunRequest, emit: Callable[[RunEvent], None]) -> str:
    max_iter = int(os.environ.get("MAX_ITERATIONS", req.max_iterations))
    demo_delay = float(get_demo_config().delay_seconds)
    t0 = time.perf_counter()
    session = Session.new(job_id=req.job_id, job_description=req.job_description)
    registry = ToolRegistry.singleton()
    register_local_tools(registry)

    # Optional: connect to MCP. If MCP isn't running, log + continue — its
    # tools aren't required for the canonical 4-stage flow.
    try:
        from mcp.client import MCPClient

        MCPClient.connect_default(registry)
    except Exception as e:
        log.info("MCP not connected (%s) — proceeding without remote tools.", e)

    supervisor = SupervisorAgent(
        session, registry, run_id, top_n=req.top_n, recipient=req.recipient,
    )

    resumes = [(r.candidate_id, r.text) for r in req.resumes]

    # --- Kavya the Vetter — preflight duplicate detection ---------------
    # Runs BEFORE Meera plans, so the rest of the pipeline never sees a
    # duplicate. Each resume gets a vet.chunk event; duplicates are filtered.
    resumes = _vet_resumes(resumes, run_id, registry, emit, demo_delay)

    if demo_delay > 0:
        # Pause after Kavya so the audience sees vet → complete before the
        # main loop begins its first think.
        time.sleep(demo_delay)

    iteration = 0
    while iteration < max_iter:
        iteration += 1
        emit(RunEvent(
            run_id=run_id, step=iteration, stage="think", event="start",
        ))
        step = supervisor.think()
        if step is None:
            break
        # Demo pacing — pause between stages so the audience can read each
        # Awaiting → In hand → Set transition before the next agent runs.
        if demo_delay > 0 and iteration > 1:
            time.sleep(demo_delay)
        try:
            supervisor.act(step, resumes=resumes, emit=lambda ev: _restamp(ev, iteration, emit))
        except Exception as e:
            observability.log_error(run_id, f"supervisor.act[{step.stage}]", e)
            emit(RunEvent(
                run_id=run_id, step=iteration, stage=step.stage, event="error",
                payload={"code": "internal", "message": str(e)},
            ))
            break

        if session.shortlist is not None and step.stage == "notify":
            break  # all four stages done

    elapsed = int((time.perf_counter() - t0) * 1000)
    summary = observability.get_run_summary(run_id)
    summary["latency_ms"] = elapsed
    emit(RunEvent(
        run_id=run_id, step=iteration, stage="run", event="complete",
        payload={
            "shortlist": session.shortlist.model_dump() if session.shortlist else None,
            "summary": summary,
        },
    ))
    return run_id


def _vet_resumes(
    resumes: list[tuple[str, str]],
    run_id: str,
    registry: ToolRegistry,
    emit: Callable[[RunEvent], None],
    demo_delay: float = 0.0,
) -> list[tuple[str, str]]:
    """Run each resume through Kavya the Vetter — drop duplicates.

    Emits one `vet.chunk` per resume with the DedupResult payload, then a
    `vet.complete` with summary counts. The filtered list is what Meera
    plans against. In demo mode, sleeps a fraction of demo_delay between
    candidates so each chunk is visually distinct.
    """
    emit(RunEvent(
        run_id=run_id, step=0, stage="vet", event="start",
        payload={"count": len(resumes)},
    ))
    # Small per-candidate pause inside the vet step — Kavya runs locally
    # (no LLM call) so without this her chunks fire too fast to read.
    per_candidate_delay = min(demo_delay / 2.0, 2.0) if demo_delay > 0 else 0.0
    kept: list[tuple[str, str]] = []
    duplicates = 0
    for idx, (cid, text) in enumerate(resumes):
        if per_candidate_delay > 0 and idx > 0:
            time.sleep(per_candidate_delay)
        try:
            result = registry.call(
                "check_duplicate_resume",
                resume_text=text,
                candidate_id=cid,
                record=True,
            )
            payload = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        except Exception as e:
            log.warning("vetter failed for %s: %s — treating as unique", cid, e)
            payload = {
                "candidate_id": cid,
                "is_duplicate": False,
                "matched_id": None,
                "matched_when": None,
                "reason": f"vetter error: {e}",
            }
        emit(RunEvent(
            run_id=run_id, step=0, stage="vet", event="chunk", payload=payload,
        ))
        if payload.get("is_duplicate"):
            duplicates += 1
        else:
            kept.append((cid, text))

    emit(RunEvent(
        run_id=run_id, step=0, stage="vet", event="complete",
        payload={
            "submitted": len(resumes),
            "unique": len(kept),
            "duplicates": duplicates,
        },
    ))
    return kept


def _restamp(ev: RunEvent, step: int, emit: Callable[[RunEvent], None]) -> None:
    """Workers emit with step=0; the runner stamps in the real iteration #."""
    ev.step = step
    emit(ev)
