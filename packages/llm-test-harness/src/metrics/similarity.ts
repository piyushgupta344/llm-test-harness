import type { MetricFn, MetricScore } from '../types.js'

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = []

  for (let i = 0; i <= m; i++) {
    dp[i] = []
    for (let j = 0; j <= n; j++) {
      if (i === 0) {
        dp[i]![j] = j
      } else if (j === 0) {
        dp[i]![j] = i
      } else if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!)
      }
    }
  }

  return dp[m]![n]!
}

/**
 * Normalized Levenshtein similarity: 1 - (editDistance / maxLength).
 * Returns 1 for identical strings, 0 for maximally different strings.
 */
export function normalizedSimilarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

export class Similarity implements MetricFn {
  readonly name = 'Similarity'

  constructor(
    private reference: string,
    private threshold = 0.8,
  ) {}

  evaluate(text: string): MetricScore {
    const score = normalizedSimilarity(text, this.reference)
    const pass = score >= this.threshold
    return {
      name: this.name,
      pass,
      score,
      reason: pass
        ? undefined
        : `Similarity ${score.toFixed(3)} is below threshold ${this.threshold}`,
    }
  }
}
