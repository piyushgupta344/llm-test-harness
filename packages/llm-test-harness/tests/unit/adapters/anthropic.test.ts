import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { wrapAnthropicClient } from '../../../src/adapters/anthropic.js'
import { CassetteStore } from '../../../src/cassette/cassette-store.js'
import { hashRequest } from '../../../src/cassette/cassette-hash.js'
import { CassetteMissError, CassetteOverwriteError } from '../../../src/errors.js'
import type { ResolvedHarnessConfig, CassetteRequest } from '../../../src/types.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-adapter-' + crypto.randomUUID())
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
  id: 'msg_mock_001',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text: 'Hello!' }],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn' as const,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 3 },
}

const CREATE_PARAMS = {
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [{ role: 'user' as const, content: 'Say hello.' }],
  temperature: 0.0,
}

function makeNormalizedRequest(): CassetteRequest {
  return {
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    system: null,
    messages: [{ role: 'user', content: 'Say hello.' }],
    params: { max_tokens: 100, temperature: 0.0, top_p: null, stop: null },
    tools: null,
  }
}

describe('wrapAnthropicClient', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('in replay mode returns cassette response without calling original fn', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const normalizedReq = makeNormalizedRequest()
    const hash = hashRequest(normalizedReq)

    store.append({
      id: hash,
      request: normalizedReq,
      response: {
        type: 'message',
        content: [{ type: 'text', text: 'Hello from cassette!' }],
        usage: { input_tokens: 10, output_tokens: 4 },
        stop_reason: 'end_turn',
      },
      metadata: {
        recorded_at: '2026-01-01T00:00:00.000Z',
        duration_ms: 300,
        provider_request_id: 'msg_cassette_001',
      },
    })

    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'replay' }))
    const result = await wrapped.messages.create(CREATE_PARAMS)

    expect(originalCreate).not.toHaveBeenCalled()
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'Hello from cassette!' })
    expect(result.id).toBe('msg_cassette_001')
  })

  it('in replay mode throws CassetteMissError when no match', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const originalCreate = vi.fn()
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'replay' }))
    await expect(wrapped.messages.create(CREATE_PARAMS)).rejects.toThrow(CassetteMissError)
    expect(originalCreate).not.toHaveBeenCalled()
  })

  it('in record mode calls original fn and saves cassette', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'record' }))
    const result = await wrapped.messages.create(CREATE_PARAMS)

    expect(originalCreate).toHaveBeenCalledOnce()
    expect(result).toBe(MOCK_RESPONSE)

    const normalizedReq = makeNormalizedRequest()
    const hash = hashRequest(normalizedReq)
    const saved = store.findById(hash)
    expect(saved).toBeDefined()
    expect(saved?.metadata.provider_request_id).toBe('msg_mock_001')
  })

  it('in passthrough mode calls original fn without saving cassette', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'passthrough' }))
    await wrapped.messages.create(CREATE_PARAMS)

    expect(originalCreate).toHaveBeenCalledOnce()
    expect(store.load().interactions).toHaveLength(0)
  })

  it('in hybrid mode replays when cassette exists', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const normalizedReq = makeNormalizedRequest()
    const hash = hashRequest(normalizedReq)

    store.append({
      id: hash,
      request: normalizedReq,
      response: {
        type: 'message',
        content: [{ type: 'text', text: 'Cached answer' }],
        usage: { input_tokens: 5, output_tokens: 2 },
        stop_reason: 'end_turn',
      },
      metadata: { recorded_at: '2026-01-01T00:00:00.000Z', duration_ms: 50 },
    })

    const originalCreate = vi.fn()
    const mockClient = { messages: { create: originalCreate } }
    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'hybrid' }))

    const result = await wrapped.messages.create(CREATE_PARAMS)
    expect(originalCreate).not.toHaveBeenCalled()
    expect(result.content[0]).toMatchObject({ text: 'Cached answer' })
  })

  it('in hybrid mode records when cassette is missing', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'hybrid' }))
    await wrapped.messages.create(CREATE_PARAMS)

    expect(originalCreate).toHaveBeenCalledOnce()
    expect(store.load().interactions).toHaveLength(1)
  })

  it('noOverwrite throws when cassette already exists', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const normalizedReq = makeNormalizedRequest()
    const hash = hashRequest(normalizedReq)

    store.append({
      id: hash,
      request: normalizedReq,
      response: { type: 'message', content: [{ type: 'text', text: 'Existing' }] },
      metadata: { recorded_at: '2026-01-01T00:00:00.000Z', duration_ms: 50 },
    })

    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(
      mockClient,
      store,
      makeConfig({ mode: 'record', noOverwrite: true }),
    )
    await expect(wrapped.messages.create(CREATE_PARAMS)).rejects.toThrow(CassetteOverwriteError)
  })

  it('onBeforeRecord hook is called before saving', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }
    const hook = vi.fn((i) => ({
      ...i,
      metadata: { ...i.metadata, provider_request_id: 'scrubbed' },
    }))

    const wrapped = wrapAnthropicClient(
      mockClient,
      store,
      makeConfig({ mode: 'record', onBeforeRecord: hook }),
    )
    await wrapped.messages.create(CREATE_PARAMS)

    expect(hook).toHaveBeenCalledOnce()
    const normalizedReq = makeNormalizedRequest()
    const saved = store.findById(hashRequest(normalizedReq))
    expect(saved?.metadata.provider_request_id).toBe('scrubbed')
  })

  it('streaming calls pass through without cassette interception', async () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const streamResponse = { type: 'stream' }
    const originalCreate = vi.fn().mockResolvedValue(streamResponse)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'replay' }))
    const result = await wrapped.messages.create({ ...CREATE_PARAMS, stream: true })

    expect(originalCreate).toHaveBeenCalledOnce()
    expect(result).toBe(streamResponse)
    expect(store.load().interactions).toHaveLength(0)
  })

  it('non-intercepted methods on messages pass through', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const mockStream = vi.fn()
    const mockClient = { messages: { create: vi.fn(), stream: mockStream } }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig())
    expect(wrapped.messages.stream).toBe(mockStream)
  })

  it('non-messages properties on client pass through', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const mockClient = {
      messages: { create: vi.fn() },
      apiKey: 'test-key',
      baseURL: 'https://api.anthropic.com',
    }

    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig())
    expect(wrapped.apiKey).toBe('test-key')
    expect(wrapped.baseURL).toBe('https://api.anthropic.com')
  })

  it('replayed response has correct shape fields', async () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const normalizedReq = makeNormalizedRequest()
    const hash = hashRequest(normalizedReq)

    store.append({
      id: hash,
      request: normalizedReq,
      response: {
        type: 'message',
        content: [{ type: 'text', text: 'Hello!' }],
        usage: { input_tokens: 8, output_tokens: 3 },
        stop_reason: 'end_turn',
      },
      metadata: {
        recorded_at: '2026-01-01T00:00:00.000Z',
        duration_ms: 200,
        provider_request_id: 'msg_shape_test',
      },
    })

    const mockClient = { messages: { create: vi.fn() } }
    const wrapped = wrapAnthropicClient(mockClient, store, makeConfig({ mode: 'replay' }))
    const result = await wrapped.messages.create(CREATE_PARAMS)

    expect(result.type).toBe('message')
    expect(result.role).toBe('assistant')
    expect(result.model).toBe('claude-haiku-4-5-20251001')
    expect(result.stop_reason).toBe('end_turn')
    expect(result.stop_sequence).toBeNull()
    expect(result.usage.input_tokens).toBe(8)
    expect(result.usage.output_tokens).toBe(3)
  })
})
