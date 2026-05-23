"""Observability (D10).

Langfuse-backed tracing when keys are present; falls back to in-memory ring +
print() when absent. Per-run summaries are aggregated from the ring buffer.
"""
from __future__ import annotations

import contextvars
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from typing import Any

log = logging.getLogger(__name__)

# Plumbs run_id through async/thread boundaries so tool-level LLM calls (which
# don't receive run_id through the registry) can still trace into the right run.
current_run_id: contextvars.ContextVar[str] = contextvars.ContextVar(
    "current_run_id", default="untracked",
)

_RING_MAX = 1000


@dataclass
class _Span:
    run_id: str
    kind: str  # "agent" | "tool" | "llm" | "embedding"
    name: str
    input: dict[str, Any] = field(default_factory=dict)
    output: dict[str, Any] = field(default_factory=dict)
    latency_ms: int = 0
    error: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0
    ts: float = field(default_factory=time.time)


class _Tracer:
    def __init__(self) -> None:
        self.lock = Lock()
        self.ring: deque[_Span] = deque(maxlen=_RING_MAX)
        self._lf: Any = None
        self._init_langfuse()

    def _init_langfuse(self) -> None:
        pk = os.environ.get("LANGFUSE_PUBLIC_KEY")
        sk = os.environ.get("LANGFUSE_SECRET_KEY")
        if not (pk and sk):
            log.info("Langfuse keys absent — using in-memory tracing fallback.")
            return
        try:
            from langfuse import Langfuse  # type: ignore

            self._lf = Langfuse(
                public_key=pk,
                secret_key=sk,
                host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
            )
            log.info("Langfuse client initialised.")
        except Exception as e:  # pragma: no cover — diagnostic only
            log.warning("Langfuse init failed (%s) — using fallback.", e)
            self._lf = None

    def record(self, span: _Span) -> None:
        with self.lock:
            self.ring.append(span)
        if self._lf is None:
            log.debug(
                "[trace %s] %s %s %dms tokens=%d/%d cost=$%.4f",
                span.run_id, span.kind, span.name, span.latency_ms,
                span.tokens_in, span.tokens_out, span.cost_usd,
            )
            return
        try:
            self._lf.trace(
                name=span.name,
                input=span.input,
                output=span.output,
                metadata={
                    "kind": span.kind,
                    "run_id": span.run_id,
                    "tokens_in": span.tokens_in,
                    "tokens_out": span.tokens_out,
                    "cost_usd": span.cost_usd,
                    "latency_ms": span.latency_ms,
                },
                tags=[span.kind],
                session_id=span.run_id,
            )
        except Exception as e:  # pragma: no cover
            log.warning("Langfuse record failed: %s", e)


_tracer = _Tracer()


def trace_agent_call(
    run_id: str, name: str, input: Any, output: Any, latency_ms: int
) -> None:
    _tracer.record(_Span(
        run_id=run_id, kind="agent", name=name,
        input=_safe(input), output=_safe(output), latency_ms=latency_ms,
    ))


def trace_tool_call(
    run_id: str, name: str, input: Any, output: Any, latency_ms: int
) -> None:
    _tracer.record(_Span(
        run_id=run_id, kind="tool", name=name,
        input=_safe(input), output=_safe(output), latency_ms=latency_ms,
    ))


def trace_llm_call(
    run_id: str,
    provider: str,
    model: str,
    tokens_in: int,
    tokens_out: int,
    latency_ms: int,
    cost_usd: float = 0.0,
) -> None:
    _tracer.record(_Span(
        run_id=run_id, kind="llm", name=f"{provider}/{model}",
        tokens_in=tokens_in, tokens_out=tokens_out,
        latency_ms=latency_ms, cost_usd=cost_usd,
    ))


def log_error(run_id: str, name: str, exc: BaseException) -> None:
    _tracer.record(_Span(run_id=run_id, kind="agent", name=name, error=repr(exc)))
    log.error("[%s] %s: %s", run_id, name, exc, exc_info=False)


def get_run_summary(run_id: str) -> dict[str, Any]:
    with _tracer.lock:
        spans = [s for s in _tracer.ring if s.run_id == run_id]
    by_kind: dict[str, dict[str, Any]] = {}
    for s in spans:
        slot = by_kind.setdefault(s.kind, {"count": 0, "tokens_in": 0, "tokens_out": 0, "cost_usd": 0.0})
        slot["count"] += 1
        slot["tokens_in"] += s.tokens_in
        slot["tokens_out"] += s.tokens_out
        slot["cost_usd"] = round(slot["cost_usd"] + s.cost_usd, 6)
    return {
        "run_id": run_id,
        "spans": len(spans),
        "errors": sum(1 for s in spans if s.error),
        "tokens_in": sum(s.tokens_in for s in spans),
        "tokens_out": sum(s.tokens_out for s in spans),
        "cost_usd": round(sum(s.cost_usd for s in spans), 6),
        "latency_ms": sum(s.latency_ms for s in spans),
        "by_kind": by_kind,
    }


def get_run_trace(run_id: str) -> list[dict[str, Any]]:
    """Return the full span list for a run — used by /api/v1/runs/{id}/trace."""
    with _tracer.lock:
        return [_span_to_dict(s) for s in _tracer.ring if s.run_id == run_id]


def _span_to_dict(s: _Span) -> dict[str, Any]:
    return {
        "kind": s.kind,
        "name": s.name,
        "input": s.input,
        "output": s.output,
        "latency_ms": s.latency_ms,
        "tokens_in": s.tokens_in,
        "tokens_out": s.tokens_out,
        "cost_usd": s.cost_usd,
        "error": s.error,
        "ts": s.ts,
    }


def _safe(obj: Any) -> dict[str, Any]:
    """Coerce arbitrary objects to a dict for tracing without raising."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump"):
        try:
            return obj.model_dump()
        except Exception:
            pass
    return {"value": repr(obj)[:500]}
