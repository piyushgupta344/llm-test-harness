"""
Basic replay example — run tests against recorded cassettes, no API key needed.

    python examples/python/basic_replay.py
"""
import anthropic
from llm_test_harness import Harness, Metrics

harness = Harness(
    cassettes_dir="./cassettes",
    cassette_name="capital-question",
    mode="replay",
)

# The API key is never used in replay mode — no network calls are made.
client = harness.wrap(anthropic.Anthropic(api_key="replay-mode-no-key-needed"))

response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=100,
    temperature=0,
    messages=[{"role": "user", "content": "What is the capital of France? Answer in one word."}],
)

text = response.content[0].text if response.content else ""
print("Replayed response:", text)

result = harness.evaluate(text, [
    Metrics.contains("Paris"),
    Metrics.regex(r"^Paris\.?$"),
])

print("Eval result:", result)
# EvalResult(passed=True, pass_rate=1.0, scores=[...])
