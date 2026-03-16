import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { saveBaseline, compareBaseline } from '../../../src/eval/baseline.js'
import { HarnessError } from '../../../src/errors.js'
import type { EvalResult } from '../../../src/types.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-baseline-' + crypto.randomUUID())
}

function makeResult(scores: Array<{ name: string; score: number }>): EvalResult {
  const metricScores = scores.map((s) => ({ name: s.name, pass: s.score >= 0.8, score: s.score }))
  const passRate = metricScores.filter((s) => s.pass).length / metricScores.length
  return { pass: passRate === 1, passRate, scores: metricScores }
}

describe('saveBaseline / compareBaseline', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
    fs.mkdirSync(dir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('saves a baseline file', () => {
    const result = makeResult([{ name: 'Contains', score: 1.0 }])
    saveBaseline('test-1', result, dir)
    expect(fs.existsSync(path.join(dir, '.baselines', 'test-1.json'))).toBe(true)
  })

  it('baseline file has correct shape', () => {
    const result = makeResult([{ name: 'Regex', score: 0.9 }])
    saveBaseline('test-shape', result, dir)
    const raw = fs.readFileSync(path.join(dir, '.baselines', 'test-shape.json'), 'utf-8')
    const snapshot = JSON.parse(raw)
    expect(snapshot.version).toBe(1)
    expect(snapshot.testName).toBe('test-shape')
    expect(snapshot.entries[0].metricName).toBe('Regex')
    expect(snapshot.entries[0].score).toBe(0.9)
  })

  it('compareBaseline returns no regression when scores are identical', () => {
    const result = makeResult([{ name: 'Contains', score: 1.0 }, { name: 'Regex', score: 0.85 }])
    saveBaseline('identical', result, dir)
    const regression = compareBaseline('identical', result, dir)
    expect(regression.hasRegression).toBe(false)
    expect(regression.regressions).toHaveLength(0)
  })

  it('detects regression when score drops', () => {
    const baseline = makeResult([{ name: 'Similarity', score: 0.92 }])
    saveBaseline('drop', baseline, dir)

    const current = makeResult([{ name: 'Similarity', score: 0.70 }])
    const regression = compareBaseline('drop', current, dir)

    expect(regression.hasRegression).toBe(true)
    expect(regression.regressions).toHaveLength(1)
    expect(regression.regressions[0]?.metricName).toBe('Similarity')
    expect(regression.regressions[0]?.delta).toBeCloseTo(-0.22)
  })

  it('detects improvement when score rises', () => {
    const baseline = makeResult([{ name: 'Regex', score: 0.7 }])
    saveBaseline('improve', baseline, dir)

    const current = makeResult([{ name: 'Regex', score: 0.95 }])
    const regression = compareBaseline('improve', current, dir)

    expect(regression.hasRegression).toBe(false)
    expect(regression.improvements).toHaveLength(1)
    expect(regression.improvements[0]?.delta).toBeCloseTo(0.25)
  })

  it('threshold allows small drops without regression', () => {
    const baseline = makeResult([{ name: 'Contains', score: 0.90 }])
    saveBaseline('threshold', baseline, dir)

    // Score drops by 0.05, but threshold is 0.1 — no regression
    const current = makeResult([{ name: 'Contains', score: 0.85 }])
    const regression = compareBaseline('threshold', current, dir, 0.1)
    expect(regression.hasRegression).toBe(false)
  })

  it('throws HarnessError when no baseline exists', () => {
    const result = makeResult([{ name: 'Regex', score: 1.0 }])
    expect(() => compareBaseline('nonexistent', result, dir)).toThrow(HarnessError)
  })

  it('overwrites an existing baseline', () => {
    const first = makeResult([{ name: 'Contains', score: 0.5 }])
    saveBaseline('overwrite', first, dir)

    const second = makeResult([{ name: 'Contains', score: 0.99 }])
    saveBaseline('overwrite', second, dir)

    const regression = compareBaseline('overwrite', second, dir)
    expect(regression.hasRegression).toBe(false)
  })
})
