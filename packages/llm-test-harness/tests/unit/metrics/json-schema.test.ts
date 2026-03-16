import { describe, it, expect } from 'vitest'
import { JSONSchema } from '../../../src/metrics/json-schema.js'

describe('JSONSchema', () => {
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name'],
    additionalProperties: false,
  }

  it('passes for valid JSON matching the schema', () => {
    const m = new JSONSchema(schema)
    const result = m.evaluate('{"name":"Alice","age":30}')
    expect(result.pass).toBe(true)
    expect(result.score).toBe(1)
  })

  it('passes with only required fields', () => {
    const m = new JSONSchema(schema)
    expect(m.evaluate('{"name":"Bob"}').pass).toBe(true)
  })

  it('fails for invalid JSON', () => {
    const m = new JSONSchema(schema)
    const result = m.evaluate('not json at all')
    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reason).toContain('not valid JSON')
  })

  it('fails when required field is missing', () => {
    const m = new JSONSchema(schema)
    const result = m.evaluate('{"age":25}')
    expect(result.pass).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('fails when field type is wrong', () => {
    const m = new JSONSchema(schema)
    const result = m.evaluate('{"name":123}')
    expect(result.pass).toBe(false)
    expect(result.reason).toContain('string')
  })

  it('fails when additional property present and not allowed', () => {
    const m = new JSONSchema(schema)
    const result = m.evaluate('{"name":"Alice","extra":"field"}')
    expect(result.pass).toBe(false)
  })

  it('works with array schema', () => {
    const arraySchema = {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    }
    const m = new JSONSchema(arraySchema)
    expect(m.evaluate('["hello","world"]').pass).toBe(true)
    expect(m.evaluate('[]').pass).toBe(false)
    expect(m.evaluate('[1,2,3]').pass).toBe(false)
  })

  it('fails for empty string', () => {
    const m = new JSONSchema(schema)
    expect(m.evaluate('').pass).toBe(false)
  })

  it('has name "JSONSchema"', () => {
    expect(new JSONSchema({}).name).toBe('JSONSchema')
  })
})
