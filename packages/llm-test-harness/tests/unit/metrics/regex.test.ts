import { describe, it, expect } from 'vitest'
import { Regex } from '../../../src/metrics/regex.js'

describe('Regex', () => {
  it('passes when pattern matches', () => {
    const m = new Regex(/^hello/i)
    expect(m.evaluate('Hello world').pass).toBe(true)
  })

  it('fails when pattern does not match', () => {
    const m = new Regex(/^hello/i)
    expect(m.evaluate('Goodbye world').pass).toBe(false)
  })

  it('accepts string pattern', () => {
    const m = new Regex('^hello', 'i')
    expect(m.evaluate('Hello world').pass).toBe(true)
  })

  it('accepts string pattern without flags', () => {
    const m = new Regex('^hello')
    expect(m.evaluate('hello world').pass).toBe(true)
    expect(m.evaluate('Hello world').pass).toBe(false)
  })

  it('score is 1 when passing, 0 when failing', () => {
    const m = new Regex(/\d+/)
    expect(m.evaluate('answer is 42').score).toBe(1)
    expect(m.evaluate('no numbers').score).toBe(0)
  })

  it('works with complex patterns', () => {
    const m = new Regex(/^\{.*\}$/s)
    expect(m.evaluate('{"key": "value"}').pass).toBe(true)
    expect(m.evaluate('not json').pass).toBe(false)
  })

  it('has name "Regex"', () => {
    expect(new Regex(/x/).name).toBe('Regex')
  })
})
