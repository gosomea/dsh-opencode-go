/** Live membership, protocol identity, and zero-price semantics use independent source fixtures. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverOpenCodeModels } from '../src/discovery.ts'
const discoverModels = (request: { provider: 'opencode' | 'opencode-go'; baseURL?: string; apiKey?: string }) => discoverOpenCodeModels(request.provider)
import { resolveProfiles, OpenCodeAdapter } from '../src/provider.ts'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import { memoryAuth } from './auth-double.ts'

afterEach(() => { vi.unstubAllGlobals() })

const routes = ['opencode', 'opencode-go'] as const

function fixture(provider: typeof routes[number], extraRows = '') {
  const root = `https://opencode.ai/inference${provider === 'opencode-go' ? '/go' : ''}`
  const base = `${root}/v1`
  const models = {
    'new-free': { name: 'New Free', tool_call: true, limit: { context: 1000000, output: 32000 },
      modalities: { input: ['text', 'image', 'audio'] }, cost: { input: 0, output: 0, cache_read: 0, cache_write: 0 } },
    'new-paid': { name: 'New Paid', tool_call: true, provider: { npm: '@ai-sdk/openai' },
      limit: { context: 200000, output: 16000 }, cost: { input: 2, output: 4 } },
    'new-cache-paid-free': { name: 'Misleading Free', limit: { context: 20000, output: 4000 },
      cost: { input: 0, output: 0, cache_write: 1 } },
    'new-cache-unknown': { name: 'Unknown Cache', limit: { context: 20000, output: 4000 },
      cost: { input: 0, output: 0, cache_read: 0 } },
    'new-tier-paid': { name: 'Paid Tier', limit: { context: 20000, output: 4000 },
      cost: { input: 0, output: 0, cache_read: 0, cache_write: 0, tiers: [{ tier: { type: 'context', size: 200000 }, input: 1, output: 0, cache_read: 0, cache_write: 0 }] } },
    'new-tier-unknown': { name: 'Unknown Tier', limit: { context: 20000, output: 4000 },
      cost: { input: 0, output: 0, cache_read: 0, cache_write: 0, tiers: [{ tier: { type: 'context', size: 200000 }, input: 0, output: 0 }] } },
    'new-google': { name: 'New Google', limit: { context: 20000, output: 4000 } },
    'new-responses': { name: 'New Responses', limit: { context: 20000, output: 4000 } },
    'new-unpriced': { name: 'Unknown Price', limit: { context: 20000, output: 4000 } },
    'not-live': { name: 'Retired', cost: { input: 0, output: 0 } },
  }
  const ids = [...Object.keys(models).filter(id => id !== 'not-live'), 'jev-1.13-free', 'unverified-alias']
  const table = `<table><tr><th>Model</th><th>Model ID</th><th>Endpoint</th><th>AI SDK Package</th></tr>
    <tr><td>New Free</td><td>new-free</td><td><code>${root}/openai/v1/chat/completions</code></td><td>@ai-sdk/openai-compatible</td></tr>
    <tr><td>New Paid</td><td>new-paid</td><td><code>${root}/anthropic/v1/messages</code></td><td>@ai-sdk/anthropic</td></tr>
    <tr><td>New Google</td><td>new-google</td><td><code>${root}/google/v1beta/models/new-google</code></td><td>@ai-sdk/google</td></tr>
    <tr><td>New Responses</td><td>new-responses</td><td><code>${root}/openai/v1/responses</code></td><td>@ai-sdk/openai</td></tr>
    <tr><td>Jev 1.13 Free</td><td>jev-1.13-free</td><td>${root}/systemone/v1/systemone</td><td>-</td></tr></table>${extraRows}`
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = input instanceof Request ? input.url : input.toString()
    if (url === `${base}/models`) return Response.json({ data: ids.map(id => ({ id })) })
    if (url === 'https://models.dev/api.json') return Response.json({ [provider]: { npm: '@ai-sdk/openai-compatible', models } })
    if (url === `https://opencode.ai/v2/docs/console/${provider === 'opencode-go' ? 'go' : 'models'}/`) return new Response(table)
    throw new Error(`Unexpected metadata URL: ${url}`)
  })
  vi.stubGlobal('fetch', fetch)
  return { fetch, base, root }
}

describe('OpenCode live discovery', () => {
  it.each(routes)('joins only live ids and preserves %s protocol settings through adoption', async (provider) => {
    const { fetch, base, root } = fixture(provider)
    const candidates = await discoverModels({ provider, baseURL: `${base}/`, apiKey: 'must-not-leak' })
    expect(candidates.map(model => model.id)).not.toContain('not-live')
    expect(candidates[0]).toMatchObject({ id: 'new-free', inputModalities: ['text', 'image'] })
    expect(candidates[0]?.description).toMatch(/^Free \(current rate\).*input \$0.*output \$0/)
    const paid = candidates.find(model => model.id === 'new-paid')
    expect(paid?.configuration).toMatchObject({ api: 'anthropic-messages', baseURL: `${root}/anthropic` })
    expect(candidates.find(model => model.id === 'new-free')?.configuration).toMatchObject({ api: 'openai-completions', baseURL: `${root}/openai/v1` })
    expect(candidates.find(model => model.id === 'new-responses')?.configuration).toMatchObject({ api: 'openai-responses', baseURL: `${root}/openai/v1` })
    expect(candidates.find(model => model.id === 'new-google')?.configuration).toMatchObject({ api: 'google-generative-ai', baseURL: `${root}/google/v1beta` })
    const available = candidates.filter(model => model.unavailableReason === undefined)
    const inputs = { [provider]: { models: available.map(model => ({
      ...model.configuration, id: model.id, name: model.name!, description: model.description!,
      contextWindow: model.contextWindow!, maxTokens: model.maxTokens!, input: ['text'],
    })) } }
    const profiles = resolveProfiles(inputs)
    const adapter = new OpenCodeAdapter({ profiles: () => profiles, resolveApiKey: () => Promise.resolve('key'), auth: memoryAuth() }, () => inputs)
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
    expect(candidates.find(model => model.id === 'new-cache-unknown')?.description).toMatch(/^Go subscription.*cache write —/)
    expect(candidates.find(model => model.id === 'new-tier-paid')?.description).toMatch(/^Go subscription.*higher context tiers may apply/)
    expect(candidates.find(model => model.id === 'new-tier-unknown')?.description).toMatch(/^Go subscription.*higher context tiers may apply/)
  })

  it.each(['New Free (> 200K tokens)', 'New Free > 200K tokens'])(
    'does not call a model free when the official price table has a paid %s tier', async tierName => {
      fixture('opencode', `<table>
        <tr><td>New Free (≤ 200K tokens)</td><td>Free</td><td>Free</td><td>Free</td><td>Free</td></tr>
        <tr><td>${tierName.replace('>', '&gt;')}</td><td>$1</td><td>Free</td><td>Free</td><td>Free</td></tr>
      </table>`)
      const candidates = await discoverModels({ provider: 'opencode' })
      expect(candidates.find(model => model.id === 'new-free')?.description).toMatch(/^Pay as you go.*higher context tiers may apply/)
    },
  )

  it('reports a source failure instead of presenting the installed catalog as a fresh result', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('unavailable', { status: 503 }))))
    await expect(discoverModels({ provider: 'opencode-go' })).rejects.toThrow(/503/)
  })
})
