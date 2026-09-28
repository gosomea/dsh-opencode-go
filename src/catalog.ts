/** Public-source catalog cache. Failed refreshes keep the last validated snapshot and expose the failure. */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { LlmDiscoveredModel } from '@deepseek-ai/dsh-llm'
import { resolvePiAiProfiles as resolveProfiles, type PiAiModelProfile, type PiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { discoverOpenCodeModels } from './discovery.ts'

/** Canonical provider ids preserve the model identities in existing Sessions. */
export const ROUTES = ['opencode-go', 'opencode'] as const
/** One supported OpenCode billing route. */
export type Route = typeof ROUTES[number]
/** Durable public metadata; never contains inference credentials or user overrides. */
export interface CatalogSnapshot {
  version: 1
  observedAt: string
  providers: Partial<Record<Route, LlmDiscoveredModel[]>>
}
/** Catalog status returned to the plugin UI. */
export interface CatalogStatus {
  snapshot: CatalogSnapshot
  refreshing: boolean
  error: string | null
}

/** Convert verified discovery metadata to adapter settings, preserving explicit user tuning.
 * @param candidates - exact-id live entries.
 * @param overrides - explicit per-model user settings.
 * @returns adoptable model profiles.
 */
export function modelProfiles(candidates: readonly LlmDiscoveredModel[], overrides: readonly PiAiModelProfile[] = []): PiAiModelProfile[] {
  const byId = new Map(overrides.map(model => [model.id, model]))
  return candidates.filter(model => model.unavailableReason === undefined).map(model => {
    const custom = byId.get(model.id)
    return {
      ...model.configuration, ...custom, id: model.id,
      api: model.configuration?.['api'] as NonNullable<PiAiModelProfile['api']>,
      baseURL: model.configuration?.['baseURL'] as string,
      ...model.name === undefined ? {} : { name: custom?.name ?? model.name },
      ...model.description === undefined ? {} : { description: model.description },
      ...model.contextWindow === undefined ? {} : { contextWindow: custom?.contextWindow ?? model.contextWindow },
      ...model.maxTokens === undefined ? {} : { maxTokens: custom?.maxTokens ?? model.maxTokens },
      ...model.inputModalities === undefined ? {} : { input: custom?.input ?? [...model.inputModalities] },
    }
  })
}

/** Validate cached public metadata before using it to construct network routes.
 * @param value - parsed cache JSON.
 * @returns validated snapshot; rejects malformed or redirected entries.
 */
export function validateSnapshot(value: unknown): CatalogSnapshot {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid OpenCode catalog cache')
  const state = value as CatalogSnapshot
  if (state.version !== 1 || typeof state.observedAt !== 'string' || !Number.isFinite(Date.parse(state.observedAt))
    || typeof state.providers !== 'object' || state.providers === null) throw new Error('Invalid OpenCode catalog cache version or date')
  for (const [provider, models] of Object.entries(state.providers)) {
    if (!ROUTES.some(route => route === provider) || !Array.isArray(models)) throw new Error('Invalid OpenCode catalog route')
    const root = `https://opencode.ai/zen${provider === 'opencode-go' ? '/go' : ''}`
    const ids = new Set<string>()
    for (const model of models) {
      if (typeof model !== 'object' || model === null || typeof model.id !== 'string' || !model.id || ids.has(model.id)) {
        throw new Error('Invalid or duplicate OpenCode model id')
      }
      ids.add(model.id)
      if (model.name !== undefined && typeof model.name !== 'string') throw new Error('Invalid model name')
      if (model.description !== undefined && typeof model.description !== 'string') throw new Error('Invalid pricing description')
      if (model.unavailableReason !== undefined) {
        if (typeof model.unavailableReason !== 'string') throw new Error('Invalid model diagnostic')
        continue
      }
      const api = model.configuration?.['api']
      if (!['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'].includes(String(api))) {
        throw new Error('Unverified model protocol in cache')
      }
      if (model.configuration?.['baseURL'] !== (api === 'anthropic-messages' ? root : `${root}/v1`)) {
        throw new Error('OpenCode cache cannot redirect model requests')
      }
      for (const count of [model.contextWindow, model.maxTokens]) {
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0) throw new Error('Invalid model capacity')
      }
      if (!Array.isArray(model.inputModalities) || model.inputModalities.length === 0
        || model.inputModalities.some(input => input !== 'text' && input !== 'image')) throw new Error('Invalid model input types')
    }
    resolveProfiles({ [provider]: { models: modelProfiles(models) } })
  }
  return state
}

/** Own refresh coalescing, cancellation, disk commit and last-known-good publication. */
export class Catalog {
  private snapshot: CatalogSnapshot = { version: 1, observedAt: new Date(0).toISOString(), providers: {} }
  private error: string | null = null
  private pending: Promise<void> | undefined
  private readonly controller = new AbortController()
  constructor(
    private readonly path: string,
    private readonly timeoutMs: number,
    private readonly discover = discoverOpenCodeModels,
  ) {}

  /** Read an optional existing cache without contacting upstream sources. */
  async load(): Promise<void> {
    try { this.snapshot = validateSnapshot(JSON.parse(await readFile(this.path, 'utf8'))) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.error = `Cache rejected: ${error instanceof Error ? error.message : String(error)}`
    }
  }
  /** Return public immutable-by-convention metadata for one request snapshot. */
  status(): CatalogStatus { return { snapshot: this.snapshot, refreshing: this.pending !== undefined, error: this.error } }
  /** Refresh selected providers atomically; overlapping refreshes join the same operation.
   * @param routes - enabled provider ids.
   * @param validate - check candidate data against current user overrides before committing.
   * @param committed - publish adapter invalidation after the cache commit.
   * @returns completion of the coalesced refresh.
   */
  refresh(routes: readonly Route[], validate: (state: CatalogSnapshot) => void, committed: () => void): Promise<void> {
    if (this.pending !== undefined) return this.pending
    this.pending = this.perform(routes, validate, committed).finally(() => { this.pending = undefined })
    return this.pending
  }
  private async perform(routes: readonly Route[], validate: (state: CatalogSnapshot) => void, committed: () => void): Promise<void> {
    let temporary: string | undefined
    try {
      const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(this.timeoutMs)])
      const entries = await Promise.all(routes.map(async route => [route, await this.discover(route, signal)] as const))
      signal.throwIfAborted()
      const next = validateSnapshot({ version: 1, observedAt: new Date().toISOString(), providers: Object.fromEntries(entries) })
      validate(next)
      await mkdir(dirname(this.path), { recursive: true })
      temporary = `${this.path}.${randomUUID()}.tmp`
      await writeFile(temporary, JSON.stringify(next) + '\n', { mode: 0o600 })
      signal.throwIfAborted()
      validate(next)
      await rename(temporary, this.path)
      temporary = undefined
      this.snapshot = next
      this.error = null
      committed()
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      if (temporary !== undefined) await rm(temporary, { force: true })
    }
  }
  /** Cancel ongoing I/O and wait for the owned operation to settle before unloading. */
  async dispose(): Promise<void> { this.controller.abort(); await this.pending?.catch(() => { /* Cancellation is already exposed through catalog status. */ }) }
}

/** Build configured routes from remote metadata plus user-owned settings.
 * @param snapshot - committed public catalog.
 * @param configured - user provider settings.
 * @returns adapter inputs containing live models only.
 */
export function providerProfiles(snapshot: CatalogSnapshot, configured: Readonly<Record<string, PiAiProviderProfile>>): Record<string, PiAiProviderProfile> {
  return Object.fromEntries(Object.entries(configured).map(([provider, profile]) => {
    if (!ROUTES.some(route => route === provider)) throw new Error(`Unsupported OpenCode provider: ${provider}`)
    if (profile.api !== undefined || profile.baseURL !== undefined) throw new Error('OpenCode plugin uses official per-model endpoints; remove route api/baseURL overrides')
    const overrides = profile.models ?? Object.entries(profile.modelOverrides ?? {}).map(([id, value]) => ({ id, ...value }))
    const { models: _models, modelOverrides: _overrides, ...rest } = profile
    return [provider, { ...rest, models: modelProfiles(snapshot.providers[provider as Route] ?? [], overrides) }]
  }))
}
