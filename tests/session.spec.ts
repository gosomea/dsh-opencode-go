/** Observe session affinity on real pi-ai HTTP requests without provider credentials. */

import { afterEach, describe, expect, it } from 'vitest'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import { sessionHeaders } from '../src/index.ts'
import { resolveProfiles, type PiAiProviderProfile } from '../src/provider.ts'
import { memoryAuth } from './auth-double.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'

afterEach(closeMockServers)

function adapterOf(provider: string, profile: PiAiProviderProfile): PiAiAdapter {
  const profiles = resolveProfiles({ [provider]: profile })
  return new PiAiAdapter({
    profiles: () => profiles,
    resolveApiKey: () => Promise.resolve('test-key'),
    auth: memoryAuth(),
  })
}

async function drain(adapter: PiAiAdapter, provider: string, sessionId?: string): Promise<void> {
  await Array.fromAsync(adapter.stream({
    provider,
    model: 'test-model',
    messages: [],
    ...sessionId === undefined ? {} : { sessionId: sessionId as NonNullable<GenerateOptions['sessionId']> },
  }))
}

describe('OpenCode session affinity on the wire', () => {
  it.each(['opencode', 'opencode-go'])('keeps %s conversations distinct across repeated and prepared requests', async (provider) => {
    const server = await mockServer(Array.from({ length: 4 }, () => ({ events: textEvents })))
    const adapter = adapterOf(provider, {
      api: 'openai-completions',
      baseURL: server.url,
      models: [{ id: 'test-model' }],
      headers: { 'X-OpenCode-Session': 'static-id', 'x-company': 'private', 'User-Agent': 'wrong' },
    })
    await drain(adapter, provider, 'session-first')
    await drain(adapter, provider, 'session-first')
    const prepared = await adapter.prepareCall(provider, 'test-model')
    await Array.fromAsync(prepared.stream({
      provider, model: 'test-model', messages: [],
      sessionId: 'session-first' as NonNullable<GenerateOptions['sessionId']>,
    }))
    await drain(adapter, provider, 'session-second')
    expect(server.headers.map(headers => headers['x-opencode-session'])).toEqual([
      'session-first', 'session-first', 'session-first', 'session-second',
    ])
    expect(server.headers[0]?.['x-company']).toBe('private')
    expect(server.headers[0]?.['user-agent']).not.toBe('wrong')
  })

  it.each(['openai-completions', 'openai-responses', 'anthropic-messages'] as const)(
    'sends the header through %s', async (api) => {
      const server = await mockServer([{ status: 400, body: '{"error":{"message":"wire probe"}}' }])
      const adapter = adapterOf('opencode-go', {
        api, baseURL: server.url, models: [{ id: 'test-model' }],
      })
      await drain(adapter, 'opencode-go', 'session-protocol')
      expect(server.headers).toHaveLength(1)
      expect(server.headers[0]?.['x-opencode-session']).toBe('session-protocol')
    },
  )

  it('allocates a fresh UUID for each standalone request without a session', async () => {
    const server = await mockServer([{ events: textEvents }, { events: textEvents }])
    const adapter = adapterOf('opencode-go', {
      api: 'openai-completions', baseURL: server.url, models: [{ id: 'test-model' }],
    })
    await drain(adapter, 'opencode-go')
    await drain(adapter, 'opencode-go')
    const ids = server.headers.map(headers => headers['x-opencode-session'])
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(ids[0]).not.toBe(ids[1])
  })
})


it.each([
  ['openai-completions', '/chat/completions'],
  ['openai-responses', '/responses'],
  ['anthropic-messages', '/v1/messages?beta=true'],
])('dispatches adopted model settings through %s', async (api, path) => {
  const server = await mockServer([{ status: 400, body: '{"error":{"message":"wire probe"}}' }])
  const adapter = adapterOf('opencode-go', { models: [{ id: 'test-model', api, baseURL: server.url }] })
  await drain(adapter, 'opencode-go', 'adopted-session')
  expect(server.paths).toEqual([path])
  expect(server.headers[0]?.['x-opencode-session']).toBe('adopted-session')
})

it('keeps concurrent calls and mixed model protocols on their own endpoints', async () => {
  const a = await mockServer([{ events: textEvents }])
  const b = await mockServer([{ status: 400, body: '{"error":{"message":"probe"}}' }])
  const profiles = resolveProfiles({ opencode: { models: [
    { id: 'a', api: 'openai-completions', baseURL: a.url },
    { id: 'b', api: 'anthropic-messages', baseURL: b.url },
  ] } })
  const adapter = new PiAiAdapter({ profiles: () => profiles, resolveApiKey: async () => 'test-key', auth: memoryAuth() })
  const execute = (model: string) => Array.fromAsync(adapter.stream({ provider: 'opencode', model, messages: [], sessionId: `session-${model}` as NonNullable<GenerateOptions['sessionId']> }))
  await Promise.all([execute('a'), execute('b')])
  expect(a.paths).toEqual(['/chat/completions'])
  expect(b.paths).toEqual(['/v1/messages?beta=true'])
  expect(a.headers[0]?.['x-opencode-session']).toBe('session-a')
  expect(b.headers[0]?.['x-opencode-session']).toBe('session-b')
})
