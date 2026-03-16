import type { MetricFn, MetricScore } from '../types.js'

interface ContentBlock {
  type?: string
  name?: string
  input?: unknown
}

/**
 * Asserts that the LLM response included a tool call with the given name.
 *
 * Pass the response content as JSON:
 * @example
 * const text = JSON.stringify(response.content)
 * harness.evaluate(text, [Metrics.toolCalled('search')])
 *
 * Optionally verify the tool input contains a substring:
 * @example
 * Metrics.toolCalled('search', { inputContains: 'Paris' })
 */
export class ToolCalled implements MetricFn {
  readonly name: string
  private toolName: string
  private inputContains?: string

  constructor(toolName: string, options?: { inputContains?: string }) {
    this.toolName = toolName
    this.inputContains = options?.inputContains
    this.name = `ToolCalled(${toolName})`
  }

  evaluate(text: string): MetricScore {
    let blocks: ContentBlock[]
    try {
      const parsed = JSON.parse(text)
      blocks = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return {
        name: this.name,
        pass: false,
        score: 0,
        reason: 'Input is not valid JSON',
      }
    }

    const toolBlock = blocks.find(
      (b) => b.type === 'tool_use' && b.name === this.toolName,
    )

    if (!toolBlock) {
      const found = blocks.filter((b) => b.type === 'tool_use').map((b) => b.name)
      return {
        name: this.name,
        pass: false,
        score: 0,
        reason: found.length
          ? `Tool "${this.toolName}" not called. Calls found: ${found.join(', ')}`
          : `No tool calls found in response`,
      }
    }

    if (this.inputContains) {
      const inputStr = JSON.stringify(toolBlock.input ?? '')
      if (!inputStr.includes(this.inputContains)) {
        return {
          name: this.name,
          pass: false,
          score: 0.5,
          reason: `Tool "${this.toolName}" was called but input does not contain "${this.inputContains}"`,
        }
      }
    }

    return { name: this.name, pass: true, score: 1 }
  }
}
