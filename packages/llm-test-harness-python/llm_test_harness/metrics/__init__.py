from __future__ import annotations

import re
from typing import Any, Callable

from ..types import MetricScore
from .contains import Contains, ContainsAll
from .custom import Custom
from .exact_match import ExactMatch
from .json_schema import JSONSchema
from .llm_judge import LLMJudge
from .regex import Regex
from .similarity import Similarity


class Metrics:
    """Convenience namespace for constructing metric instances."""

    @staticmethod
    def exact_match(expected: str) -> ExactMatch:
        return ExactMatch(expected)

    @staticmethod
    def contains(substring: str) -> Contains:
        return Contains(substring)

    @staticmethod
    def contains_all(substrings: list[str]) -> ContainsAll:
        return ContainsAll(substrings)

    @staticmethod
    def regex(pattern: str | re.Pattern[str], flags: int = 0) -> Regex:
        return Regex(pattern, flags)

    @staticmethod
    def json_schema(schema: dict[str, Any]) -> JSONSchema:
        return JSONSchema(schema)

    @staticmethod
    def similarity(reference: str, *, threshold: float = 0.8) -> Similarity:
        return Similarity(reference, threshold=threshold)

    @staticmethod
    def llm_judge(rubric: str, client: Any, **kwargs: Any) -> LLMJudge:
        return LLMJudge(rubric, client, **kwargs)

    @staticmethod
    def custom(name: str, fn: Callable[[str], MetricScore]) -> Custom:
        return Custom(name, fn)


__all__ = [
    "Metrics",
    "Contains",
    "ContainsAll",
    "Custom",
    "ExactMatch",
    "JSONSchema",
    "LLMJudge",
    "Regex",
    "Similarity",
]
