from __future__ import annotations

import json
from typing import Any

from ..types import MetricFn, MetricScore


class JSONSchema(MetricFn):
    def __init__(self, schema: dict[str, Any]) -> None:
        self._schema = schema

    @property
    def name(self) -> str:
        return "JSONSchema"

    def evaluate(self, text: str) -> MetricScore:
        import jsonschema

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            return MetricScore(name=self.name, passed=False, score=0.0, reason=f"Invalid JSON: {e}")

        validator = jsonschema.Draft7Validator(self._schema)
        errors = list(validator.iter_errors(data))
        if errors:
            reason = "; ".join(e.message for e in errors[:3])
            return MetricScore(name=self.name, passed=False, score=0.0, reason=reason)

        return MetricScore(name=self.name, passed=True, score=1.0)
