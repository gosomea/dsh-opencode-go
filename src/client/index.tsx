/** Models-page companion displaying Host-owned catalog data; no credentials enter the browser API. */
import { useEffect, useState, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { Button, Checkbox, Input, SegmentedControl, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CatalogStatus, Route } from '../catalog.ts'
import { en, zh } from './locales.ts'
import { PANEL_CSS } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'opencode-go': keyof typeof en }
}

type Translator = (key: keyof typeof en) => string

function rateParts(description: string | undefined): { input: string; output: string; cacheRead: string; cacheWrite: string; source: string } {
  const parts = description?.split(' · ') ?? []
  const read = (prefix: string): string => parts.find(part => part.startsWith(prefix))?.slice(prefix.length) ?? '—'
  const input = parts.find(part => part.startsWith('USD/1M tokens: input '))?.slice('USD/1M tokens: input '.length) ?? '—'
  const source = parts.slice(-2).filter(part => part === 'models.dev' || part === 'opencode.ai' || /^\d{4}-\d{2}-\d{2}$/.test(part)).join(' · ')
  return { input, output: read('output '), cacheRead: read('cache read '), cacheWrite: read('cache write '), source }
}

function installCss(): () => void {
  const style = document.createElement('style')
  style.dataset.pluginCss = 'dsh-opencode-go'
  style.textContent = PANEL_CSS
  document.head.append(style)
  return () => { style.remove() }
}

function CatalogPanel({ t }: { t: Translator }): ReactNode {
  const [status, setStatus] = useState<CatalogStatus | undefined>()
  const [failure, setFailure] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [route, setRoute] = useState<Route>('opencode')
  const [refreshing, setRefreshing] = useState(false)
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setRefreshing(true)
    void fetch('/api/opencode-go/catalog', { method: generation === 0 ? 'GET' : 'POST', credentials: 'same-origin', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const result = await response.json() as CatalogStatus
        if (!controller.signal.aborted) { setStatus(result); setFailure(undefined) }
      }).catch((error: Error) => { if (!controller.signal.aborted) setFailure(error.message) })
      .finally(() => { if (!controller.signal.aborted) setRefreshing(false) })
    return () => { controller.abort() }
  }, [generation])
  const models = (status?.snapshot.providers[route] ?? [])
    .filter(model => (!freeOnly || model.description?.startsWith('Free'))
      && `${model.id} ${model.name ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const observed = status?.snapshot.observedAt
  return <section className="ocg-panel" aria-label={t('title')} aria-busy={refreshing}>
    <div className="ocg-heading">
      <h3 className="ocg-title">{t('title')}</h3>
      <Button variant="outline" size="sm" disabled={refreshing} onClick={() => { setGeneration(value => value + 1) }}>{t(refreshing ? 'refreshing' : 'refresh')}</Button>
    </div>
    <p className="ocg-meta">{t('observed')}: {observed && Date.parse(observed) > 0 ? new Date(observed).toLocaleString() : '—'} · {models.length} {t('count')}</p>
    {failure || status?.error ? <p className="ocg-error" role="alert">{t('error')}: {failure ?? status?.error}</p> : null}
    <SegmentedControl id="opencode-catalog" className="ocg-tabs" value={route} onChange={setRoute} label={t('route')} options={[
      { value: 'opencode', label: `Zen · ${status?.snapshot.providers.opencode?.length ?? 0}` },
      { value: 'opencode-go', label: `Go · ${status?.snapshot.providers['opencode-go']?.length ?? 0}` },
    ]} />
    <div className="ocg-controls">
      <Input className="ocg-search" type="search" aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => { setQuery(event.target.value) }} />
      <Checkbox checked={freeOnly} onChange={setFreeOnly} label={t('free')} />
    </div>
    <div role="tabpanel" id={`opencode-catalog-${route}-panel`} aria-labelledby={`opencode-catalog-${route}`}>
    <p className="ocg-list-caption">{t(route === 'opencode-go' ? 'goRate' : 'zenRate')} · {t('rateUnit')}<span>{t('hoverHint')}</span></p>
    {models.length === 0 ? <p className="ocg-empty">{t(query || freeOnly ? 'noMatches' : 'empty')}</p> : <div className="ocg-table-scroll"><table className="ocg-table" aria-label={route === 'opencode-go' ? 'OpenCode Go' : 'OpenCode Zen'}>
      <colgroup><col className="ocg-model-column" />{[0, 1, 2, 3].map(column => <col key={column} />)}</colgroup>
      <thead><tr><th scope="col">{t('name')}</th>{(['input', 'output', 'cacheRead', 'cacheWrite'] as const).map(key => <th key={key} scope="col">{t(key)}</th>)}</tr></thead>
      <tbody>{models.map(model => {
      const free = model.description?.startsWith('Free') ?? false
      const rate = rateParts(model.description)
      const restricted = model.description?.includes('third-party access may be restricted') ?? false
      const details = [
        model.name ?? model.id,
        `${t('modelId')}: ${model.id}`,
        `${t('protocol')}: ${String(model.configuration?.['api'] ?? t('unknown'))}`,
        `${t('contextWindow')}: ${model.contextWindow?.toLocaleString() ?? '—'} · ${t('maxTokens')}: ${model.maxTokens?.toLocaleString() ?? '—'}`,
        `${t('source')}: ${rate.source || '—'}`,
        route === 'opencode-go' ? t('goBilling') : undefined,
        free ? t('freeWarning') : undefined,
        restricted ? t('restricted') : undefined,
        model.description?.includes('higher context tiers may apply') ? t('tiered') : undefined,
        model.unavailableReason,
      ].filter(Boolean).join('\n')
      return <Tooltip key={`${route}/${model.id}`} label={details} portal side="top" delayMs={250} maxWidth={380}>
        <tr tabIndex={0} className="ocg-model-row" aria-label={model.name ?? model.id}>
          <th scope="row"><span className="ocg-identity"><span className="ocg-model-name">{model.name ?? model.id}</span>{free ? <span className="ocg-free-dot" aria-label={t('freeRate')} /> : null}{model.unavailableReason ? <span className="ocg-unavailable-mark" aria-label={t('unavailable')}>!</span> : null}</span></th>
          {[rate.input, rate.output, rate.cacheRead, rate.cacheWrite].map((value, column) => <td key={column}>{value}</td>)}
        </tr>
      </Tooltip>
    })}</tbody></table></div>}
    </div>
  </section>
}

export const inject = ['slots', 'locale']
/** Contribute the catalog panel using the published Models footer extension.
 * @param ctx - browser plugin lifecycle owner.
 */
export function apply(ctx: Context): void {
  const ns = 'opencode-go'
  ctx.effect(installCss, 'OpenCode catalog styles')
  ctx.effect(() => ctx.locale.register(ns, { en, zh }), 'OpenCode locale dictionaries')
  const t = ctx.locale.bind(ns)
  ctx.slots.inject('settings.models.footer', () => ctx.slots.register({
    name: 'settings.models.footer', id: 'opencode-go', order: 10, inject: () => ({ t }),
  }, CatalogPanel))
}
