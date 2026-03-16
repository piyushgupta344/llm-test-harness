from __future__ import annotations

from ..types import MetricFn, MetricScore


class NotEmpty(MetricFn):
    """Assert the response is not empty or whitespace-only.

    Example::

        Metrics.not_empty()
        Metrics.not_empty(min_length=20)
    """

    def __init__(self, *, min_length: int = 1) -> None:
        self._min_length = min_length

    @property
    def name(self) -> str:
        return "NotEmpty"

    def evaluate(self, text: str) -> MetricScore:
        trimmed = text.strip()
        passed = len(trimmed) >= self._min_length
        if not passed:
            reason = (
                "Response is empty"
                if self._min_length == 1
                else f"Response length {len(trimmed)} is below minimum {self._min_length}"
            )
        else:
            reason = None
        return MetricScore(name=self.name, passed=passed, score=1.0 if passed else 0.0, reason=reason)
