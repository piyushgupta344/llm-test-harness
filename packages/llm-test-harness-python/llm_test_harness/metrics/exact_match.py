from __future__ import annotations

from ..types import MetricFn, MetricScore


class ExactMatch(MetricFn):
    def __init__(self, expected: str) -> None:
        self._expected = expected

    @property
    def name(self) -> str:
        return "ExactMatch"

    def evaluate(self, text: str) -> MetricScore:
        passed = text == self._expected
        return MetricScore(
            name=self.name,
            passed=passed,
            score=1.0 if passed else 0.0,
        )
