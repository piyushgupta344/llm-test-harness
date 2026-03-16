import type { MetricFn, MetricScore } from '../types.js'

export class Custom implements MetricFn {
  constructor(
    readonly name: string,
    private fn: (text: string) => MetricScore | Promise<MetricScore>,
  ) {}

  evaluate(text: string): MetricScore | Promise<MetricScore> {
    return this.fn(text)
  }
}
