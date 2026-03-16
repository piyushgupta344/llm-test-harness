import { describe, it, expect, vi } from 'vitest'
import { LLMJudge } from '../../../src/metrics/llm-judge.js'
import { HarnessError } from '../../../src/errors.js'

function makeAnthropicMock(responseText: string) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
      }),
    },
  }
}

function makeOpenAIMock(responseText: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: responseText } }],
        }),
      },
    },
  }
}

describe('LLMJudge', () => {
  it('passes when judge returns score above threshold', async () => {
    const client = makeAnthropicMock('{"score": 0.9, "reason": "Clear and concise answer"}')
    const m = new LLMJudge({ rubric: 'Is the answer helpful?', client, threshold: 0.7 })
    const result = await m.evaluate('Paris is the capital of France.')
    expect(result.pass).toBe(true)
    expect(result.score).toBe(0.9)
    expect(result.reason).toBe('Clear and concise answer')
  })

  it('fails when judge returns score below threshold', async () => {
    const client = makeAnthropicMock('{"score": 0.3, "reason": "Too vague"}')
    const m = new LLMJudge({ rubric: 'Is the answer helpful?', client, threshold: 0.7 })
    const result = await m.evaluate('I dunno')
    expect(result.pass).toBe(false)
    expect(result.score).toBe(0.3)
  })

  it('default threshold is 0.7', async () => {
    const client = makeAnthropicMock('{"score": 0.7, "reason": "Acceptable"}')
    const m = new LLMJudge({ rubric: 'Helpful?', client })
    const result = await m.evaluate('Some answer')
    expect(result.pass).toBe(true)
  })

  it('works with OpenAI client', async () => {
    const client = makeOpenAIMock('{"score": 0.85, "reason": "Good response"}')
    const m = new LLMJudge({ rubric: 'Is it correct?', client })
    const result = await m.evaluate('2 + 2 = 4')
    expect(result.pass).toBe(true)
    expect(result.score).toBe(0.85)
  })

  it('handles malformed JSON gracefully', async () => {
    const client = makeAnthropicMock('This is not JSON at all')
    const m = new LLMJudge({ rubric: 'Is it good?', client })
    const result = await m.evaluate('Some text')
    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reason).toContain('Could not parse')
  })

  it('handles partial JSON (extracts from surrounding text)', async () => {
    const client = makeAnthropicMock('Here is my evaluation: {"score": 0.75, "reason": "OK"} done.')
    const m = new LLMJudge({ rubric: 'Is it good?', client })
    const result = await m.evaluate('Some text')
    expect(result.score).toBe(0.75)
  })

  it('clamps score to 0-1 range', async () => {
    const client = makeAnthropicMock('{"score": 1.5, "reason": "Way too high"}')
    const m = new LLMJudge({ rubric: 'Test', client })
    const result = await m.evaluate('text')
    expect(result.score).toBe(1)
  })

  it('throws HarnessError for unsupported client', async () => {
    const badClient = { notAClient: true }
    const m = new LLMJudge({ rubric: 'Test', client: badClient })
    await expect(m.evaluate('text')).rejects.toThrow(HarnessError)
  })

  it('uses custom model when specified', async () => {
    const client = makeAnthropicMock('{"score": 0.8, "reason": "Good"}')
    const m = new LLMJudge({
      rubric: 'Test',
      client,
      model: 'claude-opus-4-6',
    })
    await m.evaluate('text')
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-6' }),
    )
  })

  it('calls judge with temperature 0', async () => {
    const client = makeAnthropicMock('{"score": 0.9, "reason": "Good"}')
    const m = new LLMJudge({ rubric: 'Test', client })
    await m.evaluate('text')
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 }),
    )
  })

  it('has name "LLMJudge"', () => {
    const m = new LLMJudge({ rubric: 'test', client: makeAnthropicMock('') })
    expect(m.name).toBe('LLMJudge')
  })
})
