# llm-test-harness

TypeScript/JavaScript testing framework for LLM-powered apps — VCR-style cassette record/replay, eval scoring, and regression baseline testing.

## Installation

```bash
npm install llm-test-harness
# or
pnpm add llm-test-harness
```

Peer dependencies (install whichever you use):

```bash
npm install @anthropic-ai/sdk   # for Anthropic
npm install openai               # for OpenAI
```

## Quick Start

```typescript
import { Harness, Metrics } from 'llm-test-harness'
import Anthropic from '@anthropic-ai/sdk'

// 1. Create a harness
const harness = new Harness({
  cassettesDir: './cassettes',
  mode: 'replay',              // or 'record', 'hybrid', 'passthrough'
})

// 2. Wrap your client — transparent Proxy, all SDK methods work identically
const client = harness.wrap(new Anthropic())

// 3. Use the client normally
const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Say hello.' }],
})

// 4. Evaluate the output
const result = await harness.evaluate(response.content[0].text, [
  Metrics.contains('hello'),
  Metrics.regex(/^(hello|hi|hey)/i),
  Metrics.similarity('Hello!', { threshold: 0.7 }),
])
expect(result.pass).toBe(true)

// 5. Regression testing
harness.saveBaseline('chat-greeting', result)
const regression = harness.compareBaseline('chat-greeting', result)
expect(regression.hasRegression).toBe(false)
```

## Modes

| Mode | Behaviour |
|------|-----------|
| `replay` | Return cassette response. Throw `CassetteMissError` on miss. |
| `record` | Call real API, save response to cassette, return response. |
| `hybrid` | Return cassette if hit, fall back to `record` on miss. |
| `passthrough` | Call real API, skip cassette entirely. |

## Metrics

| Metric | Description |
|--------|-------------|
| `Metrics.exactMatch(expected)` | Strict equality |
| `Metrics.contains(substr)` | Substring present |
| `Metrics.containsAll(substrs[])` | All substrings present |
| `Metrics.regex(pattern)` | Regex match |
| `Metrics.jsonSchema(schema)` | Valid JSON matching schema (ajv) |
| `Metrics.similarity(ref, opts?)` | Normalized Levenshtein ≥ threshold |
| `Metrics.llmJudge(rubric, client, opts?)` | LLM-as-judge 0–1 score |
| `Metrics.custom(name, fn)` | User-defined metric |

## Cassette Format

Cassettes are YAML files stored at `<cassettesDir>/<cassetteName>.yaml`. The cassette ID is a deterministic SHA-256 hash of the request (provider, model, system, messages, params, tools) — identical to the Python package.

## API Reference

### `new Harness(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cassettesDir` | `string` | required | Directory for cassette files |
| `cassetteName` | `string` | `"cassette"` | YAML filename (without extension) |
| `mode` | `CassetteMode` | `"replay"` | Record/replay mode |
| `noOverwrite` | `boolean` | `false` | Throw if cassette already exists |
| `onBeforeRecord` | `fn` | — | Transform interaction before saving |

### `harness.wrap(client)`

Returns a transparent proxy. Supports `Anthropic` and `OpenAI` clients.

### `harness.evaluate(text, metrics[])`

Returns `EvalResult { pass, passRate, scores[] }`.

### `harness.saveBaseline(testName, result)` / `harness.compareBaseline(testName, result, threshold?)`

Saves / compares metric score snapshots. Returns `RegressionResult { hasRegression, regressions[], improvements[] }`.

### `harness.interceptFetch()`

Monkey-patches `globalThis.fetch` to intercept raw HTTP calls to Anthropic/OpenAI. Returns `{ restore }` to unpatch.

## License

MIT
