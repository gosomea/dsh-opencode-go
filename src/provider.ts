/** OpenCode providers built over public pi-ai and DSH APIs; no Host source patches. */
import { randomUUID } from 'node:crypto'
import { Config as NativeConfig, PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { PiAiAdapterOptions, PiAiProviderProfile as NativeProfile, PiAiModelProfile as NativeModel, ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { LlmDiscoveredModel as NativeDiscoveredModel, GenerateOptions, LlmModelInfo } from '@deepseek-ai/dsh-llm'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { Api, Model, Provider, ProviderStreams, ThinkingLevelMap } from '@earendil-works/pi-ai'
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy'
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy'
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy'
import { googleGenerativeAIApi } from '@earendil-works/pi-ai/api/google-generative-ai.lazy'

/** Public metadata kept in the plugin because native discovery only exposes capacities. */
export interface LlmDiscoveredModel extends NativeDiscoveredModel {
  description?: string
  configuration?: Record<string, JsonValue>
  unavailableReason?: string
}
/** A live model's verified wire endpoint and optional display detail. */
export interface PiAiModelProfile extends NativeModel { api?: string; baseURL?: string; description?: string }
/** User tuning plus models materialized from the OpenCode catalog. */
export interface PiAiProviderProfile extends Omit<NativeProfile, 'models'> { models?: PiAiModelProfile[] }
/** Auth options derived from the public constructor, without private type exports. */
export type PiAiAuthInjection = PiAiAdapterOptions['auth']

const protocols: Record<string, () => ProviderStreams> = {
  'openai-completions': openAICompletionsApi,
  'openai-responses': openAIResponsesApi,
  'anthropic-messages': anthropicMessagesApi,
  'google-generative-ai': googleGenerativeAIApi,
}
const levels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** Request-local affinity, also used when the Host streams a prepared call.
 * @param options - current call identity.
 * @returns an OpenCode conversation header.
 */
export function sessionHeaders(options: Pick<GenerateOptions, 'sessionId'>): Record<string, string> {
  return { 'x-opencode-session': options.sessionId === undefined ? randomUUID() : String(options.sessionId) }
}

function headers(options: { headers?: Record<string, string | null> | undefined; sessionId?: string | undefined }): Record<string, string | null> {
  return { ...Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])), 'x-opencode-session': options.sessionId ?? randomUUID() }
}

/** Validate public native settings and construct plugin-owned mixed-protocol providers.
 * @param profiles - current live models and user overrides.
 * @returns immutable-per-request native adapter profiles.
 */
export function resolveProfiles(profiles: Readonly<Record<string, PiAiProviderProfile>>): Map<string, ResolvedPiAiProviderProfile> {
  return new Map(Object.entries(profiles).map(([provider, raw]) => {
    // The native schema supplies current timeout, image and stream defaults. Wire metadata belongs to this plugin.
    const { models: sourceModels = [], ...source } = raw
    const native = NativeConfig({ providers: { [provider]: { ...source, models: sourceModels.map(({ api: _api, baseURL: _url, description: _detail, ...model }) => model) } } }).providers.get()[provider]!
    const models: Model<Api>[] = sourceModels.map((entry, index) => {
      const model = native.models![index]!
      const api = entry.api ?? source.api
      const baseUrl = entry.baseURL ?? source.baseURL
      if (api === undefined || protocols[api] === undefined || !baseUrl || !URL.canParse(baseUrl)) throw new Error(`Invalid OpenCode protocol/endpoint: ${provider}/${entry.id}`)
      const efforts = model.reasoningEfforts
      let thinkingLevelMap: ThinkingLevelMap | undefined
      if (efforts !== undefined && efforts !== false) {
        if (!levels.some(level => level !== 'off' && efforts[level])) throw new Error(`No enabled reasoning effort: ${entry.id}`)
        thinkingLevelMap = {}
        for (const level of levels) {
          const value = efforts[level]
          if (value === null && level !== 'off' || value === '') throw new Error(`Invalid reasoning effort: ${entry.id}/${level}`)
          if (value !== null) thinkingLevelMap[level] = value ?? null
        }
      }
      return {
        id: model.id, name: model.name ?? model.id, provider, api, baseUrl,
        input: model.input?.length ? [...model.input] : [...native.defaultInput!],
        contextWindow: model.contextWindow ?? native.defaultContextWindow!, maxTokens: model.maxTokens ?? native.defaultMaxTokens!,
        reasoning: thinkingLevelMap !== undefined, ...(thinkingLevelMap ? { thinkingLevelMap } : {}),
        // DSH does not consume these rates; authoritative pricing stays in the catalog with unknown values preserved.
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        compat: { ...native.compat, ...model.compat },
      }
    })
    const piProvider: Provider = {
      id: provider, name: native.displayName ?? provider,
      auth: { apiKey: { name: provider, resolve: ({ credential }) => Promise.resolve({ auth: credential?.key === undefined ? {} : { apiKey: credential.key }, source: provider }) } },
      getModels: () => models,
      stream: (model, context, options) => protocols[model.api]!().stream(model, context, { ...options, headers: headers(options ?? {}) }),
      streamSimple: (model, context, options) => protocols[model.api]!().streamSimple(model, context, { ...options, headers: headers(options ?? {}) }),
    }
    const { models: _models, apiKeyEnv, retryPolicy, displayName, ...rest } = native
    return [provider, {
      ...rest, provider, displayName: displayName ?? provider,
      ...(apiKeyEnv === undefined ? {} : { apiKeyEnv: credentialRef(apiKeyEnv) }),
      streamIdleTimeoutMs: native.streamIdleTimeoutMs!, maxRequestImageBytes: native.maxRequestImageBytes!,
      requestImagePixelBudget: native.requestImagePixelBudget!, requestImageMaxBytes: native.requestImageMaxBytes!,
      retryPolicy: resolveRetryPolicy(retryPolicy, `OpenCode ${provider}`), piProvider, modelErrors: new Map(),
      configuredMaxTokens: new Map(sourceModels.flatMap(model => model.maxTokens === undefined ? [] : [[model.id, model.maxTokens]])),
    }]
  }))
}

/** Add catalog descriptions to the standard adapter without changing request execution. */
export class OpenCodeAdapter extends PiAiAdapter {
  constructor(options: PiAiAdapterOptions, private readonly descriptions: () => Readonly<Record<string, PiAiProviderProfile>>) { super(options) }
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const details = new Map(this.descriptions()[provider]?.models?.map(model => [model.id, model.description]))
    return (await super.listModels(provider)).map(model => {
      const description = details.get(model.id)
      return { ...model, ...(description === undefined ? {} : { description }) }
    })
  }
}
