import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as crypto from 'node:crypto'
import { findInteraction, requireInteraction } from '../../src/cassette/cassette-match.js'
import { CassetteStore } from '../../src/cassette/cassette-store.js'
import { hashRequest } from '../../src/cassette/cassette-hash.js'
import { CassetteMissError } from '../../src/errors.js'
import type { CassetteRequest } from '../../src/types.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-match-' + crypto.randomUUID())
}

const testRequest: CassetteRequest = {
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  system: null,
  messages: [{ role: 'user', content: 'Say hello.' }],
  params: { max_tokens: 100, temperature: 0.0, top_p: null, stop: null },
  tools: null,
}

describe('findInteraction', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('returns undefined when store is empty', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    expect(findInteraction(store, testRequest)).toBeUndefined()
  })

  it('returns the interaction when it matches', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const hash = hashRequest(testRequest)
    store.append({
      id: hash,
      request: testRequest,
      response: { type: 'message', content: [{ type: 'text', text: 'Hello!' }] },
      metadata: { recorded_at: '2026-01-01T00:00:00.000Z', duration_ms: 50 },
    })

    const found = findInteraction(store, testRequest)
    expect(found).toBeDefined()
    expect(found?.id).toBe(hash)
  })

  it('returns undefined for a different request', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const hash = hashRequest(testRequest)
    store.append({
      id: hash,
      request: testRequest,
      response: { type: 'message', content: [{ type: 'text', text: 'Hello!' }] },
      metadata: { recorded_at: '2026-01-01T00:00:00.000Z', duration_ms: 50 },
    })

    const differentRequest: CassetteRequest = { ...testRequest, model: 'claude-opus-4-6' }
    expect(findInteraction(store, differentRequest)).toBeUndefined()
  })
})

describe('requireInteraction', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('returns the interaction when it exists', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const hash = hashRequest(testRequest)
    store.append({
      id: hash,
      request: testRequest,
      response: { type: 'message', content: [{ type: 'text', text: 'Hello!' }] },
      metadata: { recorded_at: '2026-01-01T00:00:00.000Z', duration_ms: 50 },
    })

    const found = requireInteraction(store, testRequest)
    expect(found.id).toBe(hash)
  })

  it('throws CassetteMissError when not found', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    expect(() => requireInteraction(store, testRequest)).toThrow(CassetteMissError)
  })

  it('CassetteMissError contains the hash', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const hash = hashRequest(testRequest)
    try {
      requireInteraction(store, testRequest)
    } catch (e) {
      expect(e).toBeInstanceOf(CassetteMissError)
      expect((e as CassetteMissError).hash).toBe(hash)
    }
  })
})
