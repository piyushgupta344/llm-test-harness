import type { MetricFn, MetricScore } from '../types.js'

/**
 * Asserts the response falls within a word count range.
 * Useful for checking verbosity (LLMs can be too brief or too verbose).
 *
 * @example
 * Metrics.wordCount({ min: 20 })         // at least 20 words
 * Metrics.wordCount({ max: 100 })        // no more than 100 words
 * Metrics.wordCount({ min: 10, max: 50}) // between 10 and 50 words
 */
export class WordCount implements MetricFn {
  readonly name: string
  private min: number
  private max: number

  constructor(options: { min?: number; max?: number }) {
    this.min = options.min ?? 0
    this.max = options.max ?? Infinity
    this.name = `WordCount(${this.min}-${this.max === Infinity ? '∞' : this.max})`
  }

  evaluate(text: string): MetricScore {
    const count = text.trim() === '' ? 0 : text.trim().split(/\s+/).length
    const pass = count >= this.min && count <= this.max

    let reason: string | undefined
    if (!pass) {
      if (count < this.min) reason = `${count} words is below minimum ${this.min}`
      else reason = `${count} words exceeds maximum ${this.max}`
    }

    return { name: this.name, pass, score: pass ? 1 : 0, reason }
  }
}
