/** Live membership, protocol identity, and zero-price semantics use independent source fixtures. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverOpenCodeModels } from '../src/discovery.ts'
const discoverModels = (request: { provider: 'opencode' | 'opencode-go'; baseURL?: string; apiKey?: string }) => discoverOpenCodeModels(request.provider)
import { resolvePiAiProfiles as resolveProfiles } from '@deepseek-ai/dsh-llm-pi-ai'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import { memoryAuth } from './auth-double.ts'

afterEach(() => { vi.unstubAllGlobals() })

const routes = ['opencode', 'opencode-go'] as const

function fixture(provider: typeof routes[number]) {
  const base = `https://opencode.ai/zen${provider === 'opencode-go' ? '/go' : ''}/v1`
  const models = {
    'new-free': { name: 'New Free', tool_call: true, limit: { context: 1000000, output: 32000 },
      modalities: { input: ['text', 'image', 'audio'] }, cost: { input: 0, output: 0, cache_read: 0 } },
    'new-paid': { name: 'New Paid', tool_call: true, provider: { npm: '@ai-sdk/openai' },
      limit: { context: 200000, output: 16000 }, cost: { input: 2, output: 4 } },
    'new-cache-paid-free': { name: 'Misleading Free', limit: { context: 20000, output: 4000 },
      cost: { input: 0, output: 0, cache_write: 1 } },
    'new-unpriced': { name: 'Unknown Price', limit: { context: 20000, output: 4000 } },
    'not-live': { name: 'Retired', cost: { input: 0, output: 0 } },
  }
  const ids = [...Object.keys(models).filter(id => id !== 'not-live'), 'jev-1.13-free', 'unverified-alias']
  const table = `<table><tr><th>Model</th><th>Model ID</th><th>Endpoint</th><th>AI SDK Package</th></tr>
    <tr><td>New Free</td><td>new-free</td><td><code>${base}/chat/completions</code></td><td>@ai-sdk/openai-compatible</td></tr>
    <tr><td>New Paid</td><td>new-paid</td><td><code>${base}/messages</code></td><td>@ai-sdk/anthropic</td></tr>
    <tr><td>Jev 1.13 Free</td><td>jev-1.13-free</td><td>${base}/systemone</td><td>-</td></tr></table>`
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (url === `${base}/models`) return Response.json({ data: ids.map(id => ({ id })) })
    if (url === 'https://models.dev/api.json') return Response.json({ [provider]: { npm: '@ai-sdk/openai-compatible', models } })
    if (url === `https://opencode.ai/docs/${provider === 'opencode-go' ? 'go' : 'zen'}/`) return new Response(table)
    throw new Error(`Unexpected metadata URL: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, base }
}

describe('OpenCode live discovery', () => {
  it.each(routes)('joins only live ids and preserves %s protocol settings through adoption', async (provider) => {
    const { fetch, base } = fixture(provider)
    const candidates = await discoverModels({ provider, baseURL: `${base}/`, apiKey: 'must-not-leak' })
    expect(candidates.map(model => model.id)).not.toContain('not-live')
    expect(candidates[0]).toMatchObject({ id: 'new-free', inputModalities: ['text', 'image'] })
    expect(candidates[0]?.description).toMatch(/^Free \(current rate\).*input \$0.*output \$0/)
    const paid = candidates.find(model => model.id === 'new-paid')
    expect(paid?.configuration).toMatchObject({ api: 'anthropic-messages', baseURL: base.slice(0, -3) })
    const available = candidates.filter(model => model.unavailableReason === undefined)
    const profiles = resolveProfiles({ [provider]: { models: available.map(model => ({
      ...model.configuration, id: model.id, name: model.name!, description: model.description!,
      contextWindow: model.contextWindow!, maxTokens: model.maxTokens!, input: ['text'],
    })) } })
    const adapter = new PiAiAdapter({ profiles: () => profiles, resolveApiKey: () => Promise.resolve('key'), auth: memoryAuth() })
    expect((await adapter.listModels(provider)).find(model => model.id === 'new-paid')?.description).toBe(paid?.description)
    expect(candidates.find(model => model.id === 'jev-1.13-free')?.unavailableReason).toMatch(/System One/)
    expect(candidates.find(model => model.id === 'unverified-alias')?.unavailableReason).toMatch(/No verified/)
    for (const [, options] of fetch.mock.calls) expect(JSON.stringify(options?.headers)).not.toContain('must-not-leak')
  })

  it('does not treat missing rates or a free suffix as zero cost', async () => {
    fixture('opencode-go')
    const candidates = await discoverModels({ provider: 'opencode-go' })
    expect(candidates.find(model => model.id === 'new-cache-paid-free')?.description).toMatch(/^Go subscription.*cache write \$1/)
    expect(candidates.find(model => model.id === 'new-unpriced')?.description).toContain('input —')
  })

  it('reports a source failure instead of presenting the installed catalog as a fresh result', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('unavailable', { status: 503 }))))
    await expect(discoverModels({ provider: 'opencode-go' })).rejects.toThrow(/503/)
  })
})
