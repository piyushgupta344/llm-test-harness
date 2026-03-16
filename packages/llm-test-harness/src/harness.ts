import * as path from 'node:path'
import type {
  HarnessConfig,
  ResolvedHarnessConfig,
  CassetteInteraction,
  EvalResult,
  MetricFn,
  RegressionResult,
} from './types.js'
import { UnsupportedClientError } from './errors.js'
import { CassetteStore } from './cassette/cassette-store.js'
import { isAnthropicClient, isOpenAIClient } from './adapters/detect.js'
import { wrapAnthropicClient } from './adapters/anthropic.js'
import { wrapOpenAIClient } from './adapters/openai.js'
import { createFetchInterceptor } from './adapters/http.js'
import { runEval } from './eval/evaluator.js'
import { saveBaseline, compareBaseline } from './eval/baseline.js'

function resolveConfig(config: HarnessConfig): ResolvedHarnessConfig {
  return {
    cassettesDir: config.cassettesDir,
    cassetteName: config.cassetteName ?? 'cassette',
    mode: config.mode ?? 'replay',
    noOverwrite: config.noOverwrite ?? false,
    onBeforeRecord: config.onBeforeRecord ?? ((i: CassetteInteraction) => i),
  }
}

export class Harness {
  private config: ResolvedHarnessConfig
  private store: CassetteStore

  constructor(config: HarnessConfig) {
    this.config = resolveConfig(config)
    this.store = new CassetteStore(
      path.join(this.config.cassettesDir, this.config.cassetteName + '.yml'),
    )
  }

  get cassettePath(): string {
    return this.store.path
  }

  /**
   * Wraps an Anthropic or OpenAI client with cassette record/replay interception.
   * The returned object is a transparent Proxy — all methods work identically.
   */
  wrap<T extends object>(client: T): T {
    if (isAnthropicClient(client)) {
      return wrapAnthropicClient(client, this.store, this.config)
    }
    if (isOpenAIClient(client)) {
      return wrapOpenAIClient(client, this.store, this.config)
    }
    throw new UnsupportedClientError()
  }

  /**
   * Monkey-patches globalThis.fetch to intercept calls to known LLM API hostnames.
   * Returns a cleanup function that restores the original fetch.
   *
   * @example
   * const restore = harness.interceptFetch()
   * try { ... } finally { restore() }
   */
  interceptFetch(): () => void {
    const { intercept, restore } = createFetchInterceptor(this.store, this.config)
    intercept()
    return restore
  }

  /**
   * Evaluates LLM output text against one or more metrics.
   */
  async evaluate(text: string, metrics: MetricFn[]): Promise<EvalResult> {
    return runEval(text, metrics)
  }

  /**
   * Saves the current EvalResult as a named baseline snapshot.
   * Stored at <cassettesDir>/.baselines/<testName>.json
   */
  saveBaseline(testName: string, result: EvalResult): void {
    saveBaseline(testName, result, this.config.cassettesDir)
  }

  /**
   * Compares an EvalResult against a saved baseline, returning regression details.
   * A regression is detected when current.score < baseline.score - threshold.
   */
  compareBaseline(testName: string, result: EvalResult, threshold = 0): RegressionResult {
    return compareBaseline(testName, result, this.config.cassettesDir, threshold)
  }
}
