"""Active-provider factory (E2).

One source of truth for which LLM gets called. Agents call:
    factory.chat().chat(ChatRequest(...))
    factory.embed().embed(EmbeddingRequest(...))

Embedding fallback: when the active chat provider does not support embeddings
(e.g. OpenRouter, Anthropic), embeddings are routed to the LLM_EMBED_PROVIDER
configured in .env.
"""
from __future__ import annotations

import asyncio
import logging
import os
import threading
import time

from production.schemas import ChatRequest, ChatResponse, EmbeddingRequest, EmbeddingResponse, ProviderConfig

from . import pricing
from .anthropic_provider import AnthropicProvider
from .base import EmbeddingNotSupportedError, LLMProvider, ProviderNotConfiguredError, is_configured
from .local_provider import LocalProvider
from .nvidia_provider import NvidiaProvider
from .openai_provider import OpenAIProvider
from .openrouter_provider import OpenRouterProvider

log = logging.getLogger(__name__)

_REGISTRY: dict[str, type] = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "openrouter": OpenRouterProvider,
    "nvidia": NvidiaProvider,
    "local": LocalProvider,
}

_lock = threading.Lock()
_async_lock = asyncio.Lock()
_active: LLMProvider | None = None
_active_cfg: ProviderConfig | None = None
_embed_fallback: LLMProvider | None = None


def _build(cfg: ProviderConfig) -> LLMProvider:
    if cfg.name not in _REGISTRY:
        raise ProviderNotConfiguredError(f"Unknown provider: {cfg.name}")
    cls = _REGISTRY[cfg.name]
    return cls(
        chat_model=cfg.chat_model,
        embed_model=cfg.embed_model,
        base_url=cfg.base_url,
        api_key_env=cfg.api_key_env,
    )


def _default_cfg() -> ProviderConfig:
    name = os.environ.get("LLM_CHAT_PROVIDER", "anthropic")
    return ProviderConfig(name=name)  # type: ignore[arg-type]


def _embed_cfg() -> ProviderConfig:
    name = os.environ.get("LLM_EMBED_PROVIDER", "openai")
    return ProviderConfig(name=name)  # type: ignore[arg-type]


def available() -> list[ProviderConfig]:
    """All providers whose required env vars are set."""
    result = []
    for name, cls in _REGISTRY.items():
        cfg = ProviderConfig(  # type: ignore[call-arg]
            name=name,
            chat_model=getattr(cls, "default_chat_model", None),
            embed_model=getattr(cls, "default_embed_model", None) or None,
            base_url=getattr(cls, "default_base_url", None),
            api_key_env=getattr(cls, "default_api_key_env", None),
            available=is_configured(name) or name == "local",
        )
        result.append(cfg)
    return result


def set_active(cfg: ProviderConfig) -> ProviderConfig:
    global _active, _active_cfg
    with _lock:
        _active = _build(cfg)
        _active_cfg = cfg
    return cfg


def active() -> ProviderConfig:
    return _active_cfg or _default_cfg()


def chat() -> LLMProvider:
    global _active
    with _lock:
        if _active is None:
            _active = _build(_default_cfg())
    return _active


def embed() -> LLMProvider:
    """Return a provider capable of producing embeddings.

    If the active chat provider supports embeddings, use it; otherwise return
    the LLM_EMBED_PROVIDER fallback (built lazily and cached).
    """
    global _embed_fallback
    p = chat()
    if getattr(p, "embeddings_supported", True) and getattr(p, "embed_model", ""):
        return p
    with _lock:
        if _embed_fallback is None:
            _embed_fallback = _build(_embed_cfg())
    return _embed_fallback


def reset() -> None:
    """Test helper — clear cached singletons."""
    global _active, _active_cfg, _embed_fallback
    with _lock:
        _active = None
        _active_cfg = None
        _embed_fallback = None


def _resolve_run_id(run_id: str | None) -> str:
    if run_id:
        return run_id
    from production.observability import current_run_id
    return current_run_id.get()


def traced_chat(run_id: str | None, req: ChatRequest) -> ChatResponse:
    """Same as ``chat().chat(req)`` plus a trace_llm_call() span.

    Use this from agents instead of ``chat().chat(req)`` so token usage and
    cost roll up into the run summary.
    """
    # Local import — avoids a top-level cycle (observability → schemas).
    from production import observability

    rid = _resolve_run_id(run_id)
    provider = chat()
    t0 = time.perf_counter()
    try:
        resp = provider.chat(req)
    except Exception:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        observability.trace_llm_call(
            rid, provider.name, getattr(provider, "chat_model", "?"),
            tokens_in=0, tokens_out=0, latency_ms=latency_ms, cost_usd=0.0,
        )
        raise
    latency_ms = int((time.perf_counter() - t0) * 1000)
    cost = pricing.estimate(provider.name, getattr(provider, "chat_model", "?"), resp.usage)
    observability.trace_llm_call(
        rid, provider.name, getattr(provider, "chat_model", "?"),
        tokens_in=resp.usage.get("input_tokens", 0),
        tokens_out=resp.usage.get("output_tokens", 0),
        latency_ms=latency_ms, cost_usd=cost,
    )
    return resp


def traced_embed(run_id: str | None, req: EmbeddingRequest) -> EmbeddingResponse:
    """Same as ``embed().embed(req)`` plus a trace span (when run_id is set).

    Use this from agents that have a run_id; KB uploads call without one.
    """
    from production import observability

    rid = _resolve_run_id(run_id)
    provider = embed()
    t0 = time.perf_counter()
    try:
        resp = provider.embed(req)
    except EmbeddingNotSupportedError:
        raise
    except Exception:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        observability.trace_llm_call(
            rid, provider.name, getattr(provider, "embed_model", "?"),
            tokens_in=0, tokens_out=0, latency_ms=latency_ms, cost_usd=0.0,
        )
        raise
    latency_ms = int((time.perf_counter() - t0) * 1000)
    # Embeddings only consume input tokens — approximate by character count
    # when the SDK doesn't surface usage.
    in_tokens = max(1, len(req.text) // 4)
    cost = pricing.estimate(
        provider.name, getattr(provider, "embed_model", "?"),
        {"input_tokens": in_tokens, "output_tokens": 0},
    )
    observability.trace_llm_call(
        rid, provider.name, getattr(provider, "embed_model", "?"),
        tokens_in=in_tokens, tokens_out=0,
        latency_ms=latency_ms, cost_usd=cost,
    )
    return resp
