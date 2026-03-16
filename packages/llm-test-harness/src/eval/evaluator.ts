import type { EvalResult, MetricFn, MetricScore } from '../types.js'

export async function runEval(text: string, metrics: MetricFn[]): Promise<EvalResult> {
  if (metrics.length === 0) {
    return { pass: true, passRate: 1, scores: [] }
  }

  const scores: MetricScore[] = await Promise.all(
    metrics.map((m) => Promise.resolve(m.evaluate(text))),
  )

  const passed = scores.filter((s) => s.pass).length
  const passRate = passed / scores.length
  const pass = passRate === 1

  return { pass, passRate, scores }
}
