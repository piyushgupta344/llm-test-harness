"""End-to-end harness tests using mock clients (no real API calls)."""
from __future__ import annotations

import os
import tempfile
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from llm_test_harness import Harness, Metrics
from llm_test_harness.adapters.anthropic import AnthropicClientProxy
from llm_test_harness.errors import CassetteMissError


def _make_anthropic_response(text: str = "Hello!") -> Any:
    """Create a minimal mock Anthropic response object."""
    content_block = MagicMock()
    content_block.type = "text"
    content_block.text = text
    content_block.id = None
    content_block.name = None
    content_block.input = None

    usage = MagicMock()
    usage.input_tokens = 10
    usage.output_tokens = 5

    resp = MagicMock()
    resp.type = "message"
    resp.role = "assistant"
    resp.content = [content_block]
    resp.usage = usage
    resp.stop_reason = "end_turn"
    resp.id = "msg_test_001"
    return resp


def _make_mock_anthropic_client(response: Any) -> Any:
    """Create a fake Anthropic client that returns a fixed response."""
    messages_mock = MagicMock()
    messages_mock.create.return_value = response

    client = MagicMock()
    client.messages = messages_mock
    return client


class TestHarnessRecordReplay:
    def test_record_writes_cassette(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_resp = _make_anthropic_response("Hello!")
            mock_client = _make_mock_anthropic_client(mock_resp)

            harness = Harness(tmpdir, mode="record")

            with patch("llm_test_harness.harness.is_anthropic_client", return_value=True):
                wrapped = harness.wrap(mock_client)

            wrapped.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": "Say hello."}],
            )

            cassette_path = os.path.join(tmpdir, "cassette.yml")
            assert os.path.exists(cassette_path)

    def test_replay_returns_cassette_response(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            # First: record
            mock_resp = _make_anthropic_response("Hello from cassette!")
            mock_client = _make_mock_anthropic_client(mock_resp)

            harness_record = Harness(tmpdir, mode="record")
            with patch("llm_test_harness.harness.is_anthropic_client", return_value=True):
                wrapped_record = harness_record.wrap(mock_client)
            wrapped_record.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": "Say hello."}],
            )

            # Then: replay with a different client that should NOT be called
            mock_client2 = _make_mock_anthropic_client(_make_anthropic_response("SHOULD NOT SEE THIS"))

            harness_replay = Harness(tmpdir, mode="replay")
            with patch("llm_test_harness.harness.is_anthropic_client", return_value=True):
                wrapped_replay = harness_replay.wrap(mock_client2)
            result = wrapped_replay.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": "Say hello."}],
            )

            # API should NOT have been called in replay mode
            mock_client2.messages.create.assert_not_called()
            assert result.content[0].text == "Hello from cassette!"

    def test_replay_raises_on_miss(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_client = _make_mock_anthropic_client(_make_anthropic_response())
            harness = Harness(tmpdir, mode="replay")
            with patch("llm_test_harness.harness.is_anthropic_client", return_value=True):
                wrapped = harness.wrap(mock_client)

            with pytest.raises(CassetteMissError):
                wrapped.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=100,
                    messages=[{"role": "user", "content": "This was never recorded."}],
                )

    def test_hybrid_falls_back_to_record(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            mock_resp = _make_anthropic_response("Hybrid response")
            mock_client = _make_mock_anthropic_client(mock_resp)

            harness = Harness(tmpdir, mode="hybrid")
            with patch("llm_test_harness.harness.is_anthropic_client", return_value=True):
                wrapped = harness.wrap(mock_client)

            # First call — no cassette, should record
            result = wrapped.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": "Hybrid test."}],
            )
            assert mock_client.messages.create.call_count == 1

            # Second call — cassette exists, should NOT call API
            result2 = wrapped.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                messages=[{"role": "user", "content": "Hybrid test."}],
            )
            assert mock_client.messages.create.call_count == 1  # still 1
            assert result2.content[0].text == "Hybrid response"


class TestHarnessEvaluate:
    def test_evaluate_all_pass(self) -> None:
        harness = Harness("/tmp", mode="replay")
        result = harness.evaluate("Hello, world!", [
            Metrics.contains("Hello"),
            Metrics.regex(r"world"),
        ])
        assert result.passed is True
        assert result.pass_rate == 1.0

    def test_evaluate_partial_fail(self) -> None:
        harness = Harness("/tmp", mode="replay")
        result = harness.evaluate("Hello", [
            Metrics.contains("Hello"),
            Metrics.contains("goodbye"),
        ])
        assert result.passed is False
        assert result.pass_rate == pytest.approx(0.5)


class TestHarnessBaseline:
    def test_save_and_compare_no_regression(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            harness = Harness(tmpdir, mode="replay")
            result = harness.evaluate("Hello, world!", [Metrics.contains("Hello")])
            harness.save_baseline("greeting", result)
            regression = harness.compare_baseline("greeting", result)
            assert regression.has_regression is False
