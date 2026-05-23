"""Central tool registry (D3).

The Tool Registry Pattern — decouple tool *definitions* from tool *execution*.
Three moving parts, the same names you'll see across production systems:

    TOOLS list      JSON schemas — what the LLM reads.
                    Each entry: { name, description, input_schema }.
                    The model uses `description` to decide WHEN to call,
                    and `input_schema` to fill the arguments.

    TOOL_MAP dict   name → callable — what your code runs.
                    A pure lookup: when the model issues a tool call,
                    you index into TOOL_MAP[name](**args).

    Tool function   The pure Python function. Validates inputs, does
                    the side effect or computation, returns a result.
                    The model never sees inside it.

Each tool module (e.g. `resume_tools.py`, `comm_tools.py`) declares its own
TOOLS list and TOOL_MAP at the top, then defines the functions below.
`ToolRegistry.register_module(module)` walks both and registers every
(schema, callable) pair into the shared singleton.

Singleton — agents discover and call tools via `registry.call(name, **kwargs)`
and never import tool functions directly. The MCP client (D9) also registers
its remote tools here on connect, so agents call MCP and local tools through
exactly the same interface.
"""
from __future__ import annotations

import inspect
import threading
from dataclasses import dataclass
from types import ModuleType
from typing import Any, Callable


class ToolNotFoundError(KeyError):
    """Raised when registry.get() / call() is invoked with an unknown name."""


@dataclass
class ToolEntry:
    name: str
    func: Callable[..., Any]
    description: str
    input_schema: dict[str, Any]


class ToolRegistry:
    _instance: "ToolRegistry | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._tools: dict[str, ToolEntry] = {}

    @classmethod
    def singleton(cls) -> "ToolRegistry":
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    def register(
        self,
        name: str,
        func: Callable[..., Any],
        description: str = "",
        input_schema: dict[str, Any] | None = None,
    ) -> None:
        """Register a single tool. Prefer `register_module()` for batches."""
        if input_schema is None:
            input_schema = _infer_schema(func)
        self._tools[name] = ToolEntry(
            name=name, func=func, description=description, input_schema=input_schema
        )

    def register_module(self, module: ModuleType) -> None:
        """Register every (schema, callable) pair from a tool module.

        The module must export:
          - TOOLS:    list[dict]   — JSON schemas in Anthropic tool-use shape
          - TOOL_MAP: dict[str, Callable] — name → function

        Raises if any entry in TOOLS lacks a corresponding TOOL_MAP entry.
        """
        tools: list[dict[str, Any]] = getattr(module, "TOOLS", [])
        tool_map: dict[str, Callable[..., Any]] = getattr(module, "TOOL_MAP", {})

        for spec in tools:
            name = spec["name"]
            if name not in tool_map:
                raise KeyError(
                    f"tool '{name}' declared in TOOLS but missing from TOOL_MAP "
                    f"in module {module.__name__!r}"
                )
            self._tools[name] = ToolEntry(
                name=name,
                func=tool_map[name],
                description=spec.get("description", ""),
                input_schema=spec.get("input_schema", {}),
            )

    def get(self, name: str) -> Callable[..., Any]:
        if name not in self._tools:
            raise ToolNotFoundError(name)
        return self._tools[name].func

    def list_tools(self) -> list[dict[str, Any]]:
        """Return the canonical TOOLS-style list (what the LLM is shown)."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema,
            }
            for t in self._tools.values()
        ]

    def call(self, name: str, **kwargs: Any) -> Any:
        return self.get(name)(**kwargs)

    def clear(self) -> None:
        """Test helper — drop all registered tools."""
        self._tools.clear()


# --- Schema inference (fallback only) ------------------------------------
#
# Used by registry.register() when no input_schema is passed in. Tool
# modules in this repo all ship hand-written schemas via their TOOLS list;
# this exists for the MCP client and ad-hoc registrations that don't.

def _infer_schema(func: Callable[..., Any]) -> dict[str, Any]:
    sig = inspect.signature(func)
    return {
        "type": "object",
        "properties": {
            n: {"type": _py_to_jsonschema(p.annotation)}
            for n, p in sig.parameters.items()
        },
        "required": [
            n for n, p in sig.parameters.items() if p.default is inspect.Parameter.empty
        ],
    }


def _py_to_jsonschema(annotation: Any) -> str:
    mapping = {str: "string", int: "integer", float: "number", bool: "boolean"}
    return mapping.get(annotation, "string")
