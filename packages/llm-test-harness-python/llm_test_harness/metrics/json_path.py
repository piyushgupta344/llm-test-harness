from __future__ import annotations

import json
from typing import Any

from ..types import MetricFn, MetricScore


def _resolve_path(obj: Any, path: str) -> tuple[bool, Any]:
    parts = path.split(".")
    current = obj
    for part in parts:
        if current is None:
            return False, None
        if isinstance(current, dict):
            if part not in current:
                return False, None
            current = current[part]
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                return False, None
        else:
            return False, None
    return True, current


class JsonPath(MetricFn):
    """Assert a value at a dot-notation path in the parsed JSON response.

    Example::

        # Response: '{"user": {"name": "Alice", "age": 30}}'
        Metrics.json_path("user.name", "Alice")
        Metrics.json_path("user.age", 30)
        Metrics.json_path("items.0.id", 42)
    """

    def __init__(self, path: str, expected: Any) -> None:
        self._path = path
        self._expected = expected

    @property
    def name(self) -> str:
        return f"JsonPath({self._path})"

    def evaluate(self, text: str) -> MetricScore:
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return MetricScore(name=self.name, passed=False, score=0.0, reason="Input is not valid JSON")

        found, actual = _resolve_path(parsed, self._path)
        if not found:
            return MetricScore(name=self.name, passed=False, score=0.0, reason=f'Path "{self._path}" not found in JSON')

        passed = json.dumps(actual, sort_keys=True) == json.dumps(self._expected, sort_keys=True)
        reason = None if passed else f"Expected {json.dumps(self._expected)}, got {json.dumps(actual)}"
        return MetricScore(name=self.name, passed=passed, score=1.0 if passed else 0.0, reason=reason)
