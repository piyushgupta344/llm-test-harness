from __future__ import annotations

from ..types import MetricFn, MetricScore


class Contains(MetricFn):
    def __init__(self, substring: str) -> None:
        self._substring = substring

    @property
    def name(self) -> str:
        return "Contains"

    def evaluate(self, text: str) -> MetricScore:
        passed = self._substring in text
        return MetricScore(
            name=self.name,
            passed=passed,
            score=1.0 if passed else 0.0,
        )


class ContainsAll(MetricFn):
    def __init__(self, substrings: list[str]) -> None:
        self._substrings = substrings

    @property
    def name(self) -> str:
        return "ContainsAll"

    def evaluate(self, text: str) -> MetricScore:
        if not self._substrings:
            return MetricScore(name=self.name, passed=True, score=1.0)
        found = sum(1 for s in self._substrings if s in text)
        score = found / len(self._substrings)
        passed = found == len(self._substrings)
        reason = None if passed else f"{found}/{len(self._substrings)} substrings found"
        return MetricScore(name=self.name, passed=passed, score=score, reason=reason)
