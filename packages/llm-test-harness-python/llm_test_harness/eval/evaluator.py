from __future__ import annotations

from ..types import EvalResult, MetricFn, MetricScore


def evaluate(text: str, metrics: list[MetricFn]) -> EvalResult:
    scores: list[MetricScore] = []
    for metric in metrics:
        result = metric.evaluate(text)
        scores.append(result)

    if not scores:
        return EvalResult(passed=True, pass_rate=1.0, scores=[])

    passed_count = sum(1 for s in scores if s.passed)
    pass_rate = passed_count / len(scores)
    return EvalResult(
        passed=passed_count == len(scores),
        pass_rate=pass_rate,
        scores=scores,
    )
