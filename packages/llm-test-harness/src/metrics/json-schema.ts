import Ajv from 'ajv'
import type { MetricFn, MetricScore } from '../types.js'

const ajv = new Ajv({ allErrors: true })

export class JSONSchema implements MetricFn {
  readonly name = 'JSONSchema'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private validate: ReturnType<typeof ajv.compile>

  constructor(schema: Record<string, unknown>) {
    this.validate = ajv.compile(schema)
  }

  evaluate(text: string): MetricScore {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { name: this.name, pass: false, score: 0, reason: 'Output is not valid JSON' }
    }

    const valid = this.validate(parsed)
    if (valid) {
      return { name: this.name, pass: true, score: 1 }
    }

    const reason = this.validate.errors
      ?.map((e) => `${e.instancePath || '(root)'} ${e.message}`)
      .join('; ')
    return { name: this.name, pass: false, score: 0, reason }
  }
}
