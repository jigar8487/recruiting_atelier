"""OpenAI provider + base class for every OpenAI-wire-compatible provider (E2).

OpenRouter, NVIDIA NIM, and local Ollama all expose the OpenAI Chat Completions
and Embeddings wire formats — they reuse this class with different base URLs.
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


class OpenAIProvider:
    name: str = "openai"
    default_base_url: str | None = None  # None → SDK default (api.openai.com)
    default_chat_model: str = "gpt-4o-mini"
    default_embed_model: str = "text-embedding-3-small"
    default_api_key_env: str = "OPENAI_API_KEY"
    embeddings_supported: bool = True

    def __init__(
        self,
        chat_model: str | None = None,
        embed_model: str | None = None,
        base_url: str | None = None,
        api_key_env: str | None = None,
    ) -> None:
        env_key = api_key_env or self.default_api_key_env
        key = os.environ.get(env_key)
        if not key:
            raise ProviderNotConfiguredError(f"Missing {env_key} for {self.name}")
        try:
            import openai  # type: ignore
        except ImportError as e:
            raise ProviderNotConfiguredError(
                "Install with `pip install openai`"
            ) from e
        self.client = openai.OpenAI(
            api_key=key, base_url=base_url or self.default_base_url
        )
        self.chat_model = chat_model or self.default_chat_model
        self.embed_model = embed_model or self.default_embed_model

    def chat(self, req: ChatRequest) -> ChatResponse:
        kwargs: dict[str, Any] = dict(
            model=self.chat_model,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
            messages=[
                {"role": "system", "content": req.system},
                {"role": "user", "content": req.user},
            ],
        )
        if req.response_format:
            kwargs["response_format"] = req.response_format
        r = self.client.chat.completions.create(**kwargs)
        text = r.choices[0].message.content or ""
        usage = {
            "input_tokens": getattr(r.usage, "prompt_tokens", 0) or 0,
            "output_tokens": getattr(r.usage, "completion_tokens", 0) or 0,
        }
        return ChatResponse(
            text=text,
            provider=self.name,
            model=self.chat_model,
            usage=usage,
            raw={"id": r.id, "finish_reason": r.choices[0].finish_reason},
        )

    def embed(self, req: EmbeddingRequest) -> EmbeddingResponse:
        if not self.embeddings_supported:
            raise EmbeddingNotSupportedError(
                f"{self.name} does not support embeddings"
            )
        r = self.client.embeddings.create(model=self.embed_model, input=req.text)
        return EmbeddingResponse(
            vector=list(r.data[0].embedding),
            provider=self.name,
            model=self.embed_model,
        )
