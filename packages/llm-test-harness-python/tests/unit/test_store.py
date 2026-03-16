"""Unit tests for CassetteStore."""
from __future__ import annotations

import os
import tempfile

import pytest

from llm_test_harness.cassette.store import CassetteStore
from llm_test_harness.types import (
    CassetteContentBlock,
    CassetteInteraction,
    CassetteMessage,
    CassetteMetadata,
    CassetteParams,
    CassetteRequest,
    CassetteResponse,
    CassetteUsage,
)


def _make_interaction(hash_: str = "sha256:abc123", content: str = "Hello!") -> CassetteInteraction:
    req = CassetteRequest(
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        messages=[CassetteMessage(role="user", content="Say hello.")],
        params=CassetteParams(max_tokens=100, temperature=0.0),
    )
    resp = CassetteResponse(
        type="message",
        content=[CassetteContentBlock(type="text", text=content)],
        usage=CassetteUsage(input_tokens=10, output_tokens=5),
        stop_reason="end_turn",
    )
    meta = CassetteMetadata(
        recorded_at="2026-03-16T11:09:00.000000+00:00",
        duration_ms=150,
        provider_request_id="msg_01TEST",
    )
    return CassetteInteraction(id=hash_, request=req, response=resp, metadata=meta)


class TestCassetteStore:
    def test_load_empty_if_no_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = CassetteStore(os.path.join(tmpdir, "cassette.yaml"))
            data = store.load()
            assert data.version == 1
            assert data.interactions == []

    def test_find_by_id_returns_none_when_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            store = CassetteStore(os.path.join(tmpdir, "cassette.yaml"))
            assert store.find_by_id("sha256:notexist") is None

    def test_append_and_find(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "cassette.yaml")
            store = CassetteStore(path)
            interaction = _make_interaction()
            store.append(interaction)

            # Verify in-memory
            found = store.find_by_id("sha256:abc123")
            assert found is not None
            assert found.response.content[0].text == "Hello!"

    def test_append_persists_to_disk(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "cassette.yaml")
            store = CassetteStore(path)
            store.append(_make_interaction())

            # Load fresh store from same file
            store2 = CassetteStore(path)
            found = store2.find_by_id("sha256:abc123")
            assert found is not None
            assert found.response.content[0].text == "Hello!"

    def test_append_overwrites_existing_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "cassette.yaml")
            store = CassetteStore(path)
            store.append(_make_interaction(content="First"))
            store.append(_make_interaction(content="Second"))

            data = store.load()
            assert len(data.interactions) == 1
            assert data.interactions[0].response.content[0].text == "Second"

    def test_creates_parent_directories(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "nested", "dir", "cassette.yaml")
            store = CassetteStore(path)
            store.append(_make_interaction())
            assert os.path.exists(path)

    def test_roundtrip_preserves_all_fields(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "cassette.yaml")
            store = CassetteStore(path)
            original = _make_interaction()
            store.append(original)

            store2 = CassetteStore(path)
            loaded = store2.find_by_id("sha256:abc123")
            assert loaded is not None
            assert loaded.request.model == "claude-haiku-4-5-20251001"
            assert loaded.request.params.temperature == 0.0
            assert loaded.metadata.duration_ms == 150
            assert loaded.metadata.provider_request_id == "msg_01TEST"
            assert loaded.response.usage.input_tokens == 10
