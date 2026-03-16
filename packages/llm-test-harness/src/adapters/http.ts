import type { CassetteInteraction, CassetteRequest, Provider, ResolvedHarnessConfig } from '../types.js'
import type { CassetteStore } from '../cassette/cassette-store.js'
import { hashRequest } from '../cassette/cassette-hash.js'
import { findInteraction } from '../cassette/cassette-match.js'
import { CassetteMissError, CassetteOverwriteError } from '../errors.js'

const PROVIDER_HOSTNAMES: Record<string, Provider> = {
  'api.anthropic.com': 'anthropic',
  'api.openai.com': 'openai',
}

function hostnameToProvider(url: string): Provider | null {
  try {
    const hostname = new URL(url).hostname
    return PROVIDER_HOSTNAMES[hostname] ?? null
  } catch {
    return null
  }
}

function normalizeHttpRequest(
  provider: Provider,
  body: Record<string, unknown>,
): CassetteRequest {
  const messages = (body['messages'] as Array<{ role: string; content: string }> | undefined) ?? []
  const systemMsg = messages.find((m) => m.role === 'system')
  const nonSystem = messages.filter((m) => m.role !== 'system')

  return {
    provider,
    model: String(body['model'] ?? ''),
    system:
      typeof body['system'] === 'string'
        ? body['system']
        : (systemMsg?.content ?? null),
    messages: nonSystem
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content ?? '' })),
    params: {
      max_tokens: (body['max_tokens'] as number | undefined) ?? null,
      temperature: (body['temperature'] as number | undefined) ?? null,
      top_p: (body['top_p'] as number | undefined) ?? null,
      stop:
        (body['stop'] as string | string[] | undefined) ??
        (body['stop_sequences'] as string[] | undefined) ??
        null,
    },
    tools: null,
  }
}

function buildFakeResponse(interaction: CassetteInteraction, provider: Provider): unknown {
  const { response, metadata } = interaction
  const text = response.content?.[0]?.text ?? ''

  if (provider === 'anthropic') {
    return {
      id: metadata.provider_request_id ?? `replayed_${interaction.id.slice(0, 16)}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text }],
      model: interaction.request.model,
      stop_reason: response.stop_reason ?? 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    }
  }

  return {
    id: metadata.provider_request_id ?? `replayed_${interaction.id.slice(0, 16)}`,
    object: 'chat.completion',
    created: Math.floor(new Date(metadata.recorded_at).getTime() / 1000),
    model: interaction.request.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: response.finish_reason ?? 'stop',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: response.usage?.input_tokens ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    },
  }
}

export function createFetchInterceptor(
  store: CassetteStore,
  config: ResolvedHarnessConfig,
): { intercept: () => void; restore: () => void } {
  const originalFetch = globalThis.fetch

  const interceptedFetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    const provider = hostnameToProvider(url)

    if (!provider || config.mode === 'passthrough') {
      return originalFetch(input, init)
    }

    const body: Record<string, unknown> = init?.body
      ? (JSON.parse(init.body as string) as Record<string, unknown>)
      : {}
    const req = normalizeHttpRequest(provider, body)
    const hash = hashRequest(req)

    if (config.mode === 'replay' || config.mode === 'hybrid') {
      const interaction = findInteraction(store, req)
      if (interaction) {
        return new Response(JSON.stringify(buildFakeResponse(interaction, provider)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (config.mode === 'replay') {
        throw new CassetteMissError(hash)
      }
    }

    const start = Date.now()
    const realResponse = await originalFetch(input, init)
    const durationMs = Date.now() - start
    const responseBody = (await realResponse.json()) as Record<string, unknown>

    const interaction: CassetteInteraction = {
      id: hash,
      request: req,
      response: {
        type: 'message',
        content: [{ type: 'text', text: String(responseBody['content'] ?? '') }],
        usage: {
          input_tokens: (responseBody['usage'] as Record<string, number> | undefined)?.['input_tokens'] ?? 0,
          output_tokens: (responseBody['usage'] as Record<string, number> | undefined)?.['output_tokens'] ?? 0,
        },
        stop_reason: String(responseBody['stop_reason'] ?? 'end_turn'),
      },
      metadata: {
        recorded_at: new Date().toISOString(),
        duration_ms: durationMs,
        provider_request_id: String(responseBody['id'] ?? ''),
      },
    }

    const final = config.onBeforeRecord(interaction)

    if (config.noOverwrite && store.findById(hash) !== undefined) {
      throw new CassetteOverwriteError(hash)
    }

    store.append(final)

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return {
    intercept: () => {
      globalThis.fetch = interceptedFetch as typeof globalThis.fetch
    },
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}
