"""Per-1M-token pricing for known models (E2 §22).

USD per 1,000,000 tokens — matches every provider's published price page.
Unknown (provider, model) pairs return 0.0 — we never crash a run because
pricing is missing. Override any rate via .env using
``PRICE_OVERRIDE_<PROVIDER>_<MODEL>="in:0.5,out:1.5"`` (slashes in model id
are normalised to underscores).
"""
from __future__ import annotations

import logging
import os
from typing import Mapping

log = logging.getLogger(__name__)

# Keys are (provider, model). Values are dollars per 1k tokens.
PRICES_PER_1K: dict[tuple[str, str], dict[str, float]] = {
    # Anthropic direct
    ("anthropic", "claude-opus-4-7"):       {"in": 15.0, "out": 75.0},
    ("anthropic", "claude-sonnet-4-5"):     {"in":  3.0, "out": 15.0},
    ("anthropic", "claude-sonnet-4-6"):     {"in":  3.0, "out": 15.0},
    ("anthropic", "claude-haiku-4-5"):      {"in":  1.0, "out":  5.0},
    # OpenAI
    ("openai", "gpt-4o"):                   {"in":  2.5, "out": 10.0},
    ("openai", "gpt-4o-mini"):              {"in":  0.15, "out": 0.60},
    ("openai", "text-embedding-3-small"):   {"in":  0.02, "out": 0.0},
    ("openai", "text-embedding-3-large"):   {"in":  0.13, "out": 0.0},
    # OpenRouter (router-side fees ignored — close-enough)
    ("openrouter", "anthropic/claude-haiku-4.5"):  {"in": 1.0,  "out": 5.0},
    ("openrouter", "anthropic/claude-sonnet-4.5"): {"in": 3.0,  "out": 15.0},
    ("openrouter", "anthropic/claude-sonnet-4.6"): {"in": 3.0,  "out": 15.0},
    ("openrouter", "anthropic/claude-opus-4.7"):   {"in": 15.0, "out": 75.0},
    # NVIDIA NIM
    ("nvidia", "meta/llama-3.1-70b-instruct"): {"in": 0.90, "out": 0.90},
    ("nvidia", "nvidia/nv-embedqa-e5-v5"):     {"in": 0.16, "out": 0.0},
    # Local Ollama — free
    ("local", "*"): {"in": 0.0, "out": 0.0},
}


def _override(provider: str, model: str) -> dict[str, float] | None:
    """Pick up a PRICE_OVERRIDE_<PROVIDER>_<MODEL> .env line, if any."""
    key = f"PRICE_OVERRIDE_{provider.upper()}_{model.upper().replace('/', '_').replace('-', '_').replace('.', '_')}"
    raw = os.environ.get(key)
    if not raw:
        return None
    out = {}
    try:
        for chunk in raw.split(","):
            k, v = chunk.split(":")
            out[k.strip()] = float(v.strip())
        return out
    except (ValueError, KeyError) as e:  # pragma: no cover
        log.warning("malformed pricing override %s=%s: %s", key, raw, e)
        return None


def estimate(provider: str, model: str, usage: Mapping[str, int]) -> float:
    """Return USD cost for one LLM call given its usage report."""
    rates = _override(provider, model)
    if rates is None:
        rates = PRICES_PER_1K.get((provider, model))
    if rates is None and provider == "local":
        rates = PRICES_PER_1K[("local", "*")]
    if rates is None:
        return 0.0
    inp = usage.get("input_tokens", 0) or 0
    out = usage.get("output_tokens", 0) or 0
    return round(
        (inp * rates.get("in", 0.0) + out * rates.get("out", 0.0)) / 1_000_000.0,
        6,
    )
