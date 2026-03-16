import type { MetricFn, MetricScore } from '../types.js'

export class Regex implements MetricFn {
  readonly name = 'Regex'
  private pattern: RegExp

  constructor(pattern: RegExp | string, flags?: string) {
    this.pattern = pattern instanceof RegExp ? pattern : new RegExp(pattern, flags)
  }

  evaluate(text: string): MetricScore {
    const pass = this.pattern.test(text)
    return { name: this.name, pass, score: pass ? 1 : 0 }
  }
}
