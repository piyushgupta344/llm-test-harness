import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as crypto from 'node:crypto'
import { CassetteStore } from '../../src/cassette/cassette-store.js'
import type { CassetteInteraction } from '../../src/types.js'

function tmpDir(): string {
  return path.join(os.tmpdir(), 'lth-test-' + crypto.randomUUID())
}

function makeInteraction(id: string): CassetteInteraction {
  return {
    id,
    request: {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      system: null,
      messages: [{ role: 'user', content: 'Hello' }],
      params: { max_tokens: 100, temperature: 0.0, top_p: null, stop: null },
      tools: null,
    },
    response: {
      type: 'message',
      content: [{ type: 'text', text: 'Hi!' }],
      usage: { input_tokens: 5, output_tokens: 2 },
      stop_reason: 'end_turn',
    },
    metadata: {
      recorded_at: '2026-03-16T11:09:00.000Z',
      duration_ms: 100,
      provider_request_id: 'msg_test_001',
    },
  }
}

describe('CassetteStore', () => {
  let dir: string

  beforeEach(() => {
    dir = tmpDir()
  })

  afterEach(() => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('loads an empty cassette when file does not exist', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const data = store.load()
    expect(data.version).toBe(1)
    expect(data.interactions).toEqual([])
  })

  it('finds nothing in an empty store', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    expect(store.findById('sha256:abc')).toBeUndefined()
  })

  it('appends an interaction and persists to disk', () => {
    const filePath = path.join(dir, 'test.yml')
    const store = new CassetteStore(filePath)
    const interaction = makeInteraction('sha256:aaa')
    store.append(interaction)
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('finds an appended interaction by id', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const interaction = makeInteraction('sha256:bbb')
    store.append(interaction)
    const found = store.findById('sha256:bbb')
    expect(found).toBeDefined()
    expect(found?.id).toBe('sha256:bbb')
    expect(found?.response.content?.[0]?.text).toBe('Hi!')
  })

  it('overwrites an existing interaction with the same id', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    const original = makeInteraction('sha256:ccc')
    store.append(original)

    const updated: CassetteInteraction = {
      ...original,
      response: { ...original.response, content: [{ type: 'text', text: 'Updated!' }] },
    }
    store.append(updated)

    const found = store.findById('sha256:ccc')
    expect(found?.response.content?.[0]?.text).toBe('Updated!')
    expect(store.load().interactions).toHaveLength(1)
  })

  it('stores multiple distinct interactions', () => {
    const store = new CassetteStore(path.join(dir, 'test.yml'))
    store.append(makeInteraction('sha256:111'))
    store.append(makeInteraction('sha256:222'))
    store.append(makeInteraction('sha256:333'))
    expect(store.load().interactions).toHaveLength(3)
  })

  it('creates nested directories automatically', () => {
    const deepPath = path.join(dir, 'a', 'b', 'c', 'cassette.yml')
    const store = new CassetteStore(deepPath)
    store.append(makeInteraction('sha256:deep'))
    expect(fs.existsSync(deepPath)).toBe(true)
  })

  it('loads cassette written by a previous store instance', () => {
    const filePath = path.join(dir, 'test.yml')
    const store1 = new CassetteStore(filePath)
    store1.append(makeInteraction('sha256:persist'))

    const store2 = new CassetteStore(filePath)
    const found = store2.findById('sha256:persist')
    expect(found).toBeDefined()
    expect(found?.id).toBe('sha256:persist')
  })

  it('exposes the cassette file path', () => {
    const filePath = path.join(dir, 'named.yml')
    const store = new CassetteStore(filePath)
    expect(store.path).toBe(filePath)
  })
})
