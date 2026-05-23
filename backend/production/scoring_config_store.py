"""Persistent ScoringConfig store.

A tiny JSON file (path configurable via SCORING_CONFIG_PATH, defaults to
./.scoring-config.json) holds the four user-set weights. Singleton with
thread-safe read/write. The ScorerAgent reads on every score call so
changes from /settings apply on the next run with no restart.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path

from production.schemas import ScoringConfig

log = logging.getLogger(__name__)

_DEFAULT_PATH = "./.scoring-config.json"
_lock = threading.Lock()
_cached: ScoringConfig | None = None


def _path() -> Path:
    return Path(os.environ.get("SCORING_CONFIG_PATH", _DEFAULT_PATH))


def get_config() -> ScoringConfig:
    """Return the current config. Reads from disk on first call and after writes."""
    global _cached
    with _lock:
        if _cached is not None:
            return _cached
        p = _path()
        if p.exists():
            try:
                raw = json.loads(p.read_text())
                _cached = ScoringConfig(**raw)
            except (ValueError, TypeError) as e:
                log.warning(
                    "scoring config at %s is malformed (%s) — using defaults", p, e,
                )
                _cached = ScoringConfig()
        else:
            _cached = ScoringConfig()
        return _cached


def set_config(cfg: ScoringConfig) -> ScoringConfig:
    """Persist a new config to disk and refresh the cache."""
    global _cached
    with _lock:
        p = _path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(cfg.model_dump(), indent=2))
        _cached = cfg
        log.info("scoring config updated: %s", cfg.model_dump())
        return cfg


def reset() -> None:
    """Test helper — drop the cache so the next get_config() re-reads."""
    global _cached
    with _lock:
        _cached = None
