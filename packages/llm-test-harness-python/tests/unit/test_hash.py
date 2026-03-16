"""Cross-language hash parity tests — all vectors must match the TypeScript implementation."""
from __future__ import annotations

import json
import os

import pytest

from llm_test_harness.cassette.hash import hash_request
from llm_test_harness.types import (
    CassetteMessage,
    CassetteParams,
    CassetteRequest,
)

VECTORS_PATH = os.path.join(os.path.dirname(__file__), "..", "fixtures", "hash-vectors.json")


def _load_vectors() -> list[dict]:
    with open(VECTORS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _vector_to_request(v: dict) -> CassetteRequest:
    req = v["request"]
    params_d = req.get("params", {})
    return CassetteRequest(
        provider=req["provider"],
        model=req["model"],
        system=req.get("system"),
        messages=[
            CassetteMessage(role=m["role"], content=m["content"])
            for m in req.get("messages", [])
        ],
        params=CassetteParams(
            max_tokens=params_d.get("max_tokens"),
            temperature=params_d.get("temperature"),
            top_p=params_d.get("top_p"),
            stop=params_d.get("stop"),
        ),
        tools=None,
    )


@pytest.mark.parametrize("vector", _load_vectors(), ids=[v["description"] for v in _load_vectors()])
def test_hash_parity(vector: dict) -> None:
    req = _vector_to_request(vector)
    result = hash_request(req)
    assert result == vector["expected_hash"], (
        f"Hash mismatch for '{vector['description']}'\n"
        f"  expected: {vector['expected_hash']}\n"
        f"  got:      {result}"
    )


def test_hash_starts_with_sha256() -> None:
    req = CassetteRequest(
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        messages=[CassetteMessage(role="user", content="hi")],
        params=CassetteParams(max_tokens=10),
    )
    h = hash_request(req)
    assert h.startswith("sha256:")
    assert len(h) == len("sha256:") + 64


def test_same_request_same_hash() -> None:
    def make_req() -> CassetteRequest:
        return CassetteRequest(
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            messages=[CassetteMessage(role="user", content="hello")],
            params=CassetteParams(max_tokens=50, temperature=0.0),
        )
    assert hash_request(make_req()) == hash_request(make_req())


def test_different_content_different_hash() -> None:
    def make_req(content: str) -> CassetteRequest:
        return CassetteRequest(
            provider="anthropic",
            model="claude-haiku-4-5-20251001",
            messages=[CassetteMessage(role="user", content=content)],
            params=CassetteParams(max_tokens=50),
        )
    assert hash_request(make_req("hello")) != hash_request(make_req("world"))
