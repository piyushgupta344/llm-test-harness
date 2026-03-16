export function isAnthropicClient(client: unknown): boolean {
  if (typeof client !== 'object' || client === null) return false
  const c = client as Record<string, unknown>
  if (typeof c['messages'] !== 'object' || c['messages'] === null) return false
  const messages = c['messages'] as Record<string, unknown>
  return typeof messages['create'] === 'function'
}

export function isOpenAIClient(client: unknown): boolean {
  if (typeof client !== 'object' || client === null) return false
  const c = client as Record<string, unknown>
  if (typeof c['chat'] !== 'object' || c['chat'] === null) return false
  const chat = c['chat'] as Record<string, unknown>
  if (typeof chat['completions'] !== 'object' || chat['completions'] === null) return false
  const completions = chat['completions'] as Record<string, unknown>
  return typeof completions['create'] === 'function'
}
