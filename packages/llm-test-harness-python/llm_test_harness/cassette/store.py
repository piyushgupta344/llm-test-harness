from __future__ import annotations

import os
from typing import Optional

import yaml

from ..errors import CassetteWriteError
from ..types import (
    CassetteContentBlock,
    CassetteFile,
    CassetteInteraction,
    CassetteMessage,
    CassetteMetadata,
    CassetteParams,
    CassetteRequest,
    CassetteResponse,
    CassetteTool,
    CassetteUsage,
)


def _interaction_to_dict(i: CassetteInteraction) -> dict:
    d: dict = {
        "id": i.id,
        "metadata": {
            "duration_ms": i.metadata.duration_ms,
            "recorded_at": i.metadata.recorded_at,
        },
        "request": {
            "messages": [{"content": m.content, "role": m.role} for m in i.request.messages],
            "model": i.request.model,
            "params": {
                "max_tokens": i.request.params.max_tokens,
                "stop": i.request.params.stop,
                "temperature": i.request.params.temperature,
                "top_p": i.request.params.top_p,
            },
            "provider": i.request.provider,
            "system": i.request.system,
            "tools": (
                [{"description": t.description, "name": t.name} for t in i.request.tools]
                if i.request.tools
                else None
            ),
        },
        "response": {
            "type": i.response.type,
        },
    }

    if i.metadata.provider_request_id is not None:
        d["metadata"]["provider_request_id"] = i.metadata.provider_request_id

    if i.response.content is not None:
        d["response"]["content"] = [
            {k: v for k, v in {
                "type": b.type,
                "text": b.text,
                "id": b.id,
                "name": b.name,
                "input": b.input,
            }.items() if v is not None}
            for b in i.response.content
        ]

    if i.response.usage is not None:
        usage: dict = {}
        if i.response.usage.input_tokens is not None:
            usage["input_tokens"] = i.response.usage.input_tokens
        if i.response.usage.output_tokens is not None:
            usage["output_tokens"] = i.response.usage.output_tokens
        if i.response.usage.total_tokens is not None:
            usage["total_tokens"] = i.response.usage.total_tokens
        if usage:
            d["response"]["usage"] = usage

    if i.response.stop_reason is not None:
        d["response"]["stop_reason"] = i.response.stop_reason
    if i.response.finish_reason is not None:
        d["response"]["finish_reason"] = i.response.finish_reason

    return d


def _interaction_from_dict(d: dict) -> CassetteInteraction:
    req_d = d["request"]
    resp_d = d["response"]
    meta_d = d["metadata"]

    params_d = req_d.get("params", {})
    params = CassetteParams(
        max_tokens=params_d.get("max_tokens"),
        temperature=params_d.get("temperature"),
        top_p=params_d.get("top_p"),
        stop=params_d.get("stop"),
    )

    tools = None
    if req_d.get("tools"):
        tools = [CassetteTool(name=t["name"], description=t.get("description")) for t in req_d["tools"]]

    request = CassetteRequest(
        provider=req_d["provider"],
        model=req_d["model"],
        system=req_d.get("system"),
        messages=[CassetteMessage(role=m["role"], content=m["content"]) for m in req_d.get("messages", [])],
        params=params,
        tools=tools,
    )

    content = None
    if resp_d.get("content"):
        content = [
            CassetteContentBlock(
                type=b["type"],
                text=b.get("text"),
                id=b.get("id"),
                name=b.get("name"),
                input=b.get("input"),
            )
            for b in resp_d["content"]
        ]

    usage = None
    if resp_d.get("usage"):
        u = resp_d["usage"]
        usage = CassetteUsage(
            input_tokens=u.get("input_tokens"),
            output_tokens=u.get("output_tokens"),
            total_tokens=u.get("total_tokens"),
        )

    response = CassetteResponse(
        type=resp_d["type"],
        content=content,
        usage=usage,
        stop_reason=resp_d.get("stop_reason"),
        finish_reason=resp_d.get("finish_reason"),
    )

    metadata = CassetteMetadata(
        recorded_at=meta_d["recorded_at"],
        duration_ms=meta_d["duration_ms"],
        provider_request_id=meta_d.get("provider_request_id"),
    )

    return CassetteInteraction(id=d["id"], request=request, response=response, metadata=metadata)


class CassetteStore:
    def __init__(self, file_path: str) -> None:
        self._file_path = file_path
        self._data: Optional[CassetteFile] = None

    @property
    def path(self) -> str:
        return self._file_path

    def load(self) -> CassetteFile:
        if self._data is not None:
            return self._data
        if not os.path.exists(self._file_path):
            self._data = CassetteFile(version=1, interactions=[])
        else:
            with open(self._file_path, "r", encoding="utf-8") as f:
                raw = yaml.safe_load(f)
            if not raw or not isinstance(raw.get("interactions"), list):
                self._data = CassetteFile(version=1, interactions=[])
            else:
                interactions = [_interaction_from_dict(d) for d in raw["interactions"]]
                self._data = CassetteFile(version=raw.get("version", 1), interactions=interactions)
        return self._data

    def find_by_id(self, id_: str) -> Optional[CassetteInteraction]:
        for interaction in self.load().interactions:
            if interaction.id == id_:
                return interaction
        return None

    def append(self, interaction: CassetteInteraction) -> None:
        data = self.load()
        existing = next((i for i, x in enumerate(data.interactions) if x.id == interaction.id), None)
        if existing is not None:
            data.interactions[existing] = interaction
        else:
            data.interactions.append(interaction)
        self._flush()

    def _flush(self) -> None:
        data = self.load()
        dir_ = os.path.dirname(self._file_path)
        try:
            if dir_ and not os.path.exists(dir_):
                os.makedirs(dir_, exist_ok=True)
            doc = {
                "version": data.version,
                "interactions": [_interaction_to_dict(i) for i in data.interactions],
            }
            with open(self._file_path, "w", encoding="utf-8") as f:
                yaml.dump(doc, f, default_flow_style=False, allow_unicode=True, sort_keys=True)
        except Exception as e:
            raise CassetteWriteError(self._file_path, e) from e
