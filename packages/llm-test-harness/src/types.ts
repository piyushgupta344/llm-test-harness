// ---------------------------------------------------------------------------
// Cassette types
// ---------------------------------------------------------------------------

export type CassetteMode = 'record' | 'replay' | 'passthrough' | 'hybrid'

export type Provider = 'anthropic' | 'openai' | 'http'

export interface CassetteMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CassetteParams {
  temperature?: number | null
  top_p?: number | null
  max_tokens?: number | null
  stop?: string | string[] | null
}

export interface CassetteTool {
  name: string
  description?: string | null
}

export interface CassetteRequest {
  provider: Provider
  model: string
  system?: string | null
  messages: CassetteMessage[]
  params: CassetteParams
  tools?: CassetteTool[] | null
}

export interface CassetteUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
}

export type CassetteResponseType = 'message' | 'stream_chunks' | 'error'

export interface CassetteContentBlock {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export interface CassetteResponse {
  type: CassetteResponseType
  content?: CassetteContentBlock[]
  chunks?: string[]
  usage?: CassetteUsage
  stop_reason?: string
  finish_reason?: string
  error?: { code: string; message: string }
}

export interface CassetteMetadata {
  recorded_at: string
  duration_ms: number
  provider_request_id?: string
}

export interface CassetteInteraction {
  id: string
  request: CassetteRequest
  response: CassetteResponse
  metadata: CassetteMetadata
}

export interface CassetteFile {
  version: 1
  interactions: CassetteInteraction[]
}

// ---------------------------------------------------------------------------
// Harness config
// ---------------------------------------------------------------------------

export interface HarnessConfig {
  cassettesDir: string
  cassetteName?: string
  mode?: CassetteMode
  noOverwrite?: boolean
  onBeforeRecord?: (interaction: CassetteInteraction) => CassetteInteraction
}

export interface ResolvedHarnessConfig {
  cassettesDir: string
  cassetteName: string
  mode: CassetteMode
  noOverwrite: boolean
  onBeforeRecord: (interaction: CassetteInteraction) => CassetteInteraction
}

// ---------------------------------------------------------------------------
// Eval types
// ---------------------------------------------------------------------------

export interface MetricScore {
  name: string
  pass: boolean
  score: number
  reason?: string
}

export interface MetricFn {
  readonly name: string
  evaluate(text: string): MetricScore | Promise<MetricScore>
}

export interface EvalResult {
  pass: boolean
  passRate: number
  scores: MetricScore[]
}

// ---------------------------------------------------------------------------
// Regression / baseline types
// ---------------------------------------------------------------------------

export interface BaselineEntry {
  metricName: string
  score: number
  pass: boolean
}

export interface BaselineSnapshot {
  version: 1
  createdAt: string
  testName: string
  entries: BaselineEntry[]
}

export interface RegressionDetail {
  metricName: string
  baseline: number
  current: number
  delta: number
}

export interface RegressionResult {
  hasRegression: boolean
  regressions: RegressionDetail[]
  improvements: RegressionDetail[]
}
