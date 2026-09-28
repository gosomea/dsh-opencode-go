/** OpenCode-specific routing, public metadata refresh and pricing, independent of the generic pi-ai plugin. */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { assertUsableApiKey, LlmError, resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { AdapterRegistrationHandle, DirectoryRegistrationHandle, GenerateOptions } from '@deepseek-ai/dsh-llm'
import { Config as PiAiConfig, PiAiAdapter, resolvePiAiProfiles as resolveProfiles } from '@deepseek-ai/dsh-llm-pi-ai'
import type { PiAiProviderProfile, ResolvedPiAiProviderProfile, PiAiAuthInjection } from '@deepseek-ai/dsh-llm-pi-ai'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { Catalog, providerProfiles, type CatalogSnapshot, type Route } from './catalog.ts'

export { Catalog, modelProfiles, providerProfiles, validateSnapshot } from './catalog.ts'
export { discoverOpenCodeModels } from './discovery.ts'

/** Plugin settings. Credentials and capability overrides belong to the user; discovered metadata stays in the cache. */
export interface Config {
  /** OpenCode route settings; only opencode-go and opencode are accepted. */
  providers: Volatile<Record<string, PiAiProviderProfile>>
  /** Public catalog cache file; defaults below DSH_HOME. */
  cachePath: string
  /** Periodic refresh cadence in milliseconds; zero disables the timer. */
  refreshIntervalMs: number
  /** Maximum duration of a public-source refresh in milliseconds. */
  sourceTimeoutMs: number
}
/** Plain configuration consumed by the plugin schema. */
export interface Options {
  providers?: Record<string, PiAiProviderProfile>
  cachePath?: string
  refreshIntervalMs?: number
  sourceTimeoutMs?: number
}
export const Config = z.object({
  providers: PiAiConfig.dict!['providers']!,
  cachePath: z.string().default(''),
  refreshIntervalMs: z.number().min(0).default(21600000),
  sourceTimeoutMs: z.number().min(1000).max(120000).default(30000),
}) as z<Options, Config>
export const name = 'opencode-go'
export const inject = ['llm']

/** Stable conversation affinity for official OpenCode requests.
 * @param options - the actual inference call, including the durable Session id.
 * @returns per-request headers; standalone calls receive their own UUID.
 */
export function sessionHeaders(options: GenerateOptions): Record<string, string> {
  return { 'x-opencode-session': options.sessionId === undefined ? randomUUID() : String(options.sessionId) }
}

/** Explicitly API-key-only auth. No implicit OpenCode account or unrelated environment fallback. */
function keyOnlyAuth(): PiAiAuthInjection {
  return {
    credentials: {
      read: () => Promise.resolve(undefined), list: () => Promise.resolve([]), delete: () => Promise.resolve(),
      modify: () => Promise.reject(new Error('OpenCode plugin uses DSH credential references; OAuth is not configured')),
    },
    authContext: { env: () => Promise.resolve(undefined), fileExists: () => Promise.resolve(false) },
  }
}

/** Register canonical provider routes and a Models-page companion API.
 * @param ctx - the Cordis lifecycle owner.
 * @param config - validated settings, with volatile user provider profiles.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const catalog = new Catalog(config.cachePath || join(resolveDshHome(), 'plugins', 'dsh-opencode-go', 'catalog-v1.json'), config.sourceTimeoutMs)
  await catalog.load()
  let memo: { snapshot: CatalogSnapshot; raw: ReturnType<Config['providers']['get']>; profiles: ReadonlyMap<string, ResolvedPiAiProviderProfile> } | undefined
  const profiles = (): ReadonlyMap<string, ResolvedPiAiProviderProfile> => {
    const snapshot = catalog.status().snapshot
    const raw = config.providers.get()
    if (memo?.snapshot === snapshot && memo.raw === raw) return memo.profiles
    const resolved = resolveProfiles(providerProfiles(snapshot, structuredClone(raw) as Record<string, PiAiProviderProfile>))
    memo = { snapshot, raw, profiles: resolved }
    return resolved
  }
  profiles()
  const adapter = new PiAiAdapter({
    profiles, requestHeaders: sessionHeaders, auth: keyOnlyAuth(),
    resolveApiKey: async (provider, profile) => {
      const ref = profile.apiKeyEnv
      if (ref === undefined) throw new LlmError(`Set apiKeyEnv for ${provider} in opencode-go settings`, 'MISSING_CREDENTIAL')
      const store = ctx.get('credentials')
      const value = store === undefined ? launchEnvironmentOf(ctx).get(ref)?.value : (await store.resolve(ref))?.value
      if (!value) throw new LlmError(`No credential configured for ${provider} (${ref})`, 'MISSING_CREDENTIAL')
      return assertUsableApiKey(value, 'opencode-go', ref)
    },
    resolveAttachments: () => ctx.get('attachments'),
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(attachments, path => ctx.get('fs')?.processPathFromHostPath(path), ref),
  })
  let registration: AdapterRegistrationHandle | undefined
  let directory: DirectoryRegistrationHandle | undefined
  const ns = ctx.fiber.entry?.options.id ?? 'opencode-go'
  const update = (): void => {
    const routes = [...profiles().keys()]
    const entries = routes.map(provider => ({ provider, displayName: provider === 'opencode-go' ? 'OpenCode Go' : 'OpenCode Zen',
      settingsNs: ns, settingsPath: ['providers', provider], declared: false }))
    if (routes.length > 0) {
      if (registration === undefined) registration = ctx.llm.registerAdapter(routes, adapter)
      else registration.replace(routes)
      if (directory === undefined) directory = ctx.llm.registerConfigurableProviders(entries)
      else directory.replace(entries)
    } else { registration?.replace([]); directory?.replace([]) }
  }
  update()
  const enabledRoutes = (): Route[] => Object.keys(config.providers.get()).sort() as Route[]
  const refresh = async (): Promise<void> => {
    let routes: Route[]
    do {
      routes = enabledRoutes()
      await catalog.refresh(routes,
        snapshot => { resolveProfiles(providerProfiles(snapshot, structuredClone(config.providers.get()) as Record<string, PiAiProviderProfile>)) },
        update)
    } while (JSON.stringify(routes) !== JSON.stringify(enabledRoutes()))
  }
  ctx.on('internal/config', function (this: import('@deepseek-ai/cordis').Fiber, _raw, next) {
    const raw: unknown = next()
    if (this !== ctx.fiber) return raw
    const candidate = Config(raw as Options)
    resolveProfiles(providerProfiles(catalog.status().snapshot, structuredClone(candidate.providers.get()) as Record<string, PiAiProviderProfile>))
    return raw
  })
  ctx.llm.registerModelDiscovery(ns, async (request, signal) => {
    if (request.provider !== 'opencode-go' && request.provider !== 'opencode') throw new Error('Choose OpenCode Go or Zen')
    signal?.throwIfAborted()
    await refresh()
    signal?.throwIfAborted()
    return catalog.status().snapshot.providers[request.provider] ?? []
  })
  ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: true }, ctx.fiber)) })
  ctx.on('loader/volatile-update', () => {
    try { update(); void refresh().catch(error => ctx.logger.warn(String(error))) }
    catch (error) { ctx.logger.error(String(error)) }
  })
  ctx.effect(() => {
    void refresh().catch(error => ctx.logger.warn(`OpenCode catalog refresh: ${String(error)}`))
    const timer = config.refreshIntervalMs === 0 ? undefined : setInterval(() => {
      void refresh().catch(error => ctx.logger.warn(`OpenCode catalog refresh: ${String(error)}`))
    }, config.refreshIntervalMs)
    timer?.unref()
    return async () => { if (timer !== undefined) clearInterval(timer); await catalog.dispose() }
  }, 'OpenCode catalog refresh')
  ctx.inject(['webServer'], web => {
    web.effect(() => web.webServer.register({ kind: 'exact', path: '/api/opencode-go/catalog', handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'POST') { res.writeHead(405); res.end(); return }
      if (req.method === 'POST') {
        // Browser writes must originate in the authenticated Host page; do not enable cross-origin refreshes.
        const origin = req.headers.origin
        if (origin !== undefined && URL.parse(origin)?.host !== req.headers.host) { res.writeHead(403); res.end(); return }
        try { await refresh() } catch { /* The status response preserves the error and last successful snapshot. */ }
      }
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'no-store')
      res.end(JSON.stringify(catalog.status()))
    } }))
  })
}
