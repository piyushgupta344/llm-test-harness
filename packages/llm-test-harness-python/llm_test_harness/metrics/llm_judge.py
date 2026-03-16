from __future__ import annotations

import json
import re
from typing import Any, Optional

from ..types import MetricFn, MetricScore

_JUDGE_PROMPT = """\
You are an impartial evaluator. Score the following text based on the rubric provided.

Rubric:
{rubric}

Text to evaluate:
{text}

Respond with ONLY a JSON object in this exact format:
{{"score": <float between 0.0 and 1.0>, "reason": "<brief explanation>"}}"""


def _extract_json(raw: str) -> dict[str, Any]:
    """Extract a JSON object from the response text, handling markdown fences."""
    raw = raw.strip()
    # Strip ```json ... ``` or ``` ... ``` fences
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fence:
        raw = fence.group(1).strip()
    # Find first {...} block
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        result: dict[str, Any] = json.loads(match.group())
        return result
    result = json.loads(raw)
    return result


class LLMJudge(MetricFn):
    def __init__(
        self,
        rubric: str,
        client: Any,
        *,
        model: str = "claude-haiku-4-5-20251001",
        threshold: float = 0.7,
    ) -> None:
        self._rubric = rubric
        self._client = client
        self._model = model
        self._threshold = threshold

    @property
    def name(self) -> str:
        return "LLMJudge"

    def evaluate(self, text: str) -> MetricScore:
        prompt = _JUDGE_PROMPT.format(rubric=self._rubric, text=text)
        raw = self._call_judge(prompt)
        try:
            parsed = _extract_json(raw)
            score = float(parsed.get("score", 0.0))
            score = max(0.0, min(1.0, score))
            reason: Optional[str] = parsed.get("reason")
        except (json.JSONDecodeError, ValueError, TypeError):
            score = 0.0
            reason = f"Failed to parse judge response: {raw[:200]}"

        passed = score >= self._threshold
        return MetricScore(name=self.name, passed=passed, score=score, reason=reason)

    def _call_judge(self, prompt: str) -> str:
        # Duck-type: try Anthropic first, then OpenAI
        if hasattr(self._client, "messages"):
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            block = resp.content[0] if resp.content else None
            return block.text if block and hasattr(block, "text") else ""

        if hasattr(self._client, "chat"):
            resp = self._client.chat.completions.create(
                model=self._model,
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
            choice = resp.choices[0] if resp.choices else None
            return choice.message.content or "" if choice else ""

        raise TypeError(f"Unsupported client type for LLMJudge: {type(self._client)}")
