"""OpenRouter — uses the OpenAI client with an OpenRouter base URL (E2)."""
from __future__ import annotations

from .openai_provider import OpenAIProvider


class OpenRouterProvider(OpenAIProvider):
    name = "openrouter"
    default_base_url = "https://openrouter.ai/api/v1"
    default_chat_model = "anthropic/claude-haiku-4.5"
    default_embed_model = ""  # not reliably supported
    default_api_key_env = "OPENROUTER_API_KEY"
    embeddings_supported = False
