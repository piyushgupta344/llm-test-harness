from __future__ import annotations

from typing import Callable

from ..types import MetricFn, MetricScore


class Custom(MetricFn):
    def __init__(self, name: str, fn: Callable[[str], MetricScore]) -> None:
        self._name = name
        self._fn = fn

    @property
    def name(self) -> str:
        return self._name

    def evaluate(self, text: str) -> MetricScore:
        return self._fn(text)
