import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { wrapOpenAIClient } from '../../../src/adapters/openai.js'
import { CassetteStore } from '../../../src/cassette/cassette-store.js'
import { hashRequest } from '../../../src/cassette/cassette-hash.js'
import { CassetteMissError } from '../../../src/errors.js'
import type { ResolvedHarnessConfig, CassetteRequest } from '../../../src/types.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-openai-' + crypto.randomUUID())
}

function makeConfig(overrides: Partial<ResolvedHarnessConfig> = {}): ResolvedHarnessConfig {
  return {
    cassettesDir: '/tmp',
    cassetteName: 'cassette',
    mode: 'replay',
    noOverwrite: false,
    onBeforeRecord: (i) => i,
    ...overrides,
  }
}

const MOCK_RESPONSE = {
  id: 'chatcmpl_mock_001',
  object: 'chat.completion' as const,
  created: 1700000000,
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: { role: 'assistant' as const, content: 'Hello from OpenAI!' },
      finish_reason: 'stop' as const,
      logprobs: null,
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
}

const CREATE_PARAMS = {
  model: 'gpt-4o-mini',
  max_tokens: 100,
  temperature: 0.0,
  messages: [{ role: 'user' as const, content: 'Say hello.' }],
}

function makeNormalizedRequest(): CassetteRequest {
  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    system: null,
    messages: [{ role: 'user', content: 'Say hello.' }],
    params: { max_tokens: 100, temperature: 0.0, top_p: null, stop: null },
    tools: null,
  }
}

describe('wrapOpenAIClient', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('in replay mode returns cassette response without calling original', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const req = makeNormalizedRequest()
    const hash = hashRequest(req)

    store.append({
      id: hash,
      request: req,
      response: {
        type: 'message',
        content: [{ type: 'text', text: 'Hello from cassette!' }],
        usage: { input_tokens: 8, output_tokens: 4 },
        finish_reason: 'stop',
      },
      metadata: {
        recorded_at: '2026-01-01T00:00:00.000Z',
        duration_ms: 200,
        provider_request_id: 'chatcmpl_cassette_001',
      },
    })

    const originalCreate = vi.fn()
    const mockClient = { chat: { completions: { create: originalCreate } } }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig({ mode: 'replay' }))

    const result = await wrapped.chat.completions.create(CREATE_PARAMS)
    expect(originalCreate).not.toHaveBeenCalled()
    expect(result.choices[0]?.message.content).toBe('Hello from cassette!')
    expect(result.id).toBe('chatcmpl_cassette_001')
  })

  it('in replay mode throws CassetteMissError when no match', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const mockClient = { chat: { completions: { create: vi.fn() } } }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig({ mode: 'replay' }))
    await expect(wrapped.chat.completions.create(CREATE_PARAMS)).rejects.toThrow(CassetteMissError)
  })

  it('in record mode calls original and saves cassette', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { chat: { completions: { create: originalCreate } } }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig({ mode: 'record' }))

    const result = await wrapped.chat.completions.create(CREATE_PARAMS)
    expect(originalCreate).toHaveBeenCalledOnce()
    expect(result).toBe(MOCK_RESPONSE)

    const saved = store.findById(hashRequest(makeNormalizedRequest()))
    expect(saved).toBeDefined()
    expect(saved?.metadata.provider_request_id).toBe('chatcmpl_mock_001')
    expect(saved?.response.usage?.input_tokens).toBe(10)
    expect(saved?.response.usage?.output_tokens).toBe(4)
  })

  it('extracts system message from messages array', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { chat: { completions: { create: originalCreate } } }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig({ mode: 'record' }))

    await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
      ],
    })

    const allInteractions = store.load().interactions
    expect(allInteractions[0]?.request.system).toBe('You are helpful.')
    expect(allInteractions[0]?.request.messages).toHaveLength(1)
    expect(allInteractions[0]?.request.messages[0]?.role).toBe('user')
  })

  it('replayed response has correct OpenAI shape', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const req = makeNormalizedRequest()
    const hash = hashRequest(req)
    store.append({
      id: hash,
      request: req,
      response: {
        type: 'message',
        content: [{ type: 'text', text: 'Hi!' }],
        usage: { input_tokens: 5, output_tokens: 2, total_tokens: 7 },
        finish_reason: 'stop',
      },
      metadata: {
        recorded_at: '2026-01-01T00:00:00.000Z',
        duration_ms: 150,
        provider_request_id: 'chatcmpl_shape',
      },
    })

    const mockClient = { chat: { completions: { create: vi.fn() } } }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig({ mode: 'replay' }))
    const result = await wrapped.chat.completions.create(CREATE_PARAMS)

    expect(result.object).toBe('chat.completion')
    expect(result.choices[0]?.message.role).toBe('assistant')
    expect(result.usage.prompt_tokens).toBe(5)
    expect(result.usage.completion_tokens).toBe(2)
  })

  it('streaming passes through without interception', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const streamResult = Symbol('stream')
    const originalCreate = vi.fn().mockResolvedValue(streamResult)
    const mockClient = { chat: { completions: { create: originalCreate } } }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig({ mode: 'replay' }))

    const result = await wrapped.chat.completions.create({ ...CREATE_PARAMS, stream: true })
    expect(originalCreate).toHaveBeenCalledOnce()
    expect(result).toBe(streamResult)
  })

  it('non-intercepted properties pass through', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const mockClient = {
      chat: { completions: { create: vi.fn() } },
      apiKey: 'test-openai-key',
      models: { list: vi.fn() },
    }
    const wrapped = wrapOpenAIClient(mockClient, store, makeConfig())
    expect(wrapped.apiKey).toBe('test-openai-key')
    expect(wrapped.models).toBeDefined()
  })
})
