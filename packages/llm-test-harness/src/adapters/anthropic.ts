import type { CassetteInteraction, CassetteRequest, ResolvedHarnessConfig } from '../types.js'
import type { CassetteStore } from '../cassette/cassette-store.js'
import { hashRequest } from '../cassette/cassette-hash.js'
import { findInteraction } from '../cassette/cassette-match.js'
import { CassetteMissError, CassetteOverwriteError } from '../errors.js'

// Minimal type definitions for Anthropic SDK shapes, kept local to avoid
// hard-coding the SDK version in the public API.

interface AnthropicMessageParam {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>
}

interface AnthropicCreateParams {
  model: string
  max_tokens: number
  messages: AnthropicMessageParam[]
  system?: string | Array<{ type: string; text: string }>
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  stream?: boolean
  tools?: Array<{ name: string; description?: string; input_schema: Record<string, unknown> }>
  [key: string]: unknown
}

interface AnthropicMessage {
  id: string
  type: 'message'
  role: 'assistant'
  content: Array<{ type: string; text?: string; [key: string]: unknown }>
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: { input_tokens: number; output_tokens: number }
}

function normalizeSystem(system: AnthropicCreateParams['system']): string | null {
  if (!system) return null
  if (typeof system === 'string') return system
  return system
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
}

function normalizeContent(
  content: AnthropicMessageParam['content'],
): string {
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
}

function normalizeRequest(params: AnthropicCreateParams): CassetteRequest {
  return {
    provider: 'anthropic',
    model: params.model,
    system: normalizeSystem(params.system),
    messages: params.messages.map((m) => ({
      role: m.role,
      content: normalizeContent(m.content),
    })),
    params: {
      max_tokens: params.max_tokens ?? null,
      temperature: params.temperature ?? null,
      top_p: params.top_p ?? null,
      stop: params.stop_sequences ?? null,
    },
    tools: params.tools
      ? params.tools.map((t) => ({ name: t.name, description: t.description ?? null }))
      : null,
  }
}

function buildAnthropicResponse(
  interaction: CassetteInteraction,
  originalModel: string,
): AnthropicMessage {
  const { response, request, metadata } = interaction
  const content = (response.content ?? []).map((b) => {
    if (b.type === 'text') return { type: 'text' as const, text: b.text ?? '' }
    if (b.type === 'tool_use') {
      return { type: 'tool_use' as const, id: b.id ?? '', name: b.name ?? '', input: b.input ?? {} }
    }
    return { type: 'tool_result' as const }
  })

  return {
    id: metadata.provider_request_id ?? `replayed_${interaction.id.slice(0, 16)}`,
    type: 'message',
    role: 'assistant',
    content,
    model: request.model ?? originalModel,
    stop_reason: response.stop_reason ?? null,
    stop_sequence: null,
    usage: {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    },
  }
}

async function interceptCreate(
  params: AnthropicCreateParams,
  originalFn: (params: AnthropicCreateParams) => Promise<AnthropicMessage>,
  store: CassetteStore,
  config: ResolvedHarnessConfig,
): Promise<AnthropicMessage> {
  // Pass streaming through without cassette interception
  if (params.stream === true) {
    return originalFn(params)
  }

  const req = normalizeRequest(params)
  const hash = hashRequest(req)

  if (config.mode === 'replay' || config.mode === 'hybrid') {
    const interaction = findInteraction(store, req)
    if (interaction) {
      return buildAnthropicResponse(interaction, params.model)
    }
    if (config.mode === 'replay') {
      throw new CassetteMissError(hash)
    }
  }

  if (config.mode === 'passthrough') {
    return originalFn(params)
  }

  // record or hybrid-miss: call real API
  const start = Date.now()
  const response = await originalFn(params)
  const durationMs = Date.now() - start

  const interaction: CassetteInteraction = {
    id: hash,
    request: req,
    response: {
      type: 'message',
      content: response.content.map((b) => {
        if (b.type === 'text') return { type: 'text' as const, text: b.text ?? '' }
        if (b.type === 'tool_use') {
          return {
            type: 'tool_use' as const,
            id: (b as { id?: string }).id,
            name: (b as { name?: string }).name,
            input: (b as { input?: Record<string, unknown> }).input ?? {},
          }
        }
        return { type: 'tool_result' as const }
      }),
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      stop_reason: response.stop_reason ?? undefined,
    },
    metadata: {
      recorded_at: new Date().toISOString(),
      duration_ms: durationMs,
      provider_request_id: response.id,
    },
  }

  const final = config.onBeforeRecord(interaction)

  if (config.noOverwrite && store.findById(hash) !== undefined) {
    throw new CassetteOverwriteError(hash)
  }

  store.append(final)
  return response
}

export function wrapAnthropicClient<T extends object>(
  client: T,
  store: CassetteStore,
  config: ResolvedHarnessConfig,
): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'messages') {
        const originalMessages = Reflect.get(target, prop, target) as Record<string, unknown>
        return new Proxy(originalMessages, {
          get(msgTarget, msgProp) {
            if (msgProp === 'create') {
              return (params: AnthropicCreateParams) =>
                interceptCreate(
                  params,
                  (p) =>
                    (msgTarget['create'] as (p: AnthropicCreateParams) => Promise<AnthropicMessage>).call(
                      msgTarget,
                      p,
                    ),
                  store,
                  config,
                )
            }
            return Reflect.get(msgTarget, msgProp, msgTarget)
          },
        })
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}
