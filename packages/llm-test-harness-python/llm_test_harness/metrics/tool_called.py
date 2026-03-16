from __future__ import annotations

import json
from typing import Any, Optional

from ..types import MetricFn, MetricScore


class ToolCalled(MetricFn):
    """Assert the LLM called a specific tool.

    Pass ``JSON.stringify(response.content)`` (or ``json.dumps(...)`` in Python)
    as the evaluated text.

    Example::

        text = json.dumps([b.__dict__ for b in response.content])
        harness.evaluate(text, [Metrics.tool_called("search")])
        harness.evaluate(text, [Metrics.tool_called("search", input_contains="Paris")])
    """

    def __init__(self, tool_name: str, *, input_contains: Optional[str] = None) -> None:
        self._tool_name = tool_name
        self._input_contains = input_contains

    @property
    def name(self) -> str:
        return f"ToolCalled({self._tool_name})"

    def evaluate(self, text: str) -> MetricScore:
        try:
            parsed: Any = json.loads(text)
            blocks: list[Any] = parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            return MetricScore(name=self.name, passed=False, score=0.0, reason="Input is not valid JSON")

        tool_block = next(
            (b for b in blocks if isinstance(b, dict) and b.get("type") == "tool_use" and b.get("name") == self._tool_name),
            None,
        )

        if tool_block is None:
            found = [b.get("name") for b in blocks if isinstance(b, dict) and b.get("type") == "tool_use"]
            reason = (
                f'Tool "{self._tool_name}" not called. Calls found: {", ".join(str(n) for n in found)}'
                if found
                else "No tool calls found in response"
            )
            return MetricScore(name=self.name, passed=False, score=0.0, reason=reason)

        if self._input_contains:
            input_str = json.dumps(tool_block.get("input", ""))
            if self._input_contains not in input_str:
                return MetricScore(
                    name=self.name,
                    passed=False,
                    score=0.5,
                    reason=f'Tool "{self._tool_name}" was called but input does not contain "{self._input_contains}"',
                )

        return MetricScore(name=self.name, passed=True, score=1.0)
