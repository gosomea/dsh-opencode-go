/** Live OpenCode membership joined by exact id with documented protocols and provider metadata. */

import { attributionHeaders, LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import type { BuiltinProvider } from '@earendil-works/pi-ai/providers/all'
const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
const catalogModels = (provider: string) => new Map(getBuiltinModels(provider as BuiltinProvider).map(model => [model.id, model]))

const MODELS_URL = 'https://models.dev/api.json'
const MAX_SOURCE_BYTES = 16 * 1024 * 1024

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

async function source(url: string, signal?: AbortSignal): Promise<string> {
  let response: Response
  try { response = await fetch(url, { headers: attributionHeaders(), signal: signal ?? null }) }
  catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : ''
    throw new LlmError(`OpenCode discovery: ${url}: ${error instanceof Error ? error.message : String(error)}${cause}`, 'DISCOVERY_FAILED')
  }
  if (!response.ok) throw new LlmError(`OpenCode discovery: ${url} answered ${response.status}`, 'DISCOVERY_FAILED')
  if (response.body === null) throw new LlmError(`OpenCode discovery: empty response from ${url}`, 'DISCOVERY_FAILED')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > MAX_SOURCE_BYTES) throw new LlmError(`OpenCode discovery: ${url} exceeds the source size limit`, 'DISCOVERY_FAILED')
      chunks.push(next.value)
    }
  } finally {
    await reader.cancel()
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Extract the static documentation's table cells; never evaluate page scripts. */
function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...(row[1] ?? '').matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell =>
      (cell[1] ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").trim()),
  )
}

function protocol(endpoint: string): string | undefined {
  if (endpoint.endsWith('/chat/completions')) return 'openai-completions'
  if (endpoint.endsWith('/responses')) return 'openai-responses'
  if (endpoint.endsWith('/messages')) return 'anthropic-messages'
  if (endpoint.includes('/models/')) return 'google-generative-ai'
  return undefined
}

function rate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function publishedRate(value: string | undefined): number | undefined {
  if (value === 'Free') return 0
  return value !== undefined && /^\$[\d.]+$/.test(value) ? rate(Number(value.slice(1))) : undefined
}

function nameKey(name: string): string {
  return name.replace(/\s*\([^)]*\)/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function pricingDetail(
  provider: string, name: string, metadata: Record<string, unknown>, rows: readonly string[][], date: string,
): { free: boolean; description: string } {
  const cost = record(metadata['cost'])
  const official = provider === 'opencode'
    ? rows.find(row => row.length === 5 && !row[0]?.includes('>') && nameKey(row[0] ?? '') === nameKey(name))
    : undefined
  const input = official === undefined ? rate(cost['input']) : publishedRate(official[1])
  const output = official === undefined ? rate(cost['output']) : publishedRate(official[2])
  const read = official === undefined ? rate(cost['cache_read']) : publishedRate(official[3])
  const write = official === undefined ? rate(cost['cache_write']) : publishedRate(official[4])
  const tiers = Array.isArray(cost['tiers']) ? cost['tiers'] : []
  const free = input === 0 && output === 0 && (read === undefined || read === 0) && (write === undefined || write === 0)
    && tiers.every(tier => Object.entries(record(tier)).every(([key, value]) => key === 'tier' || rate(value) === 0))
  const amount = (value: number | undefined): string => value === undefined ? '—' : `$${String(value)}`
  const billing = free ? 'Free (current rate)' : provider === 'opencode-go' ? 'Go subscription; reference rates' : 'Pay as you go'
  const eligibility = free && provider === 'opencode' ? ' · third-party access may be restricted by OpenCode' : ''
  const prices = `USD/1M tokens: input ${amount(input)} · output ${amount(output)} · cache read ${amount(read)} · cache write ${amount(write)}`
  const hasTiers = tiers.length > 0 || rows.some(row => row[0]?.includes('>') && nameKey(row[0]) === nameKey(name))
  return {
    free,
    description: `${billing}${eligibility} · ${prices}${hasTiers ? ' · higher context tiers may apply' : ''} · ${official === undefined ? 'models.dev' : 'opencode.ai'} · ${date}`,
  }
}

/**
 * Discover live Go or Zen entries without transmitting inference credentials to metadata services.
 * Unknown protocols remain visible but cannot be adopted; no id-prefix protocol guesses are made.
 * @param provider - exact built-in OpenCode route.
 * @param signal - cancellation for every public source request.
 * @returns live candidates, adapter settings, pricing descriptions, and unsupported-entry diagnostics.
 */
export async function discoverOpenCodeModels(provider: 'opencode' | 'opencode-go', signal?: AbortSignal): Promise<LlmDiscoveredModel[]> {
  const go = provider === 'opencode-go'
  const baseURL = `https://opencode.ai/zen${go ? '/go' : ''}/v1`
  const docsURL = `https://opencode.ai/docs/${go ? 'go' : 'zen'}/`
  const [listingText, metadataText, docs] = await Promise.all([
    source(`${baseURL}/models`, signal), source(MODELS_URL, signal), source(docsURL, signal),
  ])
  const listing = record(JSON.parse(listingText))
  if (!Array.isArray(listing['data'])) throw new LlmError('OpenCode discovery: models response has no data array', 'DISCOVERY_FAILED')
  const directory = record(record(JSON.parse(metadataText))[provider])
  const metadataModels = record(directory['models'])
  if (Object.keys(metadataModels).length === 0) throw new LlmError(`OpenCode discovery: metadata missing for ${provider}`, 'DISCOVERY_FAILED')
  const rows = tableRows(docs)
  const endpoints = new Map(rows.filter(row => row[2]?.startsWith(`${baseURL}/`)).map(row => [row[1], row]))
  if (endpoints.size === 0) throw new LlmError(`OpenCode discovery: no protocol table found at ${docsURL}`, 'DISCOVERY_FAILED')
  const installed = catalogModels(provider)
  const date = new Date().toISOString().slice(0, 10)
  const seen = new Set<string>()
  return listing['data'].map((value: unknown): LlmDiscoveredModel => {
    const id = record(value)['id']
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) throw new LlmError('OpenCode discovery: invalid or duplicate model id', 'DISCOVERY_FAILED')
    seen.add(id)
    const metadata = record(metadataModels[id])
    const existing = installed.get(id)
    const row = endpoints.get(id)
    const name = row?.[0] ?? (typeof metadata['name'] === 'string' ? metadata['name'] : existing?.name ?? id)
    const npm = record(metadata['provider'])['npm'] ?? directory['npm']
    const npmApi: Readonly<Record<string, string>> = {
      '@ai-sdk/openai-compatible': 'openai-completions', '@ai-sdk/openai': 'openai-responses',
      '@ai-sdk/anthropic': 'anthropic-messages', '@ai-sdk/google': 'google-generative-ai',
    }
    const api = row === undefined
      ? (Object.keys(metadata).length === 0 ? existing?.api : typeof npm === 'string' ? npmApi[npm] : undefined)
      : protocol(row[2] ?? '')
    const pricing = pricingDetail(provider, name, metadata, rows, date)
    const label = pricing.free && !/free/i.test(name) ? `${name} (Free)` : name
    if (api === undefined || metadata['tool_call'] === false) {
      return { id, name: label, description: pricing.description,
        unavailableReason: row?.[2]?.endsWith('/systemone') === true
          ? 'System One decision model; not a chat/tool protocol.' : 'No verified chat/tool protocol metadata; not installed automatically.' }
    }
    const limit = record(metadata['limit'])
    const contextWindow = positive(limit['context']) ?? existing?.contextWindow
    const maxTokens = positive(limit['output']) ?? existing?.maxTokens
    if (contextWindow === undefined || maxTokens === undefined) {
      return { id, name: label, description: pricing.description, unavailableReason: 'Context or output capacity is unknown; not installed automatically.' }
    }
    const rawInput = record(metadata['modalities'])['input']
    const input: ('text' | 'image')[] = Array.isArray(rawInput)
      ? rawInput.filter((item): item is 'text' | 'image' => item === 'text' || item === 'image')
      : [...existing?.input ?? ['text']]
    const configuration: Record<string, JsonValue> = {
      api, baseURL: api === 'anthropic-messages' ? baseURL.slice(0, -3) : baseURL,
    }
    if (existing === undefined && metadata['reasoning'] === true) {
      const options = Array.isArray(metadata['reasoning_options']) ? metadata['reasoning_options'] : []
      const effort = options.map(record).find(option => option['type'] === 'effort')
      const values = effort?.['values']
      if (Array.isArray(values)) {
        const levels = values.filter((level): level is string => typeof level === 'string' && THINKING_LEVELS.some(known => known === level))
        if (levels.length > 0) configuration['reasoningEfforts'] = Object.fromEntries(levels.map(level => [level, level]))
      } else if (api === 'openai-completions' && record(metadata['interleaved'])['field'] === 'reasoning_content') {
        configuration['reasoningEfforts'] = { high: 'high' }
      }
      if (api === 'openai-completions' && record(metadata['interleaved'])['field'] === 'reasoning_content') {
        configuration['compat'] = { thinkingFormat: 'deepseek' }
      }
    }
    return { id, name: label, description: pricing.description, contextWindow, maxTokens, inputModalities: input, configuration }
  }).sort((left, right) => Number(right.description?.startsWith('Free')) - Number(left.description?.startsWith('Free'))
    || (left.name ?? left.id).localeCompare(right.name ?? right.id))
}
