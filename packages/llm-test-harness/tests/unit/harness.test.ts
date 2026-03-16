import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { Harness } from '../../src/harness.js'
import { Metrics } from '../../src/metrics/index.js'
import { CassetteMissError, UnsupportedClientError } from '../../src/errors.js'
import { hashRequest } from '../../src/cassette/cassette-hash.js'
import { CassetteStore } from '../../src/cassette/cassette-store.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-harness-' + crypto.randomUUID())
}

const MOCK_RESPONSE = {
  id: 'msg_harness_001',
  type: 'message' as const,
  role: 'assistant' as const,
  content: [{ type: 'text' as const, text: 'Hello from the model!' }],
  model: 'claude-haiku-4-5-20251001',
  stop_reason: 'end_turn' as const,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
}

const CREATE_PARAMS = {
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [{ role: 'user' as const, content: 'Say hello.' }],
  temperature: 0.0,
}

describe('Harness', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('exposes cassettePath', () => {
    const harness = new Harness({ cassettesDir: dir, cassetteName: 'test' })
    expect(harness.cassettePath).toBe(path.join(dir, 'test.yml'))
  })

  it('defaults cassetteName to "cassette"', () => {
    const harness = new Harness({ cassettesDir: dir })
    expect(harness.cassettePath).toBe(path.join(dir, 'cassette.yml'))
  })

  it('throws UnsupportedClientError for unknown client types', () => {
    const harness = new Harness({ cassettesDir: dir, mode: 'record' })
    expect(() => harness.wrap({ someOtherClient: true })).toThrow(UnsupportedClientError)
  })

  it('wraps an anthropic-shaped client', async () => {
    const harness = new Harness({ cassettesDir: dir, cassetteName: 'wrap-test', mode: 'record' })
    const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    const mockClient = { messages: { create: originalCreate } }

    const wrapped = harness.wrap(mockClient)
    await wrapped.messages.create(CREATE_PARAMS)

    expect(originalCreate).toHaveBeenCalledOnce()
    expect(fs.existsSync(harness.cassettePath)).toBe(true)
  })

  describe('evaluate', () => {
    it('returns pass=true when all metrics pass', async () => {
      const harness = new Harness({ cassettesDir: dir })
      const result = await harness.evaluate('Hello world!', [
        Metrics.contains('Hello'),
        Metrics.regex(/world/),
      ])
      expect(result.pass).toBe(true)
      expect(result.passRate).toBe(1)
    })

    it('returns pass=false when any metric fails', async () => {
      const harness = new Harness({ cassettesDir: dir })
      const result = await harness.evaluate('Hello', [
        Metrics.contains('Hello'),
        Metrics.contains('world'),
      ])
      expect(result.pass).toBe(false)
      expect(result.passRate).toBe(0.5)
    })
  })

  describe('end-to-end record → replay', () => {
    it('records a response then replays it without calling the API', async () => {
      const originalCreate = vi.fn().mockResolvedValue(MOCK_RESPONSE)
      const mockClient = { messages: { create: originalCreate } }

      // Record
      const recorder = new Harness({
        cassettesDir: dir,
        cassetteName: 'e2e',
        mode: 'record',
      })
      const recordingClient = recorder.wrap(mockClient)
      await recordingClient.messages.create(CREATE_PARAMS)
      expect(originalCreate).toHaveBeenCalledOnce()

      // Replay
      const replayer = new Harness({
        cassettesDir: dir,
        cassetteName: 'e2e',
        mode: 'replay',
      })
      const replayingClient = replayer.wrap(mockClient)
      const result = await replayingClient.messages.create(CREATE_PARAMS)

      expect(originalCreate).toHaveBeenCalledOnce() // still just once
      expect(result.content[0]).toMatchObject({ type: 'text', text: 'Hello from the model!' })
    })

    it('throws in replay mode when no cassette was recorded', async () => {
      const harness = new Harness({ cassettesDir: dir, cassetteName: 'missing', mode: 'replay' })
      const mockClient = { messages: { create: vi.fn() } }
      const wrapped = harness.wrap(mockClient)
      await expect(wrapped.messages.create(CREATE_PARAMS)).rejects.toThrow(CassetteMissError)
    })
  })
})
