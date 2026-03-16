"""Unit tests for the evaluator and baseline modules."""
from __future__ import annotations

import os
import tempfile

import pytest

from llm_test_harness.eval.baseline import compare_baseline, load_baseline, save_baseline
from llm_test_harness.eval.evaluator import evaluate
from llm_test_harness.metrics import Contains, ExactMatch, Regex, Similarity
from llm_test_harness.types import EvalResult, MetricScore


class TestEvaluate:
    def test_all_pass(self) -> None:
        result = evaluate("hello world", [Contains("hello"), Contains("world")])
        assert result.passed is True
        assert result.pass_rate == 1.0
        assert len(result.scores) == 2

    def test_partial_pass(self) -> None:
        result = evaluate("hello", [Contains("hello"), Contains("goodbye")])
        assert result.passed is False
        assert result.pass_rate == pytest.approx(0.5)

    def test_all_fail(self) -> None:
        result = evaluate("hello", [ExactMatch("goodbye"), Contains("foo")])
        assert result.passed is False
        assert result.pass_rate == 0.0

    def test_empty_metrics(self) -> None:
        result = evaluate("anything", [])
        assert result.passed is True
        assert result.pass_rate == 1.0
        assert result.scores == []

    def test_scores_included(self) -> None:
        result = evaluate("hello world", [Contains("hello"), Regex(r"\d+")])
        assert result.scores[0].passed is True
        assert result.scores[1].passed is False


class TestBaseline:
    def test_save_and_load(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            result = EvalResult(
                passed=True,
                pass_rate=1.0,
                scores=[MetricScore(name="Contains", passed=True, score=1.0)],
            )
            save_baseline("test-greeting", result, tmpdir)
            loaded = load_baseline("test-greeting", tmpdir)
            assert loaded is not None
            assert loaded.test_name == "test-greeting"
            assert len(loaded.entries) == 1
            assert loaded.entries[0].score == 1.0

    def test_load_returns_none_when_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            assert load_baseline("nonexistent", tmpdir) is None

    def test_compare_no_regression(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            result = EvalResult(
                passed=True,
                pass_rate=1.0,
                scores=[
                    MetricScore(name="Contains", passed=True, score=1.0),
                    MetricScore(name="Regex", passed=True, score=1.0),
                ],
            )
            save_baseline("no-regression", result, tmpdir)
            regression = compare_baseline("no-regression", result, tmpdir)
            assert regression.has_regression is False
            assert regression.regressions == []

    def test_compare_detects_regression(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            baseline_result = EvalResult(
                passed=True,
                pass_rate=1.0,
                scores=[MetricScore(name="Similarity", passed=True, score=0.9)],
            )
            save_baseline("with-regression", baseline_result, tmpdir)

            worse_result = EvalResult(
                passed=False,
                pass_rate=0.0,
                scores=[MetricScore(name="Similarity", passed=False, score=0.5)],
            )
            regression = compare_baseline("with-regression", worse_result, tmpdir)
            assert regression.has_regression is True
            assert len(regression.regressions) == 1
            assert regression.regressions[0].delta == pytest.approx(0.5 - 0.9)

    def test_compare_detects_improvement(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            old_result = EvalResult(
                passed=False,
                pass_rate=0.0,
                scores=[MetricScore(name="Similarity", passed=False, score=0.5)],
            )
            save_baseline("with-improvement", old_result, tmpdir)

            better_result = EvalResult(
                passed=True,
                pass_rate=1.0,
                scores=[MetricScore(name="Similarity", passed=True, score=0.95)],
            )
            regression = compare_baseline("with-improvement", better_result, tmpdir)
            assert regression.has_regression is False
            assert len(regression.improvements) == 1

    def test_compare_with_threshold(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            baseline_result = EvalResult(
                passed=True,
                pass_rate=1.0,
                scores=[MetricScore(name="Similarity", passed=True, score=0.9)],
            )
            save_baseline("threshold-test", baseline_result, tmpdir)

            # Score dropped by 0.05 — within threshold of 0.1 so no regression
            slightly_worse = EvalResult(
                passed=True,
                pass_rate=1.0,
                scores=[MetricScore(name="Similarity", passed=True, score=0.85)],
            )
            regression = compare_baseline("threshold-test", slightly_worse, tmpdir, threshold=0.1)
            assert regression.has_regression is False

    def test_compare_no_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            result = EvalResult(passed=True, pass_rate=1.0, scores=[])
            regression = compare_baseline("missing", result, tmpdir)
            assert regression.has_regression is False
