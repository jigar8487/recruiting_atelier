"""Shared pytest fixtures.

Forces the FakeLLMProvider for every test so we can run offline + deterministic
without consuming real API quota.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Make backend/ importable when pytest is launched from the repo root.
BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from llm import factory  # noqa: E402
from tests.fakes.llm import FakeLLMProvider  # noqa: E402
from tools.registry import ToolRegistry  # noqa: E402


@pytest.fixture(autouse=True)
def _force_fake_llm(monkeypatch):
    factory.reset()
    fake = FakeLLMProvider()
    monkeypatch.setattr(factory, "chat", lambda: fake)
    monkeypatch.setattr(factory, "embed", lambda: fake)
    yield
    factory.reset()


@pytest.fixture(autouse=True)
def _reset_registry():
    ToolRegistry.singleton().clear()
    yield
    ToolRegistry.singleton().clear()


@pytest.fixture(autouse=True)
def _reset_kb():
    from rag.knowledge_base import InMemoryKB

    InMemoryKB.reset()
    yield
    InMemoryKB.reset()


@pytest.fixture(autouse=True)
def _isolate_seen_resumes(tmp_path, monkeypatch):
    """Use a per-test temp file for Kavya's seen-resumes store."""
    import os

    monkeypatch.setenv("SEEN_RESUMES_PATH", str(tmp_path / "seen.json"))
    yield
    if "SEEN_RESUMES_PATH" in os.environ:
        del os.environ["SEEN_RESUMES_PATH"]


@pytest.fixture(autouse=True)
def _disable_demo_pacing(tmp_path, monkeypatch):
    """Force demo delay to 0 in tests — we don't want pytest to sleep."""
    import json
    from production import demo_config_store

    cfg_path = tmp_path / "demo.json"
    cfg_path.write_text(json.dumps({"delay_seconds": 0.0}))
    monkeypatch.setenv("DEMO_CONFIG_PATH", str(cfg_path))
    demo_config_store.reset()
    yield
    demo_config_store.reset()
