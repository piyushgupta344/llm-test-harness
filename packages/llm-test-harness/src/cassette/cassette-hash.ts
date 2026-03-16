import { createHash } from 'node:crypto'
import type { CassetteRequest } from '../types.js'

/**
 * Recursively sorts all object keys alphabetically.
 * This ensures deterministic JSON serialization matching Python's json.dumps(sort_keys=True).
 */
function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeys)
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((value as Record<string, unknown>)[key])
  }
  return sorted
}

/**
 * Builds the canonical object used for hashing.
 * Must be kept in sync with Python's llm_test_harness.cassette.hash.build_canonical().
 */
function buildCanonical(req: CassetteRequest): unknown {
  return {
    messages: req.messages.map((m) => ({ content: m.content, role: m.role })),
    model: req.model,
    params: {
      max_tokens: req.params.max_tokens ?? null,
      stop: req.params.stop ?? null,
      temperature: req.params.temperature ?? null,
      top_p: req.params.top_p ?? null,
    },
    provider: req.provider,
    system: req.system ?? null,
    tools: req.tools
      ? [...req.tools]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((t) => ({ description: t.description ?? null, name: t.name }))
      : null,
  }
}

/**
 * Produces a deterministic SHA-256 hash for a cassette request.
 * The hash uniquely identifies a request for record/replay matching.
 */
export function hashRequest(req: CassetteRequest): string {
  const canonical = sortKeys(buildCanonical(req))
  const json = JSON.stringify(canonical)
  return 'sha256:' + createHash('sha256').update(json, 'utf8').digest('hex')
}
