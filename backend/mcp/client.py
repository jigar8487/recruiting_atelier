"""MCP client (D9).

Connects to the MCP server, discovers its tools, and registers each into the
shared ToolRegistry. After connect(), agents can call MCP tools through the
same registry.call(name, **kwargs) interface as local tools.
"""
from __future__ import annotations

import logging
import os
from functools import partial
from typing import Any

import httpx

from tools.registry import ToolRegistry

log = logging.getLogger(__name__)


class MCPConnectionError(RuntimeError):
    pass


class MCPClient:
    def __init__(self, url: str, timeout_s: float = 5.0) -> None:
        self.url = url.rstrip("/")
        self.timeout_s = timeout_s
        self._client = httpx.Client(timeout=timeout_s)

    @classmethod
    def connect_default(cls, registry: ToolRegistry) -> "MCPClient":
        port = int(os.environ.get("MCP_PORT", 1813))
        url = os.environ.get("MCP_SERVER_URL") or f"http://localhost:{port}"
        return cls(url).connect(registry)

    def connect(self, registry: ToolRegistry) -> "MCPClient":
        try:
            r = self._client.post(f"{self.url}/tools/list")
            r.raise_for_status()
        except (httpx.HTTPError, OSError) as e:
            raise MCPConnectionError(f"MCP server unreachable at {self.url}: {e}") from e

        tools: list[dict[str, Any]] = r.json()
        for t in tools:
            registry.register(
                t["name"],
                partial(self.call_tool, t["name"]),
                description=t.get("description", ""),
                input_schema=t.get("input_schema", {}),
            )
        log.info("MCP connected — registered %d tools: %s",
                 len(tools), [t["name"] for t in tools])
        return self

    def list_tools(self) -> list[dict[str, Any]]:
        return self._client.post(f"{self.url}/tools/list").json()

    def call_tool(self, name: str, **kwargs: Any) -> dict[str, Any]:
        r = self._client.post(
            f"{self.url}/tools/call",
            json={"tool_name": name, "arguments": kwargs},
        )
        if r.status_code >= 400:
            raise RuntimeError(f"MCP tool '{name}' failed: {r.text}")
        return r.json()
