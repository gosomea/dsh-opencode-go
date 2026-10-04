/** Move existing OpenCode profiles to the plugin after `dsh plugin add`; dry run unless --apply. */
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs, isDeepStrictEqual } from 'node:util'
import { randomUUID } from 'node:crypto'
import yaml from 'js-yaml'
import { Catalog, providerProfiles, resolveProfiles as resolvePiAiProfiles } from '../lib/index.js'
const { values } = parseArgs({ options: { home: { type: 'string' }, profile: { type: 'string', default: 'web' }, apply: { type: 'boolean', default: false } } })
if (!values.home) throw new Error('Usage: node scripts/migrate.mjs --home /absolute/.dsh [--profile web] [--apply]')
if (!/^[a-zA-Z0-9_-]+$/.test(values.profile)) throw new Error('Invalid profile name')
const home = resolve(values.home), dir = join(home, 'profiles', values.profile), path = join(dir, 'cordis.patch.yml')
const pluginManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'))
if (!manifest.dsh?.profile?.bundles?.includes(pluginManifest.name)) throw new Error('Install with dsh plugin --profile <profile> add link:/absolute/plugin before migration')
// Preserve Loader expressions as inert nodes; never evaluate user configuration.
const expr = new yaml.Type('tag:yaml.org,2002:js', { kind: 'scalar', construct: value => ({ __jsExpr: value }), predicate: value => !!value && typeof value === 'object' && '__jsExpr' in value, represent: value => value.__jsExpr })
const schema = yaml.JSON_SCHEMA.extend(expr)
const original = await readFile(path, 'utf8'), rows = yaml.load(original, { schema })
if (!Array.isArray(rows)) throw new Error('Expected a profile patch array')
const source = rows.filter(row => row.id === 'llm-pi-ai')
const target = rows.filter(row => row.id === 'opencode-go')
if (source.length !== 1 || target.length > 1) throw new Error('Migration needs one llm-pi-ai patch and at most one opencode-go patch; resolve layered/duplicate rows first')
const current = source[0].config ?? {}, providers = structuredClone(current.providers ?? {})
const plugin = target[0] ?? { id: 'opencode-go', config: {} }
plugin.config ??= {}
const incoming = plugin.config.providers ?? {}
const moved = ['opencode-go', 'opencode'].filter(route => providers[route] !== undefined)
if (moved.length === 0 && current.excludedProviders === undefined) { console.log('No OpenCode providers remain in llm-pi-ai; configuration left unchanged.'); process.exit(0) }
if ((current.excludedProviders ?? []).some(route => !['opencode', 'opencode-go'].includes(route))) throw new Error('Legacy exclusions include other providers; review them before migration')
for (const route of moved) {
  if (incoming[route] !== undefined) throw new Error(`Both plugins configure ${route}; resolve ownership before migration`)
  if (providers[route].api !== undefined || providers[route].baseURL !== undefined) throw new Error(`Review custom endpoint/protocol for ${route} before migration`)
}
const cache = new Catalog(join(home, 'plugins', 'dsh-opencode-go', 'catalog-v1.json'), 30000)
await cache.load()
const routes = [...new Set([...Object.keys(incoming), ...moved])]
await cache.refresh(routes, () => {}, () => {})
const snapshot = cache.status().snapshot
const retained = []
for (const route of moved) {
  const prior = providers[route], live = new Map(snapshot.providers[route].map(model => [model.id, model]))
  const overrides = { ...prior.modelOverrides }
  for (const model of prior.models ?? []) {
    const candidate = live.get(model.id)
    const baseline = candidate ? { ...candidate.configuration, name: candidate.name, description: candidate.description, contextWindow: candidate.contextWindow, maxTokens: candidate.maxTokens, input: candidate.inputModalities } : {}
    const explicit = Object.fromEntries(Object.entries(model).filter(([key, value]) => !['id', 'api', 'baseURL', 'description'].includes(key) && !isDeepStrictEqual(value, baseline[key])))
    if (Object.keys(explicit).length) overrides[model.id] = { ...overrides[model.id], ...explicit }
    if (!candidate || candidate.unavailableReason) retained.push(`${route}/${model.id}`)
  }
  const { models, modelOverrides, ...rest } = prior
  incoming[route] = { ...rest, ...(Object.keys(overrides).length ? { modelOverrides: overrides } : {}) }
  delete providers[route]
}
plugin.config.providers = incoming
resolvePiAiProfiles(providerProfiles(snapshot, incoming))
source[0].config = { ...current, providers, excludedProviders: undefined }
if (!target.length) rows.push(plugin)
const report = { moved, retainedOverridesForUnavailable: retained, routes: Object.fromEntries(routes.map(route => [route, { listed: snapshot.providers[route].length, chat: snapshot.providers[route].filter(x => !x.unavailableReason).length, free: snapshot.providers[route].filter(x => x.description?.startsWith('Free')).map(x => x.id) }])) }
console.log(JSON.stringify(report, null, 2))
if (values.apply) {
  const backupDir = join(home, 'backups', 'dsh-opencode-go', new Date().toISOString().replaceAll(':', '-'))
  await mkdir(backupDir, { recursive: true, mode: 0o700 })
  await writeFile(join(backupDir, 'cordis.patch.yml'), original, { mode: 0o600, flag: 'wx' })
  if (await readFile(path, 'utf8') !== original) throw new Error('Profile changed concurrently; retry migration')
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, yaml.dump(rows, { schema, lineWidth: -1, noRefs: true }), { mode: 0o600, flag: 'wx' })
  await rename(temporary, path)
  console.log(`Migrated; exact profile backup: ${join(backupDir, 'cordis.patch.yml')}`)
} else console.log('Dry run; profile unchanged. Public catalog cache refreshed. Pass --apply to migrate.')
