import type { CassetteInteraction, CassetteRequest, ResolvedHarnessConfig } from '../types.js'
import type { CassetteStore } from '../cassette/cassette-store.js'
import { hashRequest } from '../cassette/cassette-hash.js'
import { findInteraction } from '../cassette/cassette-match.js'
import { CassetteMissError, CassetteOverwriteError } from '../errors.js'

// Minimal type definitions for the OpenAI SDK shapes.

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
}

interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

interface OpenAICreateParams {
  model: string
  messages: OpenAIMessage[]
  max_tokens?: number | null
  temperature?: number | null
  top_p?: number | null
  stop?: string | string[] | null
  stream?: boolean
  tools?: OpenAITool[]
  [key: string]: unknown
}

interface OpenAIChatCompletion {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: Array<{
    index: number
    message: { role: 'assistant'; content: string | null; tool_calls?: unknown[] }
    finish_reason: string | null
    logprobs: null
  }>
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

function normalizeRequest(params: OpenAICreateParams): CassetteRequest {
  // Extract system message from messages array (OpenAI embeds it as role='system')
  const systemMsg = params.messages.find((m) => m.role === 'system')
  const nonSystemMsgs = params.messages.filter((m) => m.role !== 'system')

  return {
    provider: 'openai',
    model: params.model,
    system: systemMsg?.content ?? null,
    messages: nonSystemMsgs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' })),
    params: {
      max_tokens: params.max_tokens ?? null,
      temperature: params.temperature ?? null,
      top_p: params.top_p ?? null,
      stop: params.stop ?? null,
    },
    tools: params.tools
      ? params.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description ?? null,
        }))
      : null,
  }
}

function buildOpenAIResponse(interaction: CassetteInteraction): OpenAIChatCompletion {
  const { response, metadata } = interaction
  const textContent = response.content?.[0]?.text ?? ''

  return {
    id: metadata.provider_request_id ?? `replayed_${interaction.id.slice(0, 16)}`,
    object: 'chat.completion',
    created: Math.floor(new Date(metadata.recorded_at).getTime() / 1000),
    model: interaction.request.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: textContent },
        finish_reason: response.finish_reason ?? response.stop_reason ?? 'stop',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: response.usage?.input_tokens ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      total_tokens:
        response.usage?.total_tokens ??
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    },
  }
}

async function interceptCreate(
  params: OpenAICreateParams,
  originalFn: (params: OpenAICreateParams) => Promise<OpenAIChatCompletion>,
  store: CassetteStore,
  config: ResolvedHarnessConfig,
): Promise<OpenAIChatCompletion> {
  if (params.stream === true) {
    return originalFn(params)
  }

  const req = normalizeRequest(params)
  const hash = hashRequest(req)

  if (config.mode === 'replay' || config.mode === 'hybrid') {
    const interaction = findInteraction(store, req)
    if (interaction) {
      return buildOpenAIResponse(interaction)
    }
    if (config.mode === 'replay') {
      throw new CassetteMissError(hash)
    }
  }

  if (config.mode === 'passthrough') {
    return originalFn(params)
  }

  const start = Date.now()
  const response = await originalFn(params)
  const durationMs = Date.now() - start

  const firstChoice = response.choices[0]
  const interaction: CassetteInteraction = {
    id: hash,
    request: req,
    response: {
      type: 'message',
      content: firstChoice?.message.content
        ? [{ type: 'text', text: firstChoice.message.content }]
        : [],
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      },
      finish_reason: firstChoice?.finish_reason ?? undefined,
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

export function wrapOpenAIClient<T extends object>(
  client: T,
  store: CassetteStore,
  config: ResolvedHarnessConfig,
): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'chat') {
        const originalChat = Reflect.get(target, prop, target) as Record<string, unknown>
        return new Proxy(originalChat, {
          get(chatTarget, chatProp) {
            if (chatProp === 'completions') {
              const originalCompletions = Reflect.get(chatTarget, chatProp, chatTarget) as Record<
                string,
                unknown
              >
              return new Proxy(originalCompletions, {
                get(compTarget, compProp) {
                  if (compProp === 'create') {
                    return (params: OpenAICreateParams) =>
                      interceptCreate(
                        params,
                        (p) =>
                          (
                            compTarget['create'] as (
                              p: OpenAICreateParams,
                            ) => Promise<OpenAIChatCompletion>
                          ).call(compTarget, p),
                        store,
                        config,
                      )
                  }
                  return Reflect.get(compTarget, compProp, compTarget)
                },
              })
            }
            return Reflect.get(chatTarget, chatProp, chatTarget)
          },
        })
      }
      return Reflect.get(target, prop, receiver)
    },
  })
}
