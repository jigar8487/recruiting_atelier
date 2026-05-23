"""Anthropic Claude provider (E2).

Embeddings are not implemented here — the factory routes embed() calls to a
configured fallback provider (typically OpenAI) when the active chat provider
is Anthropic.
"""
from __future__ import annotations

import os
from typing import Any

from production.schemas import (
    ChatRequest,
    ChatResponse,
    EmbeddingRequest,
    EmbeddingResponse,
)

from .base import EmbeddingNotSupportedError, ProviderNotConfiguredError

DEFAULT_CHAT_MODEL = "claude-sonnet-4-5"


class AnthropicProvider:
    name = "anthropic"

    def __init__(
        self,
        chat_model: str | None = None,
        embed_model: str | None = None,
        base_url: str | None = None,
        api_key_env: str = "ANTHROPIC_API_KEY",
    ) -> None:
        key = os.environ.get(api_key_env)
        if not key:
            raise ProviderNotConfiguredError(
                f"Missing {api_key_env} for AnthropicProvider"
            )
        try:
            import anthropic  # type: ignore
        except ImportError as e:
            raise ProviderNotConfiguredError(
                "Install with `pip install anthropic`"
            ) from e
        self.client = anthropic.Anthropic(api_key=key, base_url=base_url)
        self.chat_model = chat_model or DEFAULT_CHAT_MODEL
        self.embed_model = embed_model or ""

    def chat(self, req: ChatRequest) -> ChatResponse:
        kwargs: dict[str, Any] = dict(
            model=self.chat_model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            system=req.system,
            messages=[{"role": "user", "content": req.user}],
        )
        r = self.client.messages.create(**kwargs)
        text = "".join(block.text for block in r.content if block.type == "text")
        usage = {
            "input_tokens": r.usage.input_tokens,
            "output_tokens": r.usage.output_tokens,
        }
        return ChatResponse(
            text=text,
            provider=self.name,
            model=self.chat_model,
            usage=usage,
            raw={"id": r.id, "stop_reason": r.stop_reason},
        )

    def embed(self, req: EmbeddingRequest) -> EmbeddingResponse:
        raise EmbeddingNotSupportedError(
            "AnthropicProvider does not provide embeddings; use the embed-fallback "
            "provider (LLM_EMBED_PROVIDER env)."
        )
