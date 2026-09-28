/** Real Loader composition, public metadata refresh and lifecycle withdrawal. */
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import * as PiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { afterEach, expect, it, vi } from 'vitest'
import * as OpenCode from '../src/index.ts'
let ctx: Context | undefined
let root: string | undefined
afterEach(async () => { await ctx?.fiber.dispose(); if (root) await rm(root, { recursive: true, force: true }); vi.unstubAllGlobals() })
it('loads a file through Loader, exposes refreshed rates, excludes duplicate directory ownership, and removes contributions on unload', async () => {
  root = await mkdtemp(join(tmpdir(), 'opencode-composition-'))
  const cache = join(root, 'catalog.json')
  const request = vi.fn<typeof fetch>(async input => {
    const url = String(input)
    if (url.endsWith('/v1/models')) return Response.json({ data: [{ id: 'fixture-free' }] })
    if (url.includes('models.dev')) return Response.json({ 'opencode-go': { npm: '@ai-sdk/openai-compatible', models: {
      'fixture-free': { name: 'Fixture', limit: { context: 10000, output: 2000 }, modalities: { input: ['text'] }, cost: { input: 0, output: 0 } },
    } } })
    return new Response('<table><tr><td>Fixture</td><td>fixture-free</td><td>https://opencode.ai/zen/go/v1/chat/completions</td><td>@ai-sdk/openai-compatible</td></tr></table>')
  })
  vi.stubGlobal('fetch', request)
  await writeFile(join(root, 'cordis.yml'), JSON.stringify([
    { id: 'llm', name: 'cordis:llm' },
    { id: 'llm-pi-ai', name: 'cordis:pi', config: { excludedProviders: ['opencode-go', 'opencode'] } },
    { id: 'opencode-go', name: 'cordis:opencode', config: { providers: { 'opencode-go': { apiKeyEnv: 'TEST_KEY' } }, cachePath: cache, refreshIntervalMs: 0 } },
  ]))
  ctx = new Context()
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  Object.assign(ctx.loader.builtins, { llm: LlmRuntime, pi: PiAi, opencode: OpenCode })
  const tree = await ctx.plugin(Include, { path: 'cordis.yml' })
  await ctx.loader.await()
  await vi.waitFor(async () => { expect(await ctx!.llm.listModels('opencode-go')).toMatchObject([{ id: 'fixture-free', description: expect.stringContaining('input $0') }]) })
  expect(JSON.parse(await readFile(cache, 'utf8')).providers['opencode-go']).toHaveLength(1)
  expect(ctx.llm.listConfigurableProviders().filter(x => x.provider === 'opencode-go')).toMatchObject([{ settingsNs: 'opencode-go' }])
  expect(ctx.llm.listConfigurableProviders().filter(x => x.provider === 'opencode')).toEqual([])
  expect(await ctx.llm.discoverModels('opencode-go', { provider: 'opencode-go' })).toMatchObject([{ description: expect.stringContaining('input $0'), configuration: { api: 'openai-completions' } }])
  await [...ctx.registry.get(OpenCode)!.fibers][0]!.dispose()
  expect(ctx.llm.listProviders()).toEqual([])
  expect(ctx.llm.listConfigurableProviders().some(x => x.settingsNs === 'opencode-go')).toBe(false)
  await expect(ctx.llm.discoverModels('opencode-go', { provider: 'opencode-go' })).rejects.toThrow()
  await tree.dispose()
})
