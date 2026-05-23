"""Tool registry inspection.

Exposes the live tool registry so the UI can show what's discoverable to
the agents. Eagerly registers local tools (idempotent) and best-effort
connects MCP so its remote tools show up too.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter

from tools import comm_tools, resume_tools, vet_tools
from tools.registry import ToolRegistry

log = logging.getLogger(__name__)

router = APIRouter()

LOCAL_NAMES = {
    "parse_resume",
    "score_candidate",
    "send_email",
    "schedule_interview",
    "check_duplicate_resume",
}


def _ensure_registered(registry: ToolRegistry) -> None:
    names = {t["name"] for t in registry.list_tools()}
    if "parse_resume" not in names:
        resume_tools.register_into(registry)
    if "send_email" not in names:
        comm_tools.register_into(registry)
    if "check_duplicate_resume" not in names:
        vet_tools.register_into(registry)
    # Optional: MCP remote tools. Failure is fine — the page just shows fewer.
    try:
        from mcp.client import MCPClient  # local import to avoid cycles

        MCPClient.connect_default(registry)
    except Exception as e:  # pragma: no cover
        log.info("MCP not connected for /tools/list (%s)", e)


@router.get("/list")
def list_tools() -> list[dict[str, Any]]:
    """Return every registered tool with its schema and origin."""
    registry = ToolRegistry.singleton()
    _ensure_registered(registry)
    out: list[dict[str, Any]] = []
    for t in registry.list_tools():
        out.append(
            {
                "name": t["name"],
                "description": t["description"] or "",
                "input_schema": t["input_schema"],
                "source": "local" if t["name"] in LOCAL_NAMES else "mcp",
            }
        )
    out.sort(key=lambda r: (r["source"] != "local", r["name"]))
    return out
