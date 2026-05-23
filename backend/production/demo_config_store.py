"""Persistent DemoConfig store.

A tiny JSON file (path configurable via DEMO_CONFIG_PATH, defaults to
./.demo-config.json) holds the demo-mode delay setting. Singleton with
thread-safe read/write. The runner reads on every run-start so changes
from /settings apply on the next run with no restart.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path

from production.schemas import DemoConfig

log = logging.getLogger(__name__)

_DEFAULT_PATH = "./.demo-config.json"
_lock = threading.Lock()
_cached: DemoConfig | None = None


def _path() -> Path:
    return Path(os.environ.get("DEMO_CONFIG_PATH", _DEFAULT_PATH))


def get_config() -> DemoConfig:
    """Return the current demo config. Reads from disk on first call."""
    global _cached
    with _lock:
        if _cached is not None:
            return _cached
        p = _path()
        if p.exists():
            try:
                raw = json.loads(p.read_text())
                _cached = DemoConfig(**raw)
            except (ValueError, TypeError) as e:
                log.warning("demo config at %s malformed (%s) — defaults", p, e)
                _cached = DemoConfig()
        else:
            _cached = DemoConfig()
        return _cached


def set_config(cfg: DemoConfig) -> DemoConfig:
    """Persist a new demo config and refresh the cache."""
    global _cached
    with _lock:
        p = _path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(cfg.model_dump(), indent=2))
        _cached = cfg
        log.info("demo config updated: %s", cfg.model_dump())
        return cfg


def reset() -> None:
    """Test helper — drop the cache so the next get_config() re-reads."""
    global _cached
    with _lock:
        _cached = None
