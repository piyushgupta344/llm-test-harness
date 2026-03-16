import { describe, it, expect } from 'vitest'
import { ExactMatch } from '../../../src/metrics/exact-match.js'

describe('ExactMatch', () => {
  it('passes on exact match', () => {
    const m = new ExactMatch('Hello!')
    const result = m.evaluate('Hello!')
    expect(result.pass).toBe(true)
    expect(result.score).toBe(1)
  })

  it('fails on different text', () => {
    const m = new ExactMatch('Hello!')
    const result = m.evaluate('Hi there!')
    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
  })

  it('is case-sensitive by default', () => {
    const m = new ExactMatch('hello')
    expect(m.evaluate('Hello').pass).toBe(false)
  })

  it('is case-insensitive when configured', () => {
    const m = new ExactMatch('hello', false)
    expect(m.evaluate('HELLO').pass).toBe(true)
    expect(m.evaluate('Hello').pass).toBe(true)
  })

  it('fails on empty string when expected is not empty', () => {
    const m = new ExactMatch('hello')
    expect(m.evaluate('').pass).toBe(false)
  })

  it('passes on empty string when expected is empty', () => {
    const m = new ExactMatch('')
    expect(m.evaluate('').pass).toBe(true)
  })

  it('has name "ExactMatch"', () => {
    expect(new ExactMatch('x').name).toBe('ExactMatch')
  })
})
