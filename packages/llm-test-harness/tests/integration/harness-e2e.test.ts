import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { Harness } from '../../src/harness.js'
import { Metrics } from '../../src/metrics/index.js'
import { CassetteMissError } from '../../src/errors.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-e2e-' + crypto.randomUUID())
}

const ANTHROPIC_RESPONSE = {
  id: 'msg_e2e_001',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text: 'Paris is the capital of France.' }],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn' as const,
  stop_sequence: null,
  usage: { input_tokens: 15, output_tokens: 8 },
}

const OPENAI_RESPONSE = {
  id: 'chatcmpl_e2e_001',
  object: 'chat.completion' as const,
  created: 1700000000,
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: { role: 'assistant' as const, content: 'Hello! How can I help you today?' },
      finish_reason: 'stop' as const,
      logprobs: null,
    },
  ],
  usage: { prompt_tokens: 8, completion_tokens: 9, total_tokens: 17 },
}

describe('End-to-end: record → replay → evaluate', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('full Anthropic record → replay → evaluate flow', async () => {
    const originalCreate = vi.fn().mockResolvedValue(ANTHROPIC_RESPONSE)
    const mockAnthropicClient = { messages: { create: originalCreate } }

    // Step 1: Record
    const recorder = new Harness({ cassettesDir: dir, cassetteName: 'france-capital', mode: 'record' })
    const recording = recorder.wrap(mockAnthropicClient)
    await recording.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      temperature: 0,
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    })
    expect(originalCreate).toHaveBeenCalledOnce()
    expect(fs.existsSync(recorder.cassettePath)).toBe(true)

    // Step 2: Replay
    const replayer = new Harness({ cassettesDir: dir, cassetteName: 'france-capital', mode: 'replay' })
    const replaying = replayer.wrap(mockAnthropicClient)
    const response = await replaying.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      temperature: 0,
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
    })

    expect(originalCreate).toHaveBeenCalledOnce() // still just once
    expect(response.content[0]).toMatchObject({ type: 'text', text: 'Paris is the capital of France.' })

    // Step 3: Evaluate
    const text = response.content[0]?.text ?? ''
    const result = await replayer.evaluate(text, [
      Metrics.contains('Paris'),
      Metrics.contains('France'),
      Metrics.regex(/capital/i),
    ])
    expect(result.pass).toBe(true)
    expect(result.passRate).toBe(1)
  })

  it('full OpenAI record → replay flow', async () => {
    const originalCreate = vi.fn().mockResolvedValue(OPENAI_RESPONSE)
    const mockOpenAIClient = { chat: { completions: { create: originalCreate } } }

    const recorder = new Harness({ cassettesDir: dir, cassetteName: 'openai-greeting', mode: 'record' })
    const recording = recorder.wrap(mockOpenAIClient)
    await recording.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi!' }],
      temperature: 0,
    })

    const replayer = new Harness({ cassettesDir: dir, cassetteName: 'openai-greeting', mode: 'replay' })
    const replaying = replayer.wrap(mockOpenAIClient)
    const result = await replaying.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi!' }],
      temperature: 0,
    })

    expect(originalCreate).toHaveBeenCalledOnce()
    expect(result.choices[0]?.message.content).toBe('Hello! How can I help you today?')
  })

  it('regression baseline: detect score drop', async () => {
    const harness = new Harness({ cassettesDir: dir })

    const baseline = await harness.evaluate('Hello world!', [
      Metrics.contains('Hello'),
      Metrics.regex(/world/),
    ])
    harness.saveBaseline('greeting-test', baseline)

    const degraded = await harness.evaluate('Hlo wrld', [
      Metrics.contains('Hello'),
      Metrics.regex(/world/),
    ])
    const regression = harness.compareBaseline('greeting-test', degraded)
    expect(regression.hasRegression).toBe(true)
    expect(regression.regressions.length).toBeGreaterThan(0)
  })

  it('regression baseline: no regression when scores hold', async () => {
    const harness = new Harness({ cassettesDir: dir })
    const result = await harness.evaluate('Paris is the capital of France.', [
      Metrics.contains('Paris'),
    ])
    harness.saveBaseline('stable', result)

    const same = await harness.evaluate('Paris is the capital of France.', [
      Metrics.contains('Paris'),
    ])
    const regression = harness.compareBaseline('stable', same)
    expect(regression.hasRegression).toBe(false)
  })

  it('hybrid mode: replays when cached, records when miss', async () => {
    const originalCreate = vi.fn().mockResolvedValue(ANTHROPIC_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }
    const params = {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      temperature: 0,
      messages: [{ role: 'user' as const, content: 'What is the capital of France?' }],
    }

    const harness = new Harness({ cassettesDir: dir, cassetteName: 'hybrid', mode: 'hybrid' })
    const client = harness.wrap(mockClient)

    // First call: miss → records
    await client.messages.create(params)
    expect(originalCreate).toHaveBeenCalledTimes(1)

    // Second call: hit → replays
    await client.messages.create(params)
    expect(originalCreate).toHaveBeenCalledTimes(1)
  })

  it('replay mode throws CassetteMissError when cassette not found', async () => {
    const harness = new Harness({ cassettesDir: dir, cassetteName: 'missing', mode: 'replay' })
    const client = harness.wrap({ messages: { create: vi.fn() } })
    await expect(
      client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'Test' }],
      }),
    ).rejects.toThrow(CassetteMissError)
  })
})
