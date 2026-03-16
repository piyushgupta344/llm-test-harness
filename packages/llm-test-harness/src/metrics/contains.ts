import type { MetricFn, MetricScore } from '../types.js'

export class Contains implements MetricFn {
  readonly name = 'Contains'

  constructor(
    private substring: string,
    private caseSensitive = true,
  ) {}

  evaluate(text: string): MetricScore {
    const haystack = this.caseSensitive ? text : text.toLowerCase()
    const needle = this.caseSensitive ? this.substring : this.substring.toLowerCase()
    const pass = haystack.includes(needle)
    return { name: this.name, pass, score: pass ? 1 : 0 }
  }
}

export class ContainsAll implements MetricFn {
  readonly name = 'ContainsAll'

  constructor(
    private substrings: string[],
    private caseSensitive = true,
  ) {}

  evaluate(text: string): MetricScore {
    const haystack = this.caseSensitive ? text : text.toLowerCase()
    const found = this.substrings.filter((s) => {
      const needle = this.caseSensitive ? s : s.toLowerCase()
      return haystack.includes(needle)
    })
    const score = this.substrings.length === 0 ? 1 : found.length / this.substrings.length
    const pass = score === 1
    const missing = this.substrings.filter((s) => {
      const needle = this.caseSensitive ? s : s.toLowerCase()
      return !haystack.includes(needle)
    })
    return {
      name: this.name,
      pass,
      score,
      reason: missing.length > 0 ? `Missing: ${missing.map((s) => `"${s}"`).join(', ')}` : undefined,
    }
  }
}
