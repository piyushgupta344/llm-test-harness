import * as fs from 'node:fs'
import * as path from 'node:path'
import type { EvalResult, BaselineSnapshot, RegressionResult, RegressionDetail } from '../types.js'
import { HarnessError } from '../errors.js'

function baselinesDir(cassettesDir: string): string {
  return path.join(cassettesDir, '.baselines')
}

function baselinePath(cassettesDir: string, testName: string): string {
  return path.join(baselinesDir(cassettesDir), `${testName}.json`)
}

export function saveBaseline(
  testName: string,
  result: EvalResult,
  cassettesDir: string,
): void {
  const snapshot: BaselineSnapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    testName,
    entries: result.scores.map((s) => ({
      metricName: s.name,
      score: s.score,
      pass: s.pass,
    })),
  }

  const dir = baselinesDir(cassettesDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(baselinePath(cassettesDir, testName), JSON.stringify(snapshot, null, 2))
}

export function compareBaseline(
  testName: string,
  result: EvalResult,
  cassettesDir: string,
  threshold = 0,
): RegressionResult {
  const filePath = baselinePath(cassettesDir, testName)
  if (!fs.existsSync(filePath)) {
    throw new HarnessError(
      `No baseline found for "${testName}". Call saveBaseline() first.`,
    )
  }

  const snapshot: BaselineSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const regressions: RegressionDetail[] = []
  const improvements: RegressionDetail[] = []

  for (const entry of snapshot.entries) {
    const current = result.scores.find((s) => s.name === entry.metricName)
    if (!current) continue

    const delta = current.score - entry.score
    if (delta < -threshold) {
      regressions.push({
        metricName: entry.metricName,
        baseline: entry.score,
        current: current.score,
        delta,
      })
    } else if (delta > threshold) {
      improvements.push({
        metricName: entry.metricName,
        baseline: entry.score,
        current: current.score,
        delta,
      })
    }
  }

  return {
    hasRegression: regressions.length > 0,
    regressions,
    improvements,
  }
}
