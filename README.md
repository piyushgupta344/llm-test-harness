# llm-test-harness

Deterministic testing framework for LLM-powered apps. Record real API responses once, replay them forever — no flaky tests, no wasted API calls.

## Packages

| Package | Language | Registry |
|---------|----------|----------|
| [`packages/llm-test-harness`](./packages/llm-test-harness) | TypeScript | npm |
| [`packages/llm-test-harness-python`](./packages/llm-test-harness-python) | Python | PyPI |

Both packages use an **identical cassette format** (YAML) and **identical SHA-256 hashing algorithm**, so cassettes recorded in one language can be replayed in the other.

---

## Core Features

- **Record/Replay** — Wrap an Anthropic or OpenAI client. In `record` mode, calls are made and saved to a YAML cassette. In `replay` mode, cassette responses are returned without any network call.
- **Eval Scoring** — Score LLM output against metrics: `ExactMatch`, `Contains`, `ContainsAll`, `Regex`, `JSONSchema`, `Similarity`, `LLMJudge`, `Custom`.
- **Regression Baseline** — Save a snapshot of metric scores; future runs detect score degradation.
- **Cassette Modes** — `record`, `replay`, `passthrough`, `hybrid`.

---

## TypeScript Quick Start

```bash
npm install llm-test-harness
```

```typescript
import { Harness, Metrics } from 'llm-test-harness'
import Anthropic from '@anthropic-ai/sdk'

const harness = new Harness({ cassettesDir: './cassettes', mode: 'replay' })
const client = harness.wrap(new Anthropic())

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Say hello.' }],
})

const result = await harness.evaluate(response.content[0].text, [
  Metrics.contains('hello'),
  Metrics.regex(/^(hello|hi)/i),
])
expect(result.pass).toBe(true)

// Regression testing
harness.saveBaseline('chat-greeting', result)
const regression = harness.compareBaseline('chat-greeting', result)
expect(regression.hasRegression).toBe(false)
```

---

## Python Quick Start

```bash
pip install "llm-test-harness[anthropic]"
```

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
    Metrics.regex(r'^(hello|hi)', flags=re.IGNORECASE),
])
assert result.passed

# Regression testing
harness.save_baseline('chat-greeting', result)
regression = harness.compare_baseline('chat-greeting', result)
assert not regression.has_regression
```

---

## Cassette Format

Cassettes are plain YAML files, human-readable and diffable:

```yaml
version: 1
interactions:
  - id: "sha256:a3f1c2d4..."
    request:
      provider: anthropic
      model: claude-haiku-4-5-20251001
      messages:
        - role: user
          content: Say hello.
      params:
        max_tokens: 100
        temperature: 0.0
    response:
      type: message
      content:
        - type: text
          text: Hello!
      usage:
        input_tokens: 14
        output_tokens: 2
      stop_reason: end_turn
    metadata:
      recorded_at: "2026-03-16T11:09:00.000Z"
      duration_ms: 423
```

---

## Metrics

| Metric | Pass condition | Score |
|--------|---------------|-------|
| `ExactMatch(expected)` | `text === expected` | 1 or 0 |
| `Contains(substr)` | substring present | 1 or 0 |
| `ContainsAll(substrs[])` | all substrings present | found/total |
| `Regex(pattern)` | pattern matches | 1 or 0 |
| `JSONSchema(schema)` | valid JSON + schema passes | 1 or 0 |
| `Similarity(ref, threshold?)` | score ≥ threshold (default 0.8) | normalized Levenshtein |
| `LLMJudge(rubric, client)` | score ≥ threshold (default 0.7) | 0–1 from judge LLM |
| `Custom(name, fn)` | user-defined | user-defined |

---

## Development

```bash
# TypeScript
cd packages/llm-test-harness
pnpm install
pnpm test
pnpm build

# Python
cd packages/llm-test-harness-python
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest tests/ -v
```

---

## License

MIT
