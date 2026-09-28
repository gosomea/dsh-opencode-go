import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Catalog, modelProfiles, providerProfiles, validateSnapshot, type Route } from '../src/catalog.ts'
const directories: string[] = []
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))) })
const candidate = (route: Route) => ({ id: 'new-free', name: 'New Free', description: 'Free (current rate)', contextWindow: 100000, maxTokens: 8000,
  inputModalities: ['text' as const], configuration: { api: 'openai-completions', baseURL: `https://opencode.ai/zen${route === 'opencode-go' ? '/go' : ''}/v1` } })
async function cache() { const root = await mkdtemp(join(tmpdir(), 'opencode-catalog-')); directories.push(root); return join(root, 'catalog.json') }

it('coalesces refreshes and retains the last success on metadata failure', async () => {
 const path=await cache(); const publish=vi.fn(); const discover=vi.fn(async (route: Route) => [candidate(route)])
 const catalog=new Catalog(path,10000,discover); await catalog.load()
 const first=catalog.refresh(['opencode-go'],()=>{},publish)
 expect(catalog.refresh(['opencode-go'],()=>{},publish)).toBe(first)
 await first; expect(discover).toHaveBeenCalledTimes(1); expect(publish).toHaveBeenCalledTimes(1)
 const saved=await readFile(path,'utf8')
 discover.mockRejectedValueOnce(new Error('source unavailable'))
 await expect(catalog.refresh(['opencode-go'],()=>{},publish)).rejects.toThrow('source unavailable')
 expect(await readFile(path,'utf8')).toBe(saved)
 expect(catalog.status().snapshot.providers['opencode-go']?.[0]?.id).toBe('new-free')
 expect(catalog.status().error).toBe('source unavailable')
 expect(catalog.status().refreshing).toBe(false)
 await catalog.dispose()
})
it('rejects redirected cached endpoints and does not install diagnostic-only models', () => {
 const model=candidate('opencode-go')
 expect(()=>validateSnapshot({version:1,observedAt:new Date().toISOString(),providers:{'opencode-go':[{...model,configuration:{...model.configuration,baseURL:'https://elsewhere.test'}}]}})).toThrow('redirect')
 expect(modelProfiles([{id:'jev',unavailableReason:'decision protocol'}])).toEqual([])
 expect(modelProfiles([model],[{id:model.id,contextWindow:90000}])[0]?.contextWindow).toBe(90000)
 expect(()=>providerProfiles({version:1,observedAt:'',providers:{}},{other:{}})).toThrow('Unsupported')
})
it('does not commit an invalid user override or a disposed refresh', async () => {
 const catalog=new Catalog(await cache(),10000,async route=>[candidate(route)])
 await expect(catalog.refresh(['opencode'],()=>{throw new Error('invalid override')},()=>{})).rejects.toThrow('invalid override')
 expect(catalog.status().snapshot.providers).toEqual({})
 await catalog.dispose()
 await expect(catalog.refresh(['opencode'],()=>{},()=>{})).rejects.toThrow()
})
