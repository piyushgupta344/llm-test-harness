import type { MetricFn, MetricScore } from '../types.js'

export class ExactMatch implements MetricFn {
  readonly name = 'ExactMatch'

  constructor(
    private expected: string,
    private caseSensitive = true,
  ) {}

  evaluate(text: string): MetricScore {
    const a = this.caseSensitive ? text : text.toLowerCase()
    const b = this.caseSensitive ? this.expected : this.expected.toLowerCase()
    const pass = a === b
    return { name: this.name, pass, score: pass ? 1 : 0 }
  }
}
