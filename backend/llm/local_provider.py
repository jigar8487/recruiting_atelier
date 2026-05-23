"""Local LLM via Ollama's OpenAI-compatible endpoint (E2)."""
from __future__ import annotations

import os

from .openai_provider import OpenAIProvider
from .base import ProviderNotConfiguredError


class LocalProvider(OpenAIProvider):
    name = "local"
    default_base_url = "http://localhost:11434/v1"
    default_chat_model = "llama3.1:8b"
    default_embed_model = "nomic-embed-text"
    default_api_key_env = "OLLAMA_API_KEY"
    embeddings_supported = True

    def __init__(
        self,
        chat_model: str | None = None,
        embed_model: str | None = None,
        base_url: str | None = None,
        api_key_env: str | None = None,
    ) -> None:
        # Ollama ignores the key but the SDK requires a non-empty string.
        env_key = api_key_env or self.default_api_key_env
        if not os.environ.get(env_key):
            os.environ[env_key] = "ollama"
        try:
            super().__init__(chat_model, embed_model, base_url, api_key_env)
        except ProviderNotConfiguredError:
            # Surface a clearer hint for the local case.
            raise ProviderNotConfiguredError(
                "Local provider needs Ollama running at "
                f"{base_url or self.default_base_url}"
            )
