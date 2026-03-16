export { Harness } from './harness.js'
export {
  Metrics,
  ExactMatch,
  Contains,
  ContainsAll,
  Regex,
  JSONSchema,
  Similarity,
  LLMJudge,
  Custom,
} from './metrics/index.js'
export type { LLMJudgeOptions } from './metrics/index.js'
export { normalizedSimilarity } from './metrics/similarity.js'
export { runEval } from './eval/evaluator.js'
export { saveBaseline, compareBaseline } from './eval/baseline.js'
export { hashRequest } from './cassette/cassette-hash.js'
export { CassetteStore } from './cassette/cassette-store.js'

export type {
  HarnessConfig,
  CassetteMode,
  Provider,
  CassetteRequest,
  CassetteResponse,
  CassetteInteraction,
  CassetteFile,
  CassetteMessage,
  CassetteParams,
  CassetteTool,
  CassetteContentBlock,
  CassetteUsage,
  CassetteMetadata,
  MetricFn,
  MetricScore,
  EvalResult,
  BaselineSnapshot,
  BaselineEntry,
  RegressionResult,
  RegressionDetail,
} from './types.js'

export {
  HarnessError,
  CassetteMissError,
  CassetteOverwriteError,
  CassetteWriteError,
  UnsupportedClientError,
} from './errors.js'
