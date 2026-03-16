import type { MetricFn, MetricScore } from '../types.js'

/**
 * Asserts the response is not empty or whitespace-only.
 * Simple but surprisingly useful as a baseline sanity check.
 *
 * @example
 * Metrics.notEmpty()
 * Metrics.notEmpty({ minLength: 10 })
 */
export class NotEmpty implements MetricFn {
  readonly name = 'NotEmpty'
  private minLength: number

  constructor(options?: { minLength?: number }) {
    this.minLength = options?.minLength ?? 1
  }

  evaluate(text: string): MetricScore {
    const trimmed = text.trim()
    const pass = trimmed.length >= this.minLength
    return {
      name: this.name,
      pass,
      score: pass ? 1 : 0,
      reason: pass
        ? undefined
        : this.minLength === 1
          ? 'Response is empty'
          : `Response length ${trimmed.length} is below minimum ${this.minLength}`,
    }
  }
}
