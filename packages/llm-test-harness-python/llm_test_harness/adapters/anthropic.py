from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from ..cassette.match import find_interaction, require_interaction
from ..cassette.store import CassetteStore
from ..errors import CassetteOverwriteError
from ..types import (
    CassetteContentBlock,
    CassetteInteraction,
    CassetteMessage,
    CassetteMetadata,
    CassetteParams,
    CassetteRequest,
    CassetteResponse,
    CassetteUsage,
    ResolvedHarnessConfig,
)
def _build_request(params: dict[str, Any]) -> CassetteRequest:
    messages = [
        CassetteMessage(role=m["role"], content=m["content"])
        for m in params.get("messages", [])
    ]
    tools_raw = params.get("tools")
    tools = None
    if tools_raw:
        from ..types import CassetteTool
        tools = [
            CassetteTool(name=t.get("name", ""), description=t.get("description"))
            for t in tools_raw
        ]

    cp = CassetteParams(
        max_tokens=params.get("max_tokens"),
        temperature=params.get("temperature"),
        top_p=params.get("top_p"),
        stop=params.get("stop_sequences") or params.get("stop"),
    )
    return CassetteRequest(
        provider="anthropic",
        model=params.get("model", ""),
        system=params.get("system"),
        messages=messages,
        params=cp,
        tools=tools,
    )


def _response_to_cassette(resp: Any) -> CassetteResponse:
    content = None
    if hasattr(resp, "content") and resp.content:
        content = []
        for b in resp.content:
            block_type: str = getattr(b, "type", "text") or "text"
            text = getattr(b, "text", None)
            bid = getattr(b, "id", None)
            name = getattr(b, "name", None)
            inp = getattr(b, "input", None)
            content.append(
                CassetteContentBlock(type=block_type, text=text, id=bid, name=name, input=inp)
            )

    usage = None
    if hasattr(resp, "usage") and resp.usage:
        u = resp.usage
        usage = CassetteUsage(
            input_tokens=getattr(u, "input_tokens", None),
            output_tokens=getattr(u, "output_tokens", None),
        )

    return CassetteResponse(
        type=getattr(resp, "type", "message"),
        content=content,
        usage=usage,
        stop_reason=getattr(resp, "stop_reason", None),
    )


def _cassette_to_response(interaction: CassetteInteraction) -> Any:
    """Reconstruct a minimal Anthropic-like response object from cassette data."""

    class _Usage:
        def __init__(self, input_tokens: Any, output_tokens: Any) -> None:
            self.input_tokens = input_tokens
            self.output_tokens = output_tokens

    class _TextBlock:
        def __init__(self, text: str) -> None:
            self.type = "text"
            self.text = text

    class _ToolUseBlock:
        def __init__(self, bid: str, name: str, inp: Any) -> None:
            self.type = "tool_use"
            self.id = bid
            self.name = name
            self.input = inp

    class _Message:
        def __init__(
            self,
            content: list[Any],
            usage: Any,
            stop_reason: Any,
            model: str,
        ) -> None:
            self.type = "message"
            self.role = "assistant"
            self.content = content
            self.usage = usage
            self.stop_reason = stop_reason
            self.model = model
            self.id = f"replay_{interaction.id[:16]}"

    blocks: list[Any] = []
    if interaction.response.content:
        for b in interaction.response.content:
            if b.type == "tool_use":
                blocks.append(_ToolUseBlock(b.id or "", b.name or "", b.input))
            else:
                blocks.append(_TextBlock(b.text or ""))

    usage_obj = None
    if interaction.response.usage:
        usage_obj = _Usage(
            interaction.response.usage.input_tokens,
            interaction.response.usage.output_tokens,
        )

    return _Message(
        content=blocks,
        usage=usage_obj,
        stop_reason=interaction.response.stop_reason,
        model=interaction.request.model,
    )


def _intercept_create(
    original_create: Any,
    params: dict[str, Any],
    store: CassetteStore,
    config: ResolvedHarnessConfig,
) -> Any:
    # Streaming always passes through
    if params.get("stream"):
        return original_create(**params)

    req = _build_request(params)
    mode = config.mode

    if mode == "replay":
        interaction = require_interaction(store, req)
        return _cassette_to_response(interaction)

    if mode == "passthrough":
        return original_create(**params)

    if mode in ("record", "hybrid"):
        if mode == "hybrid":
            existing = find_interaction(store, req)
            if existing is not None:
                return _cassette_to_response(existing)

        start = time.monotonic()
        resp = original_create(**params)
        duration_ms = int((time.monotonic() - start) * 1000)

        from ..cassette.hash import hash_request
        hash_ = hash_request(req)

        if config.no_overwrite and store.find_by_id(hash_) is not None:
            raise CassetteOverwriteError(hash_)

        metadata = CassetteMetadata(
            recorded_at=datetime.now(timezone.utc).isoformat(),
            duration_ms=duration_ms,
            provider_request_id=getattr(resp, "id", None),
        )
        interaction = CassetteInteraction(
            id=hash_,
            request=req,
            response=_response_to_cassette(resp),
            metadata=metadata,
        )
        if config.on_before_record:
            interaction = config.on_before_record(interaction)
        store.append(interaction)
        return resp

    return original_create(**params)


class _MessagesProxy:
    def __init__(self, messages: Any, store: CassetteStore, config: ResolvedHarnessConfig) -> None:
        self._messages = messages
        self._store = store
        self._config = config

    def create(self, **params: Any) -> Any:
        return _intercept_create(self._messages.create, params, self._store, self._config)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._messages, name)


class AnthropicClientProxy:
    def __init__(self, client: Any, store: CassetteStore, config: ResolvedHarnessConfig) -> None:
        self._client = client
        self._store = store
        self._config = config

    @property
    def messages(self) -> _MessagesProxy:
        return _MessagesProxy(self._client.messages, self._store, self._config)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)
