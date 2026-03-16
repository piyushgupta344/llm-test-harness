from __future__ import annotations

import re

from ..types import MetricFn, MetricScore


class Regex(MetricFn):
    def __init__(self, pattern: str | re.Pattern[str], flags: int = 0) -> None:
        if isinstance(pattern, re.Pattern):
            self._pattern = pattern
        else:
            self._pattern = re.compile(pattern, flags)

    @property
    def name(self) -> str:
        return "Regex"

    def evaluate(self, text: str) -> MetricScore:
        passed = bool(self._pattern.search(text))
        return MetricScore(
            name=self.name,
            passed=passed,
            score=1.0 if passed else 0.0,
        )
