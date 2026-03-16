from __future__ import annotations

import re
from typing import Any, Callable, Optional

from ..types import MetricScore
from .contains import Contains, ContainsAll
from .custom import Custom
from .exact_match import ExactMatch
from .json_path import JsonPath
from .json_schema import JSONSchema
from .llm_judge import LLMJudge
from .not_empty import NotEmpty
from .regex import Regex
from .similarity import Similarity
from .tool_called import ToolCalled
from .word_count import WordCount


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

    @staticmethod
    def tool_called(tool_name: str, *, input_contains: Optional[str] = None) -> ToolCalled:
        """Assert the LLM called a specific tool.

        Pass ``json.dumps(response_content)`` as the evaluated text.
        """
        return ToolCalled(tool_name, input_contains=input_contains)

    @staticmethod
    def json_path(path: str, expected: Any) -> JsonPath:
        """Assert a value at a dot-notation path in the parsed JSON response."""
        return JsonPath(path, expected)

    @staticmethod
    def not_empty(*, min_length: int = 1) -> NotEmpty:
        """Assert the response is not empty or whitespace-only."""
        return NotEmpty(min_length=min_length)

    @staticmethod
    def word_count(*, min: int = 0, max: int = 0) -> WordCount:
        """Assert the response word count is within [min, max]."""
        return WordCount(min=min, max=max)


__all__ = [
    "Metrics",
    "Contains",
    "ContainsAll",
    "Custom",
    "ExactMatch",
    "JsonPath",
    "JSONSchema",
    "LLMJudge",
    "NotEmpty",
    "Regex",
    "Similarity",
    "ToolCalled",
    "WordCount",
]
