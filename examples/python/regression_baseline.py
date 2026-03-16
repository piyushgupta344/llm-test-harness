"""
Regression baseline example.

Run once to establish a baseline, then run again to check for regressions.
In a CI pipeline, fail the build if has_regression is True.

    python examples/python/regression_baseline.py
"""
import sys
import anthropic
from llm_test_harness import Harness, Metrics

harness = Harness(
    cassettes_dir="./cassettes",
    cassette_name="capital-question",
    mode="replay",
)

client = harness.wrap(anthropic.Anthropic(api_key="replay-mode-no-key-needed"))

response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=100,
    temperature=0,
    messages=[{"role": "user", "content": "What is the capital of France? Answer in one word."}],
)

text = response.content[0].text if response.content else ""

result = harness.evaluate(text, [
    Metrics.contains("Paris"),
    Metrics.similarity("Paris.", threshold=0.8),
])

# On first run: save the baseline
harness.save_baseline("capital-question", result)
print("Baseline saved.")

# On subsequent runs: compare against baseline
regression = harness.compare_baseline("capital-question", result)
print("Has regression:", regression.has_regression)  # False
if regression.regressions:
    print("Regressions detected:", regression.regressions)
    sys.exit(1)
