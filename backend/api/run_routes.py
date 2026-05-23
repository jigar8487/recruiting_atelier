"""Run lifecycle + SSE streaming (E1)."""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from api.errors import APIException
from production import observability
from production.schemas import RunEvent, RunRequest
from runner import run as runner_run

log = logging.getLogger(__name__)
router = APIRouter()


class _RunQueue:
    """Per-run async queue. Bridges the sync runner thread → SSE event loop."""

    def __init__(self) -> None:
        self.queue: asyncio.Queue[RunEvent | None] = asyncio.Queue()
        self.run_id: str | None = None
        self.done = False


_runs: dict[str, _RunQueue] = {}


@router.post("")
async def start_run(req: RunRequest) -> dict[str, Any]:
    """Kick off a recruitment run; return its id so the client can stream it."""
    run_id = uuid.uuid4().hex
    q = _RunQueue()
    q.run_id = run_id
    _runs[run_id] = q

    loop = asyncio.get_running_loop()

    def emit(ev: RunEvent) -> None:
        # Override the runner's internal id with our externally-issued one.
        ev.run_id = run_id
        asyncio.run_coroutine_threadsafe(q.queue.put(ev), loop)

    async def _run_in_thread() -> None:
        try:
            await asyncio.to_thread(runner_run, req, emit)
        except Exception as e:
            log.exception("runner crashed")
            emit(RunEvent(
                run_id=run_id, step=0, stage="run", event="error",
                payload={"code": "internal", "message": repr(e)},
            ))
        finally:
            q.done = True
            await q.queue.put(None)  # sentinel — closes the SSE stream
            # garbage-collect after a delay so clients can reconnect
            asyncio.create_task(_gc_run(run_id, delay=60))

    asyncio.create_task(_run_in_thread())
    return {"run_id": run_id}


@router.get("/{run_id}/stream")
async def stream_run(run_id: str, request: Request) -> StreamingResponse:
    if run_id not in _runs:
        raise APIException("not_found", f"unknown run_id: {run_id}", status_code=404)
    q = _runs[run_id]

    async def gen():
        try:
            while True:
                if await request.is_disconnected():
                    log.info("client disconnected from run %s", run_id)
                    break
                try:
                    ev = await asyncio.wait_for(q.queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # keepalive comment line per SSE spec
                    yield ": keepalive\n\n"
                    continue
                if ev is None:
                    yield "event: end\ndata: {}\n\n"
                    break
                yield f"data: {ev.model_dump_json()}\n\n"
                if ev.stage == "run" and ev.event in ("complete", "error"):
                    # let one final keepalive flush, then end
                    yield "event: end\ndata: {}\n\n"
                    break
        finally:
            log.info("SSE generator closed for run %s", run_id)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{run_id}/trace")
def get_trace(run_id: str) -> dict[str, Any]:
    return {"run_id": run_id, "spans": observability.get_run_trace(run_id)}


@router.get("/{run_id}/summary")
def get_summary(run_id: str) -> dict[str, Any]:
    return observability.get_run_summary(run_id)


async def _gc_run(run_id: str, delay: int) -> None:
    await asyncio.sleep(delay)
    _runs.pop(run_id, None)
