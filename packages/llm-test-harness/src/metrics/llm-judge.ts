import type { MetricFn, MetricScore } from '../types.js'
import { isAnthropicClient, isOpenAIClient } from '../adapters/detect.js'
import { HarnessError } from '../errors.js'

export interface LLMJudgeOptions {
  rubric: string
  client: object
  model?: string
  threshold?: number
}

function buildJudgePrompt(rubric: string, text: string): string {
  return `You are an objective evaluator. Rate the following output on a scale from 0.0 to 1.0 based on the rubric provided.

Rubric: ${rubric}

Output to evaluate:
"""
${text}
"""

Respond with ONLY a JSON object in this exact format, no other text:
{"score": <float between 0.0 and 1.0>, "reason": "<brief explanation>"}`
}

function parseJudgeResponse(raw: string): { score: number; reason: string } {
  const jsonMatch = raw.match(/\{[^{}]*\}/)
  if (!jsonMatch) return { score: 0, reason: `Could not parse judge response: ${raw}` }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const score = Math.max(0, Math.min(1, Number(parsed['score']) || 0))
    return { score, reason: String(parsed['reason'] ?? '') }
  } catch {
    return { score: 0, reason: `Invalid JSON from judge: ${raw}` }
  }
}

async function callAnthropicJudge(
  client: object,
  model: string,
  prompt: string,
): Promise<string> {
  const anthropicClient = client as {
    messages: {
      create: (params: unknown) => Promise<{
        content: Array<{ type: string; text?: string }>
      }>
    }
  }
  const response = await anthropicClient.messages.create({
    model,
    max_tokens: 200,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.content[0]?.text ?? ''
}

async function callOpenAIJudge(
  client: object,
  model: string,
  prompt: string,
): Promise<string> {
  const openaiClient = client as {
    chat: {
      completions: {
        create: (params: unknown) => Promise<{
          choices: Array<{ message: { content: string | null } }>
        }>
      }
    }
  }
  const response = await openaiClient.chat.completions.create({
    model,
    max_tokens: 200,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.choices[0]?.message.content ?? ''
}

export class LLMJudge implements MetricFn {
  readonly name = 'LLMJudge'

  constructor(private options: LLMJudgeOptions) {}

  async evaluate(text: string): Promise<MetricScore> {
    const { rubric, client, threshold = 0.7 } = this.options
    const prompt = buildJudgePrompt(rubric, text)

    let raw: string
    if (isAnthropicClient(client)) {
      raw = await callAnthropicJudge(client, this.options.model ?? 'claude-haiku-4-5-20251001', prompt)
    } else if (isOpenAIClient(client)) {
      raw = await callOpenAIJudge(client, this.options.model ?? 'gpt-4o-mini', prompt)
    } else {
      throw new HarnessError('LLMJudge requires a wrapped Anthropic or OpenAI client')
    }

    const { score, reason } = parseJudgeResponse(raw)
    return {
      name: this.name,
      pass: score >= threshold,
      score,
      reason,
    }
  }
}
