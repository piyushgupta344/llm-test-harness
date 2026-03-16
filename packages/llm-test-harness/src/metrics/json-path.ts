import type { MetricFn, MetricScore } from '../types.js'

/**
 * Resolves a dot-notation path (e.g. "user.address.city") in a nested object.
 * Array indices are supported: "items.0.name"
 */
function resolvePath(obj: unknown, path: string): { found: true; value: unknown } | { found: false } {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || current === undefined) return { found: false }
    if (typeof current !== 'object' && !Array.isArray(current)) return { found: false }
    current = (current as Record<string, unknown>)[part]
    if (current === undefined) return { found: false }
  }
  return { found: true, value: current }
}

/**
 * Asserts that parsed JSON at `path` equals `expected`.
 *
 * @example
 * // Response: '{"user": {"name": "Alice", "age": 30}}'
 * Metrics.jsonPath('user.name', 'Alice')
 * Metrics.jsonPath('user.age', 30)
 */
export class JsonPath implements MetricFn {
  readonly name: string
  private path: string
  private expected: unknown

  constructor(path: string, expected: unknown) {
    this.path = path
    this.expected = expected
    this.name = `JsonPath(${path})`
  }

  evaluate(text: string): MetricScore {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        name: this.name,
        pass: false,
        score: 0,
        reason: 'Input is not valid JSON',
      }
    }

    const result = resolvePath(parsed, this.path)
    if (!result.found) {
      return {
        name: this.name,
        pass: false,
        score: 0,
        reason: `Path "${this.path}" not found in JSON`,
      }
    }

    const actual = result.value
    const pass = JSON.stringify(actual) === JSON.stringify(this.expected)
    return {
      name: this.name,
      pass,
      score: pass ? 1 : 0,
      reason: pass ? undefined : `Expected ${JSON.stringify(this.expected)}, got ${JSON.stringify(actual)}`,
    }
  }
}
