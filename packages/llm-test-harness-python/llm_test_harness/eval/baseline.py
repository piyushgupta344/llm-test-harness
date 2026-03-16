from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Optional

from ..types import BaselineEntry, BaselineSnapshot, EvalResult, RegressionEntry, RegressionResult


def _baseline_path(cassettes_dir: str, test_name: str) -> str:
    return os.path.join(cassettes_dir, ".baselines", f"{test_name}.json")


def save_baseline(test_name: str, result: EvalResult, cassettes_dir: str) -> None:
    path = _baseline_path(cassettes_dir, test_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    entries = [
        BaselineEntry(metric_name=s.name, score=s.score, passed=s.passed)
        for s in result.scores
    ]
    snapshot = BaselineSnapshot(
        version=1,
        created_at=datetime.now(timezone.utc).isoformat(),
        test_name=test_name,
        entries=entries,
    )
    doc = {
        "version": snapshot.version,
        "createdAt": snapshot.created_at,
        "testName": snapshot.test_name,
        "entries": [
            {"metricName": e.metric_name, "score": e.score, "pass": e.passed}
            for e in snapshot.entries
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2)


def load_baseline(test_name: str, cassettes_dir: str) -> Optional[BaselineSnapshot]:
    path = _baseline_path(cassettes_dir, test_name)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        doc = json.load(f)
    entries = [
        BaselineEntry(
            metric_name=e["metricName"],
            score=e["score"],
            passed=e.get("pass", True),
        )
        for e in doc.get("entries", [])
    ]
    return BaselineSnapshot(
        version=doc.get("version", 1),
        created_at=doc.get("createdAt", ""),
        test_name=doc.get("testName", test_name),
        entries=entries,
    )


def compare_baseline(
    test_name: str,
    result: EvalResult,
    cassettes_dir: str,
    threshold: float = 0.0,
) -> RegressionResult:
    baseline = load_baseline(test_name, cassettes_dir)
    if baseline is None:
        return RegressionResult(has_regression=False, regressions=[], improvements=[])

    baseline_map = {e.metric_name: e.score for e in baseline.entries}
    regressions: list[RegressionEntry] = []
    improvements: list[RegressionEntry] = []

    for score in result.scores:
        baseline_score = baseline_map.get(score.name)
        if baseline_score is None:
            continue
        delta = score.score - baseline_score
        entry = RegressionEntry(
            metric_name=score.name,
            baseline_score=baseline_score,
            current_score=score.score,
            delta=delta,
        )
        if delta < -threshold:
            regressions.append(entry)
        elif delta > 0:
            improvements.append(entry)

    return RegressionResult(
        has_regression=len(regressions) > 0,
        regressions=regressions,
        improvements=improvements,
    )
