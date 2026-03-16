import { describe, it, expect } from 'vitest'
import { Similarity, normalizedSimilarity } from '../../../src/metrics/similarity.js'

describe('normalizedSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(normalizedSimilarity('hello', 'hello')).toBe(1)
  })

  it('returns 1 for two empty strings', () => {
    expect(normalizedSimilarity('', '')).toBe(1)
  })

  it('returns 0 for maximally different strings', () => {
    // "abc" vs "xyz" — edit distance 3, maxLen 3 → score = 0
    expect(normalizedSimilarity('abc', 'xyz')).toBe(0)
  })

  it('returns a value between 0 and 1 for partially similar strings', () => {
    const s = normalizedSimilarity('hello world', 'hello there')
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  it('is symmetric', () => {
    const s1 = normalizedSimilarity('cat', 'car')
    const s2 = normalizedSimilarity('car', 'cat')
    expect(s1).toBe(s2)
  })

  it('one empty string', () => {
    const s = normalizedSimilarity('', 'hello')
    expect(s).toBe(0)
  })
})

describe('Similarity metric', () => {
  it('passes when similarity meets default threshold (0.8)', () => {
    const m = new Similarity('Hello world')
    const result = m.evaluate('Hello world!')
    expect(result.pass).toBe(true)
  })

  it('fails when similarity is below threshold', () => {
    const m = new Similarity('Hello world', 0.9)
    const result = m.evaluate('Completely different text here')
    expect(result.pass).toBe(false)
    expect(result.score).toBeLessThan(0.9)
  })

  it('score is 1 for identical text', () => {
    const m = new Similarity('exact match')
    const result = m.evaluate('exact match')
    expect(result.score).toBe(1)
    expect(result.pass).toBe(true)
  })

  it('reason is included when failing', () => {
    const m = new Similarity('hello', 0.99)
    const result = m.evaluate('totally different')
    expect(result.pass).toBe(false)
    expect(result.reason).toContain('threshold')
  })

  it('no reason when passing', () => {
    const m = new Similarity('hello world', 0.5)
    // 'hello world' vs 'hello world!' — edit distance 1, maxLen 12, score ≈ 0.917
    const result = m.evaluate('hello world!')
    expect(result.pass).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('custom threshold works', () => {
    const m = new Similarity('abcde', 0.5)
    // 'abcde' vs 'abxxx' — edit distance 3, maxLen 5, score 0.4 — below 0.5
    expect(m.evaluate('abxxx').pass).toBe(false)
  })

  it('has name "Similarity"', () => {
    expect(new Similarity('x').name).toBe('Similarity')
  })
})
