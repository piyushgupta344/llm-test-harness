from __future__ import annotations

import os
from typing import Any, Optional

from .adapters.detect import is_anthropic_client, is_openai_client
from .cassette.store import CassetteStore
from .errors import UnsupportedClientError
from .eval.baseline import compare_baseline, save_baseline
from .eval.evaluator import evaluate
from .types import (
    CassetteMode,
    EvalResult,
    HarnessConfig,
    MetricFn,
    RegressionResult,
)


class Harness:
    def __init__(
        self,
        cassettes_dir: str,
        *,
        cassette_name: str = "cassette",
        mode: CassetteMode = "replay",
        no_overwrite: bool = False,
        on_before_record: Any = None,
    ) -> None:
        self._config = HarnessConfig(
            cassettes_dir=cassettes_dir,
            cassette_name=cassette_name,
            mode=mode,
            no_overwrite=no_overwrite,
            on_before_record=on_before_record,
        )

    def _store(self) -> CassetteStore:
        cassette_file = os.path.join(
            self._config.cassettes_dir, f"{self._config.cassette_name}.yaml"
        )
        return CassetteStore(cassette_file)

    def wrap(self, client: Any) -> Any:
        store = self._store()
        if is_anthropic_client(client):
            from .adapters.anthropic import AnthropicClientProxy
            return AnthropicClientProxy(client, store, self._config)
        if is_openai_client(client):
            from .adapters.openai import OpenAIClientProxy
            return OpenAIClientProxy(client, store, self._config)
        raise UnsupportedClientError()

    def evaluate(self, text: str, metrics: list[MetricFn]) -> EvalResult:
        return evaluate(text, metrics)

    def save_baseline(self, test_name: str, result: EvalResult) -> None:
        save_baseline(test_name, result, self._config.cassettes_dir)

    def compare_baseline(
        self,
        test_name: str,
        result: EvalResult,
        *,
        threshold: float = 0.0,
    ) -> RegressionResult:
        return compare_baseline(test_name, result, self._config.cassettes_dir, threshold)
