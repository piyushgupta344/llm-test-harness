"""
Scrubbers — composable helpers for sanitising cassettes before they are written.

Use with the ``on_before_record`` hook::

    harness = Harness(
        cassettes_dir="./cassettes",
        mode="record",
        on_before_record=Scrubbers.standard(),
    )
"""
from __future__ import annotations

import re
from typing import Callable

from ..types import CassetteInteraction, CassetteMessage

Scrubber = Callable[[CassetteInteraction], CassetteInteraction]
REDACTED = "[REDACTED]"

_PATTERNS: dict[str, re.Pattern[str]] = {
    "anthropic_key": re.compile(r"sk-ant-[A-Za-z0-9\-_]{20,}"),
    "openai_key": re.compile(r"sk-[A-Za-z0-9]{20,}"),
    "bearer_token": re.compile(r"Bearer\s+[A-Za-z0-9\-_.]{20,}", re.IGNORECASE),
    "email": re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"),
    "uuid": re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE),
    "ipv4": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
}


def _scrub_str(value: str, pattern: re.Pattern[str], replacement: str) -> str:
    return pattern.sub(replacement, value)


def _scrub_messages(messages: list[CassetteMessage], pattern: re.Pattern[str], replacement: str) -> list[CassetteMessage]:
    from dataclasses import replace as dc_replace
    return [dc_replace(m, content=_scrub_str(m.content, pattern, replacement)) for m in messages]


def _scrub_interaction(interaction: CassetteInteraction, pattern: re.Pattern[str], replacement: str) -> CassetteInteraction:
    from dataclasses import replace as dc_replace
    new_system = (
        _scrub_str(interaction.request.system, pattern, replacement)
        if interaction.request.system
        else interaction.request.system
    )
    new_messages = _scrub_messages(interaction.request.messages, pattern, replacement)
    new_content = None
    if interaction.response.content:
        from dataclasses import replace as r
        new_content = [
            r(b, text=_scrub_str(b.text, pattern, replacement)) if b.text else b
            for b in interaction.response.content
        ]
    new_req = dc_replace(interaction.request, system=new_system, messages=new_messages)
    new_resp = dc_replace(interaction.response, content=new_content)
    return dc_replace(interaction, request=new_req, response=new_resp)


class Scrubbers:
    """Composable scrubber factories. All methods return a ``Scrubber`` callable."""

    @staticmethod
    def api_key() -> Scrubber:
        """Redact Anthropic and OpenAI API keys and Bearer tokens."""
        def _scrub(i: CassetteInteraction) -> CassetteInteraction:
            i = _scrub_interaction(i, _PATTERNS["anthropic_key"], REDACTED)
            i = _scrub_interaction(i, _PATTERNS["openai_key"], REDACTED)
            i = _scrub_interaction(i, _PATTERNS["bearer_token"], f"Bearer {REDACTED}")
            return i
        return _scrub

    @staticmethod
    def email(replacement: str = REDACTED) -> Scrubber:
        """Redact email addresses."""
        return lambda i: _scrub_interaction(i, _PATTERNS["email"], replacement)

    @staticmethod
    def uuid(replacement: str = "00000000-0000-0000-0000-000000000000") -> Scrubber:
        """Redact UUIDs."""
        return lambda i: _scrub_interaction(i, _PATTERNS["uuid"], replacement)

    @staticmethod
    def ip_address(replacement: str = "0.0.0.0") -> Scrubber:
        """Redact IPv4 addresses."""
        return lambda i: _scrub_interaction(i, _PATTERNS["ipv4"], replacement)

    @staticmethod
    def custom(pattern: re.Pattern[str] | str, replacement: str = REDACTED) -> Scrubber:
        """Redact any custom regex pattern."""
        pat = re.compile(pattern) if isinstance(pattern, str) else pattern
        return lambda i: _scrub_interaction(i, pat, replacement)

    @staticmethod
    def combine(*scrubbers: Scrubber) -> Scrubber:
        """Combine multiple scrubbers, applied left to right."""
        def _combined(i: CassetteInteraction) -> CassetteInteraction:
            for s in scrubbers:
                i = s(i)
            return i
        return _combined

    @staticmethod
    def standard() -> Scrubber:
        """Preset: redacts API keys, bearer tokens, emails, and UUIDs."""
        return Scrubbers.combine(
            Scrubbers.api_key(),
            Scrubbers.email(),
            Scrubbers.uuid(),
        )
