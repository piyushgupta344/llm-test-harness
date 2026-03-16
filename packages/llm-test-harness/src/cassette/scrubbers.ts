import type { CassetteInteraction, CassetteMessage } from '../types.js'

type Scrubber = (interaction: CassetteInteraction) => CassetteInteraction

const REDACTED = '[REDACTED]'

// Patterns for common secrets
const PATTERNS: Record<string, RegExp> = {
  anthropicKey: /sk-ant-[A-Za-z0-9\-_]{20,}/g,
  openaiKey: /sk-[A-Za-z0-9]{20,}/g,
  bearerToken: /Bearer\s+[A-Za-z0-9\-_\.]{20,}/gi,
  email: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
  uuid: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
}

function scrubString(value: string, pattern: RegExp, replacement: string): string {
  return value.replace(pattern, replacement)
}

function scrubMessages(messages: CassetteMessage[], pattern: RegExp, replacement: string): CassetteMessage[] {
  return messages.map((m) => ({
    ...m,
    content: typeof m.content === 'string' ? scrubString(m.content, pattern, replacement) : m.content,
  }))
}

function scrubInteraction(interaction: CassetteInteraction, pattern: RegExp, replacement: string): CassetteInteraction {
  return {
    ...interaction,
    request: {
      ...interaction.request,
      system: interaction.request.system
        ? scrubString(interaction.request.system, pattern, replacement)
        : interaction.request.system,
      messages: scrubMessages(interaction.request.messages, pattern, replacement),
    },
    response: {
      ...interaction.response,
      content: interaction.response.content?.map((b) => ({
        ...b,
        text: b.text ? scrubString(b.text, pattern, replacement) : b.text,
      })),
    },
  }
}

/**
 * Scrubbers are composable helpers for use with `onBeforeRecord`.
 *
 * @example
 * const harness = new Harness({
 *   cassettesDir: './cassettes',
 *   mode: 'record',
 *   onBeforeRecord: Scrubbers.standard(),
 * })
 */
export const Scrubbers = {
  /** Redact Anthropic and OpenAI API keys */
  apiKey(): Scrubber {
    return (i) => {
      let out = scrubInteraction(i, PATTERNS.anthropicKey!, REDACTED)
      out = scrubInteraction(out, PATTERNS.openaiKey!, REDACTED)
      out = scrubInteraction(out, PATTERNS.bearerToken!, `Bearer ${REDACTED}`)
      return out
    }
  },

  /** Redact email addresses */
  email(replacement = REDACTED): Scrubber {
    return (i) => scrubInteraction(i, PATTERNS.email!, replacement)
  },

  /** Redact UUIDs */
  uuid(replacement = '00000000-0000-0000-0000-000000000000'): Scrubber {
    return (i) => scrubInteraction(i, PATTERNS.uuid!, replacement)
  },

  /** Redact IPv4 addresses */
  ipAddress(replacement = '0.0.0.0'): Scrubber {
    return (i) => scrubInteraction(i, PATTERNS.ipv4!, replacement)
  },

  /** Redact any custom pattern */
  custom(pattern: RegExp, replacement = REDACTED): Scrubber {
    return (i) => scrubInteraction(i, pattern, replacement)
  },

  /**
   * Combine multiple scrubbers into one — applied left to right.
   * @example
   * Scrubbers.combine(Scrubbers.apiKey(), Scrubbers.email())
   */
  combine(...scrubbers: Scrubber[]): Scrubber {
    return (i) => scrubbers.reduce((acc, s) => s(acc), i)
  },

  /**
   * Standard preset: redacts API keys, bearer tokens, emails, UUIDs.
   * Good starting point for most projects.
   */
  standard(): Scrubber {
    return Scrubbers.combine(
      Scrubbers.apiKey(),
      Scrubbers.email(),
      Scrubbers.uuid(),
    )
  },
}
