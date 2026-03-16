from __future__ import annotations

from ..types import MetricFn, MetricScore


def _edit_distance(a: str, b: str) -> int:
    m, n = len(a), len(b)
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                curr[j] = prev[j - 1]
            else:
                curr[j] = 1 + min(prev[j], curr[j - 1], prev[j - 1])
        prev = curr
    return prev[n]


def normalized_similarity(a: str, b: str) -> float:
    if not a and not b:
        return 1.0
    max_len = max(len(a), len(b))
    if max_len == 0:
        return 1.0
    return 1.0 - _edit_distance(a, b) / max_len


class Similarity(MetricFn):
    def __init__(self, reference: str, *, threshold: float = 0.8) -> None:
        self._reference = reference
        self._threshold = threshold

    @property
    def name(self) -> str:
        return "Similarity"

    def evaluate(self, text: str) -> MetricScore:
        score = normalized_similarity(text, self._reference)
        passed = score >= self._threshold
        reason = None if passed else f"Similarity {score:.3f} below threshold {self._threshold}"
        return MetricScore(name=self.name, passed=passed, score=score, reason=reason)
