import { describe, it, expect, vi } from 'vitest'
import { runEval } from '../../../src/eval/evaluator.js'
import { Contains, ExactMatch } from '../../../src/metrics/index.js'
import type { MetricFn, MetricScore } from '../../../src/types.js'

describe('runEval', () => {
  it('returns pass=true with passRate=1 when all metrics pass', async () => {
    const result = await runEval('hello world', [
      new Contains('hello'),
      new Contains('world'),
    ])
    expect(result.pass).toBe(true)
    expect(result.passRate).toBe(1)
    expect(result.scores).toHaveLength(2)
  })

  it('returns pass=false when any metric fails', async () => {
    const result = await runEval('hello world', [
      new Contains('hello'),
      new Contains('goodbye'),
    ])
    expect(result.pass).toBe(false)
    expect(result.passRate).toBe(0.5)
  })

  it('returns pass=true and passRate=1 with empty metrics', async () => {
    const result = await runEval('any text', [])
    expect(result.pass).toBe(true)
    expect(result.passRate).toBe(1)
    expect(result.scores).toHaveLength(0)
  })

  it('includes all metric scores in result', async () => {
    const result = await runEval('Hello!', [
      new ExactMatch('Hello!'),
      new Contains('Hello'),
    ])
    expect(result.scores[0]?.name).toBe('ExactMatch')
    expect(result.scores[1]?.name).toBe('Contains')
  })

  it('supports async metrics', async () => {
    const asyncMetric: MetricFn = {
      name: 'AsyncMetric',
      evaluate: async (text: string): Promise<MetricScore> => {
        await Promise.resolve()
        return { name: 'AsyncMetric', pass: text.length > 3, score: 1 }
      },
    }
    const result = await runEval('hello', [asyncMetric])
    expect(result.pass).toBe(true)
  })

  it('passRate is 0 when all metrics fail', async () => {
    const result = await runEval('no match', [
      new Contains('abc'),
      new Contains('def'),
    ])
    expect(result.passRate).toBe(0)
    expect(result.pass).toBe(false)
  })
})
