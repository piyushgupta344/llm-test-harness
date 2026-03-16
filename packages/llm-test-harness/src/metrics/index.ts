import { ExactMatch } from './exact-match.js'
import { Contains, ContainsAll } from './contains.js'
import { Regex } from './regex.js'
import { JSONSchema } from './json-schema.js'
import { Similarity } from './similarity.js'
import { LLMJudge } from './llm-judge.js'
import type { LLMJudgeOptions } from './llm-judge.js'
import { Custom } from './custom.js'
import type { MetricFn, MetricScore } from '../types.js'

export { ExactMatch, Contains, ContainsAll, Regex, JSONSchema, Similarity, LLMJudge, Custom }
export type { LLMJudgeOptions }

export const Metrics = {
  exactMatch(expected: string, caseSensitive = true): MetricFn {
    return new ExactMatch(expected, caseSensitive)
  },

  contains(substring: string, caseSensitive = true): MetricFn {
    return new Contains(substring, caseSensitive)
  },

  containsAll(substrings: string[], caseSensitive = true): MetricFn {
    return new ContainsAll(substrings, caseSensitive)
  },

  regex(pattern: RegExp | string, flags?: string): MetricFn {
    return new Regex(pattern, flags)
  },

  jsonSchema(schema: Record<string, unknown>): MetricFn {
    return new JSONSchema(schema)
  },

  similarity(reference: string, threshold = 0.8): MetricFn {
    return new Similarity(reference, threshold)
  },

  llmJudge(options: LLMJudgeOptions): MetricFn {
    return new LLMJudge(options)
  },

  custom(name: string, fn: (text: string) => MetricScore | Promise<MetricScore>): MetricFn {
    return new Custom(name, fn)
  },
}
