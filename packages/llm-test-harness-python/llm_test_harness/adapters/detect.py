from __future__ import annotations

from typing import Any


def is_anthropic_client(client: Any) -> bool:
    """Returns True if client is an Anthropic SDK client instance."""
    try:
        import anthropic
        return isinstance(client, anthropic.Anthropic)
    except ImportError:
        return False


def is_openai_client(client: Any) -> bool:
    """Returns True if client is an OpenAI SDK client instance."""
    try:
        import openai
        return isinstance(client, openai.OpenAI)
    except ImportError:
        return False
