import { describe, it, expect } from 'vitest'
import { Contains, ContainsAll } from '../../../src/metrics/contains.js'

describe('Contains', () => {
  it('passes when text contains substring', () => {
    const m = new Contains('hello')
    expect(m.evaluate('say hello world').pass).toBe(true)
  })

  it('fails when text does not contain substring', () => {
    const m = new Contains('goodbye')
    expect(m.evaluate('hello world').pass).toBe(false)
  })

  it('is case-sensitive by default', () => {
    const m = new Contains('Hello')
    expect(m.evaluate('say hello').pass).toBe(false)
  })

  it('is case-insensitive when configured', () => {
    const m = new Contains('Hello', false)
    expect(m.evaluate('say HELLO').pass).toBe(true)
  })

  it('score is 1 when passing, 0 when failing', () => {
    const m = new Contains('hi')
    expect(m.evaluate('hi there').score).toBe(1)
    expect(m.evaluate('bye').score).toBe(0)
  })

  it('has name "Contains"', () => {
    expect(new Contains('x').name).toBe('Contains')
  })
})

describe('ContainsAll', () => {
  it('passes when all substrings are present', () => {
    const m = new ContainsAll(['hello', 'world'])
    expect(m.evaluate('hello beautiful world').pass).toBe(true)
  })

  it('fails when any substring is missing', () => {
    const m = new ContainsAll(['hello', 'world'])
    const result = m.evaluate('hello there')
    expect(result.pass).toBe(false)
    expect(result.score).toBe(0.5)
  })

  it('score is proportional to found substrings', () => {
    const m = new ContainsAll(['hello', 'world', 'foo', 'bar'])
    const result = m.evaluate('say hello and foo here')
    expect(result.score).toBe(0.5)
  })

  it('passes with empty substrings list', () => {
    const m = new ContainsAll([])
    expect(m.evaluate('anything').pass).toBe(true)
    expect(m.evaluate('anything').score).toBe(1)
  })

  it('includes missing substrings in reason', () => {
    const m = new ContainsAll(['hello', 'world'])
    const result = m.evaluate('hello only')
    expect(result.reason).toContain('"world"')
  })

  it('has name "ContainsAll"', () => {
    expect(new ContainsAll([]).name).toBe('ContainsAll')
  })
})
