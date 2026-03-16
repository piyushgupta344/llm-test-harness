import { describe, it, expect } from 'vitest'
import { hashRequest } from '../../src/cassette/cassette-hash.js'
import type { CassetteRequest } from '../../src/types.js'

const baseRequest: CassetteRequest = {
  provider: 'anthropic',
  model: 'claude-haiku-4-5-20251001',
  system: null,
  messages: [{ role: 'user', content: 'Say hello.' }],
  params: { max_tokens: 100, temperature: 0.0, top_p: null, stop: null },
  tools: null,
}

describe('hashRequest', () => {
  it('produces a sha256: prefixed string', () => {
    const hash = hashRequest(baseRequest)
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('is deterministic — same input produces same hash', () => {
    const h1 = hashRequest(baseRequest)
    const h2 = hashRequest({ ...baseRequest })
    expect(h1).toBe(h2)
  })

  it('different models produce different hashes', () => {
    const h1 = hashRequest(baseRequest)
    const h2 = hashRequest({ ...baseRequest, model: 'claude-opus-4-6' })
    expect(h1).not.toBe(h2)
  })

  it('different messages produce different hashes', () => {
    const h1 = hashRequest(baseRequest)
    const h2 = hashRequest({
      ...baseRequest,
      messages: [{ role: 'user', content: 'Different content' }],
    })
    expect(h1).not.toBe(h2)
  })

  it('different providers produce different hashes', () => {
    const h1 = hashRequest(baseRequest)
    const h2 = hashRequest({ ...baseRequest, provider: 'openai' })
    expect(h1).not.toBe(h2)
  })

  it('system null and system undefined produce the same hash', () => {
    const withNull = hashRequest({ ...baseRequest, system: null })
    const withUndefined = hashRequest({ ...baseRequest, system: undefined })
    expect(withNull).toBe(withUndefined)
  })

  it('system message changes the hash', () => {
    const withSystem = hashRequest({ ...baseRequest, system: 'You are helpful.' })
    const withoutSystem = hashRequest({ ...baseRequest, system: null })
    expect(withSystem).not.toBe(withoutSystem)
  })

  it('param ordering does not affect the hash', () => {
    const h1 = hashRequest({
      ...baseRequest,
      params: { max_tokens: 100, temperature: 0.0, top_p: null, stop: null },
    })
    const h2 = hashRequest({
      ...baseRequest,
      params: { stop: null, top_p: null, temperature: 0.0, max_tokens: 100 },
    })
    expect(h1).toBe(h2)
  })

  it('different temperature produces different hash', () => {
    const h1 = hashRequest({ ...baseRequest, params: { ...baseRequest.params, temperature: 0.0 } })
    const h2 = hashRequest({ ...baseRequest, params: { ...baseRequest.params, temperature: 0.7 } })
    expect(h1).not.toBe(h2)
  })

  it('tools sorted by name produce same hash regardless of input order', () => {
    const h1 = hashRequest({
      ...baseRequest,
      tools: [
        { name: 'get_weather', description: 'Gets weather' },
        { name: 'calculate', description: 'Calculates' },
      ],
    })
    const h2 = hashRequest({
      ...baseRequest,
      tools: [
        { name: 'calculate', description: 'Calculates' },
        { name: 'get_weather', description: 'Gets weather' },
      ],
    })
    expect(h1).toBe(h2)
  })

  it('produces consistent hash for multi-turn conversation', () => {
    const multiTurn: CassetteRequest = {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      system: null,
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ],
      params: { max_tokens: 200, temperature: 0.0, top_p: null, stop: null },
      tools: null,
    }
    const h1 = hashRequest(multiTurn)
    const h2 = hashRequest({ ...multiTurn })
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^sha256:[a-f0-9]{64}$/)
  })
})
