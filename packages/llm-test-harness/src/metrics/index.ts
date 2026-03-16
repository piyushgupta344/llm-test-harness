import { ExactMatch } from './exact-match.js'
import { Contains, ContainsAll } from './contains.js'
import { Regex } from './regex.js'
import { JSONSchema } from './json-schema.js'
import { Similarity } from './similarity.js'
import { LLMJudge } from './llm-judge.js'
import type { LLMJudgeOptions } from './llm-judge.js'
import { Custom } from './custom.js'
import { ToolCalled } from './tool-called.js'
import { JsonPath } from './json-path.js'
import { NotEmpty } from './not-empty.js'
import { WordCount } from './word-count.js'
import type { MetricFn, MetricScore } from '../types.js'

export {
  ExactMatch,
  Contains,
  ContainsAll,
  Regex,
  JSONSchema,
  Similarity,
  LLMJudge,
  Custom,
  ToolCalled,
  JsonPath,
  NotEmpty,
  WordCount,
}
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

  /**
   * Assert the LLM called a specific tool.
   * Pass `JSON.stringify(response.content)` as the evaluated text.
   * @example
   * Metrics.toolCalled('search')
   * Metrics.toolCalled('search', { inputContains: 'Paris' })
   */
  toolCalled(toolName: string, options?: { inputContains?: string }): MetricFn {
    return new ToolCalled(toolName, options)
  },

  /**
   * Assert a value at a dot-notation path in the parsed JSON response.
   * @example
   * Metrics.jsonPath('user.name', 'Alice')
   * Metrics.jsonPath('items.0.id', 42)
   */
  jsonPath(path: string, expected: unknown): MetricFn {
    return new JsonPath(path, expected)
  },

  /**
   * Assert the response is not empty. Optionally enforce a minimum character length.
   * @example
   * Metrics.notEmpty()
   * Metrics.notEmpty({ minLength: 20 })
   */
  notEmpty(options?: { minLength?: number }): MetricFn {
    return new NotEmpty(options)
  },

  /**
   * Assert the response word count is within a range.
   * @example
   * Metrics.wordCount({ min: 10, max: 200 })
   * Metrics.wordCount({ max: 50 }) // enforce conciseness
   */
  wordCount(options: { min?: number; max?: number }): MetricFn {
    return new WordCount(options)
  },
}
