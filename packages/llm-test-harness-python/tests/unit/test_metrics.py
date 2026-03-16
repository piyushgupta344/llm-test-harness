"""Unit tests for all metric implementations."""
from __future__ import annotations

import re

import pytest

from llm_test_harness.metrics import (
    Contains,
    ContainsAll,
    Custom,
    ExactMatch,
    JSONSchema,
    Metrics,
    Regex,
    Similarity,
)
from llm_test_harness.types import MetricScore


# ---------------------------------------------------------------------------
# ExactMatch
# ---------------------------------------------------------------------------

class TestExactMatch:
    def test_pass_on_exact(self) -> None:
        r = ExactMatch("hello").evaluate("hello")
        assert r.passed is True
        assert r.score == 1.0

    def test_fail_on_different(self) -> None:
        r = ExactMatch("hello").evaluate("Hello")
        assert r.passed is False
        assert r.score == 0.0

    def test_name(self) -> None:
        assert ExactMatch("x").name == "ExactMatch"


# ---------------------------------------------------------------------------
# Contains
# ---------------------------------------------------------------------------

class TestContains:
    def test_pass_when_present(self) -> None:
        r = Contains("world").evaluate("hello world")
        assert r.passed is True
        assert r.score == 1.0

    def test_fail_when_absent(self) -> None:
        r = Contains("foo").evaluate("hello world")
        assert r.passed is False
        assert r.score == 0.0

    def test_name(self) -> None:
        assert Contains("x").name == "Contains"


class TestContainsAll:
    def test_all_present(self) -> None:
        r = ContainsAll(["hello", "world"]).evaluate("say hello world")
        assert r.passed is True
        assert r.score == 1.0

    def test_partial(self) -> None:
        r = ContainsAll(["hello", "world", "foo", "bar"]).evaluate("say hello and foo here")
        assert r.passed is False
        assert r.score == pytest.approx(0.5)

    def test_empty_substrings(self) -> None:
        r = ContainsAll([]).evaluate("anything")
        assert r.passed is True
        assert r.score == 1.0

    def test_name(self) -> None:
        assert ContainsAll([]).name == "ContainsAll"


# ---------------------------------------------------------------------------
# Regex
# ---------------------------------------------------------------------------

class TestRegex:
    def test_pass_on_match(self) -> None:
        r = Regex(r"\d+").evaluate("there are 42 items")
        assert r.passed is True
        assert r.score == 1.0

    def test_fail_no_match(self) -> None:
        r = Regex(r"\d+").evaluate("no numbers here")
        assert r.passed is False
        assert r.score == 0.0

    def test_case_insensitive(self) -> None:
        r = Regex(r"hello", re.IGNORECASE).evaluate("HELLO world")
        assert r.passed is True

    def test_compiled_pattern(self) -> None:
        pat = re.compile(r"^hello", re.IGNORECASE)
        r = Regex(pat).evaluate("Hello world")
        assert r.passed is True

    def test_name(self) -> None:
        assert Regex(r"x").name == "Regex"


# ---------------------------------------------------------------------------
# JSONSchema
# ---------------------------------------------------------------------------

class TestJSONSchema:
    def test_valid_json(self) -> None:
        schema = {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}
        r = JSONSchema(schema).evaluate('{"name": "Alice"}')
        assert r.passed is True
        assert r.score == 1.0

    def test_invalid_json(self) -> None:
        r = JSONSchema({"type": "object"}).evaluate("not json")
        assert r.passed is False
        assert "Invalid JSON" in (r.reason or "")

    def test_schema_violation(self) -> None:
        schema = {"type": "object", "required": ["name"]}
        r = JSONSchema(schema).evaluate('{"age": 30}')
        assert r.passed is False
        assert r.score == 0.0

    def test_name(self) -> None:
        assert JSONSchema({}).name == "JSONSchema"


# ---------------------------------------------------------------------------
# Similarity
# ---------------------------------------------------------------------------

class TestSimilarity:
    def test_identical(self) -> None:
        r = Similarity("hello world").evaluate("hello world")
        assert r.passed is True
        assert r.score == pytest.approx(1.0)

    def test_similar_above_threshold(self) -> None:
        r = Similarity("hello world", threshold=0.5).evaluate("hello world!")
        assert r.passed is True
        assert r.score > 0.5

    def test_very_different_below_threshold(self) -> None:
        r = Similarity("hello", threshold=0.8).evaluate("completely different text here")
        assert r.passed is False

    def test_reason_when_failing(self) -> None:
        r = Similarity("hello", threshold=0.9).evaluate("world")
        assert r.passed is False
        assert r.reason is not None

    def test_no_reason_when_passing(self) -> None:
        r = Similarity("hello world", threshold=0.5).evaluate("hello world!")
        if r.passed:
            assert r.reason is None

    def test_name(self) -> None:
        assert Similarity("x").name == "Similarity"


# ---------------------------------------------------------------------------
# Custom
# ---------------------------------------------------------------------------

class TestCustom:
    def test_custom_function(self) -> None:
        def check(text: str) -> MetricScore:
            return MetricScore(name="MyMetric", passed=len(text) > 5, score=1.0 if len(text) > 5 else 0.0)

        r = Custom("MyMetric", check).evaluate("hello world")
        assert r.passed is True

    def test_name(self) -> None:
        assert Custom("Foo", lambda t: MetricScore(name="Foo", passed=True, score=1.0)).name == "Foo"


# ---------------------------------------------------------------------------
# Metrics namespace
# ---------------------------------------------------------------------------

class TestMetricsNamespace:
    def test_contains(self) -> None:
        assert isinstance(Metrics.contains("x"), Contains)

    def test_contains_all(self) -> None:
        assert isinstance(Metrics.contains_all(["x"]), ContainsAll)

    def test_exact_match(self) -> None:
        assert isinstance(Metrics.exact_match("x"), ExactMatch)

    def test_regex(self) -> None:
        assert isinstance(Metrics.regex(r"x"), Regex)

    def test_similarity(self) -> None:
        assert isinstance(Metrics.similarity("x"), Similarity)

    def test_json_schema(self) -> None:
        assert isinstance(Metrics.json_schema({}), JSONSchema)
