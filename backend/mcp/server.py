"""MCP server (D9) — FastAPI JSON-RPC over HTTP.

Exposes three HR tools as JSON-RPC. All implementations are mocked but return
realistic shapes. Runs on MCP_PORT (default 8000) — separate process from the
main HTTP API on API_PORT (default 8001).

Run with:    python -m mcp.server
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Tool implementations (mocked)
# ---------------------------------------------------------------------------


def _ats_query(job_id: str) -> dict[str, Any]:
    """Mocked ATS lookup — returns fake candidate records."""
    return {
        "job_id": job_id,
        "candidates": [
            {"id": "ats_001", "name": "Alex Smith", "stage": "applied"},
            {"id": "ats_002", "name": "Jamie Doe", "stage": "screened"},
        ],
    }


def _calendar_book(candidate_id: str, slot: str) -> dict[str, Any]:
    """Mocked calendar booking."""
    return {
        "booked": True,
        "candidate_id": candidate_id,
        "slot": slot,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def _email_send(recipient: str, subject: str, body: str) -> dict[str, Any]:
    """Mocked email — logs only."""
    log.info("[MCP email_send] to=%s subject=%s body_chars=%d",
             recipient, subject, len(body))
    return {
        "sent": True,
        "recipient": recipient,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


TOOLS = {
    "ats_query": {
        "fn": _ats_query,
        "description": "Look up candidate records in the (mocked) ATS for a job.",
        "input_schema": {
            "type": "object",
            "properties": {"job_id": {"type": "string"}},
            "required": ["job_id"],
        },
    },
    "calendar_book": {
        "fn": _calendar_book,
        "description": "Book an interview slot (mocked).",
        "input_schema": {
            "type": "object",
            "properties": {
                "candidate_id": {"type": "string"},
                "slot": {"type": "string"},
            },
            "required": ["candidate_id", "slot"],
        },
    },
    "email_send": {
        "fn": _email_send,
        "description": "Send an outbound email (mocked).",
        "input_schema": {
            "type": "object",
            "properties": {
                "recipient": {"type": "string"},
                "subject": {"type": "string"},
                "body": {"type": "string"},
            },
            "required": ["recipient", "subject", "body"],
        },
    },
}


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------


class ToolCallRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any]


def create_mcp_app() -> FastAPI:
    app = FastAPI(title="HR MCP Server")

    @app.get("/healthz")
    def healthz() -> dict[str, Any]:
        return {"status": "ok", "tools": list(TOOLS.keys())}

    @app.post("/tools/list")
    def list_tools() -> list[dict[str, Any]]:
        return [
            {"name": name, "description": t["description"], "input_schema": t["input_schema"]}
            for name, t in TOOLS.items()
        ]

    @app.post("/tools/call")
    def call_tool(req: ToolCallRequest) -> dict[str, Any]:
        log.info("[MCP tools/call] %s ts=%s",
                 req.tool_name, datetime.now(timezone.utc).isoformat())
        if req.tool_name not in TOOLS:
            raise HTTPException(status_code=404, detail=f"unknown tool: {req.tool_name}")
        try:
            return TOOLS[req.tool_name]["fn"](**req.arguments)
        except TypeError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return app


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    port = int(os.environ.get("MCP_PORT", 8000))
    log.info("Starting MCP server on http://localhost:%d", port)
    uvicorn.run(create_mcp_app(), host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
