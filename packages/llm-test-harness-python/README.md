# llm-test-harness

Deterministic testing framework for LLM-powered apps — record/replay cassettes, eval scoring, and regression testing.

## Installation

```bash
pip install llm-test-harness
pip install "llm-test-harness[anthropic]"   # with Anthropic support
pip install "llm-test-harness[openai]"       # with OpenAI support
```

## Quick Start

```python
from llm_test_harness import Harness, Metrics
import anthropic

harness = Harness(cassettes_dir='./cassettes', mode='replay')
client = harness.wrap(anthropic.Anthropic())

response = client.messages.create(
    model='claude-haiku-4-5-20251001',
    max_tokens=100,
    messages=[{'role': 'user', 'content': 'Say hello.'}]
)

result = harness.evaluate(response.content[0].text, [
    Metrics.contains('hello'),
])
assert result.passed
```
