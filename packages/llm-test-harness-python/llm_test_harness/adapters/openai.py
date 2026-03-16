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
    raw_messages = params.get("messages", [])
    system = None
    messages: list[CassetteMessage] = []
    for m in raw_messages:
        if m.get("role") == "system" and system is None:
            system = m.get("content")
        else:
            messages.append(CassetteMessage(role=m["role"], content=m["content"]))

    tools_raw = params.get("tools")
    tools = None
    if tools_raw:
        from ..types import CassetteTool
        tools = []
        for t in tools_raw:
            fn = t.get("function", {}) if t.get("type") == "function" else t
            tools.append(CassetteTool(name=fn.get("name", ""), description=fn.get("description")))

    cp = CassetteParams(
        max_tokens=params.get("max_tokens"),
        temperature=params.get("temperature"),
        top_p=params.get("top_p"),
        stop=params.get("stop"),
    )
    return CassetteRequest(
        provider="openai",
        model=params.get("model", ""),
        system=system,
        messages=messages,
        params=cp,
        tools=tools,
    )


def _response_to_cassette(resp: Any) -> CassetteResponse:
    content = None
    choices = getattr(resp, "choices", None) or []
    if choices:
        choice = choices[0]
        msg = getattr(choice, "message", None)
        if msg:
            content = []
            text = getattr(msg, "content", None)
            if text:
                content.append(CassetteContentBlock(type="text", text=text))
            tool_calls = getattr(msg, "tool_calls", None) or []
            for tc in tool_calls:
                fn = getattr(tc, "function", None)
                content.append(
                    CassetteContentBlock(
                        type="tool_use",
                        id=getattr(tc, "id", None),
                        name=getattr(fn, "name", None) if fn else None,
                        input=getattr(fn, "arguments", None) if fn else None,
                    )
                )

    usage = None
    u = getattr(resp, "usage", None)
    if u:
        usage = CassetteUsage(
            input_tokens=getattr(u, "prompt_tokens", None),
            output_tokens=getattr(u, "completion_tokens", None),
            total_tokens=getattr(u, "total_tokens", None),
        )

    finish_reason = None
    if choices:
        finish_reason = getattr(choices[0], "finish_reason", None)

    return CassetteResponse(
        type="chat.completion",
        content=content,
        usage=usage,
        finish_reason=finish_reason,
    )


def _cassette_to_response(interaction: CassetteInteraction) -> Any:
    """Reconstruct a minimal OpenAI-like ChatCompletion object from cassette data."""

    class _FunctionCall:
        def __init__(self, name: str, arguments: Any) -> None:
            self.name = name
            self.arguments = arguments

    class _ToolCall:
        def __init__(self, tc_id: str, fn: _FunctionCall) -> None:
            self.id = tc_id
            self.type = "function"
            self.function = fn

    class _Message:
        def __init__(self, content: Any, tool_calls: list[Any]) -> None:
            self.role = "assistant"
            self.content = content
            self.tool_calls = tool_calls or None

    class _Choice:
        def __init__(self, message: _Message, finish_reason: Any) -> None:
            self.index = 0
            self.message = message
            self.finish_reason = finish_reason

    class _Usage:
        def __init__(self, prompt: Any, completion: Any, total: Any) -> None:
            self.prompt_tokens = prompt
            self.completion_tokens = completion
            self.total_tokens = total

    class _ChatCompletion:
        def __init__(self, choices: list[Any], usage: Any, model: str) -> None:
            self.object = "chat.completion"
            self.model = model
            self.choices = choices
            self.usage = usage
            self.id = f"replay_{interaction.id[:16]}"

    text_content = None
    tool_calls: list[Any] = []
    if interaction.response.content:
        for b in interaction.response.content:
            if b.type == "tool_use":
                tool_calls.append(
                    _ToolCall(b.id or "", _FunctionCall(b.name or "", b.input))
                )
            elif b.type == "text":
                text_content = b.text

    msg = _Message(text_content, tool_calls)
    choice = _Choice(msg, interaction.response.finish_reason)

    usage_obj = None
    if interaction.response.usage:
        usage_obj = _Usage(
            interaction.response.usage.input_tokens,
            interaction.response.usage.output_tokens,
            interaction.response.usage.total_tokens,
        )

    return _ChatCompletion([choice], usage_obj, interaction.request.model)


def _intercept_create(
    original_create: Any,
    params: dict[str, Any],
    store: CassetteStore,
    config: ResolvedHarnessConfig,
) -> Any:
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


class _CompletionsProxy:
    def __init__(self, completions: Any, store: CassetteStore, config: ResolvedHarnessConfig) -> None:
        self._completions = completions
        self._store = store
        self._config = config

    def create(self, **params: Any) -> Any:
        return _intercept_create(self._completions.create, params, self._store, self._config)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._completions, name)


class _ChatProxy:
    def __init__(self, chat: Any, store: CassetteStore, config: ResolvedHarnessConfig) -> None:
        self._chat = chat
        self._store = store
        self._config = config

    @property
    def completions(self) -> _CompletionsProxy:
        return _CompletionsProxy(self._chat.completions, self._store, self._config)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._chat, name)


class OpenAIClientProxy:
    def __init__(self, client: Any, store: CassetteStore, config: ResolvedHarnessConfig) -> None:
        self._client = client
        self._store = store
        self._config = config

    @property
    def chat(self) -> _ChatProxy:
        return _ChatProxy(self._client.chat, self._store, self._config)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)
