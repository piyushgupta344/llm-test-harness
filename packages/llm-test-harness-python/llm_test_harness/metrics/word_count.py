from __future__ import annotations

from ..types import MetricFn, MetricScore


class WordCount(MetricFn):
    """Assert the response word count falls within a range.

    Example::

        Metrics.word_count(min=10)           # at least 10 words
        Metrics.word_count(max=100)          # enforce conciseness
        Metrics.word_count(min=20, max=200)  # bounded range
    """

    def __init__(self, *, min: int = 0, max: int = 0) -> None:
        self._min = min
        self._max = max if max > 0 else 2 ** 31

    @property
    def name(self) -> str:
        max_str = "∞" if self._max == 2 ** 31 else str(self._max)
        return f"WordCount({self._min}-{max_str})"

    def evaluate(self, text: str) -> MetricScore:
        count = len(text.split()) if text.strip() else 0
        passed = self._min <= count <= self._max
        reason: str | None = None
        if not passed:
            if count < self._min:
                reason = f"{count} words is below minimum {self._min}"
            else:
                reason = f"{count} words exceeds maximum {self._max}"
        return MetricScore(name=self.name, passed=passed, score=1.0 if passed else 0.0, reason=reason)
