"""LLM provider Protocol + shared helpers (E2)."""
from __future__ import annotations

from typing import Protocol

from production.schemas import (
    ChatRequest,
    ChatResponse,
    EmbeddingRequest,
    EmbeddingResponse,
)


class ProviderNotConfiguredError(RuntimeError):
    """Required env vars / credentials are missing for this provider."""


class EmbeddingNotSupportedError(NotImplementedError):
    """Provider does not support embeddings on this endpoint."""


class LLMProvider(Protocol):
    """Provider adapter contract. Implementations live in llm/*_provider.py."""

    name: str
    chat_model: str
    embed_model: str

    def chat(self, req: ChatRequest) -> ChatResponse: ...

    def embed(self, req: EmbeddingRequest) -> EmbeddingResponse: ...


def is_configured(provider_name: str) -> bool:
    """Check whether the env vars required by a provider are present."""
    import os

    matrix = {
        "anthropic": ["ANTHROPIC_API_KEY"],
        "openai": ["OPENAI_API_KEY"],
        "openrouter": ["OPENROUTER_API_KEY"],
        "nvidia": ["NVIDIA_API_KEY"],
        "local": [],  # Ollama needs no key
        "fake": [],
    }
    required = matrix.get(provider_name, [])
    return all(os.environ.get(k) for k in required)
