"""
Demonstrates all available evaluation metrics.

    python examples/python/eval_metrics.py
"""
import re
from llm_test_harness import Harness, Metrics
from llm_test_harness.types import MetricScore

harness = Harness(cassettes_dir="./cassettes")

# --- ExactMatch ---
exact = harness.evaluate("Hello!", [Metrics.exact_match("Hello!")])
print("ExactMatch:", exact.passed)  # True

# --- Contains ---
contains = harness.evaluate("The capital of France is Paris.", [
    Metrics.contains("Paris"),
    Metrics.contains("capital"),
])
print("Contains:", contains.passed)  # True

# --- ContainsAll ---
contains_all = harness.evaluate("Paris is in France, Europe.", [
    Metrics.contains_all(["Paris", "France", "Europe"]),
])
print("ContainsAll:", contains_all.scores[0].score)  # 1.0

# --- Regex ---
regex = harness.evaluate('{"name": "Alice", "age": 30}', [
    Metrics.regex(r"^\{.*\}$", re.DOTALL),
])
print("Regex:", regex.passed)  # True

# --- JSONSchema ---
json_schema = harness.evaluate('{"name": "Alice", "age": 30}', [
    Metrics.json_schema({
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "age": {"type": "number"},
        },
        "required": ["name", "age"],
    }),
])
print("JSONSchema:", json_schema.passed)  # True

# --- Similarity ---
sim = harness.evaluate("Paris is the capital of France.", [
    Metrics.similarity("Paris is the capital of France.", threshold=0.95),
])
print("Similarity score:", sim.scores[0].score)  # 1.0

# --- Custom ---
def is_number(text: str) -> MetricScore:
    try:
        float(text)
        return MetricScore(name="IsNumber", passed=True, score=1.0)
    except ValueError:
        return MetricScore(name="IsNumber", passed=False, score=0.0)

custom = harness.evaluate("42", [Metrics.custom("IsNumber", is_number)])
print("Custom:", custom.passed)  # True
