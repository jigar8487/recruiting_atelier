"""NVIDIA NIM — OpenAI-wire-compatible (E2)."""
from __future__ import annotations

from .openai_provider import OpenAIProvider


class NvidiaProvider(OpenAIProvider):
    name = "nvidia"
    default_base_url = "https://integrate.api.nvidia.com/v1"
    default_chat_model = "meta/llama-3.1-70b-instruct"
    default_embed_model = "nvidia/nv-embedqa-e5-v5"
    default_api_key_env = "NVIDIA_API_KEY"
    embeddings_supported = True
