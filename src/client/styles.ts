/** Plugin-scoped CSS bundled into client.js; every color follows DSH Web theme aliases. */
export const PANEL_CSS = `
.ocg-panel{display:flex;flex-direction:column;gap:12px;max-width:720px;margin-top:24px;color:var(--dsw-alias-label-primary)}
.ocg-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ocg-title{margin:0;font-size:16px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-primary)}
.ocg-meta{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.ocg-error{margin:0;padding:9px 12px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.ocg-tabs{align-self:flex-start;min-width:220px}
.ocg-controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ocg-search{box-sizing:border-box;flex:1 1 220px;min-width:0;max-width:360px}
.ocg-list-caption{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:0 0 8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.ocg-table-scroll{overflow-x:auto}
.ocg-table{border-collapse:collapse;table-layout:fixed;width:100%;min-width:470px;font-size:12px;line-height:18px;text-align:right;font-variant-numeric:tabular-nums}
.ocg-model-column{width:44%}
.ocg-table thead th{padding:8px 6px;border-bottom:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-tertiary);font-weight:400;white-space:nowrap}
.ocg-table th:first-child{text-align:left;padding-left:8px}
.ocg-table td:last-child,.ocg-table th:last-child{padding-right:8px}
.ocg-model-row th,.ocg-model-row td{height:36px;box-sizing:border-box;padding:7px 6px;border-bottom:.5px solid var(--dsw-alias-border-l2);font-weight:400;white-space:nowrap}
.ocg-model-row:hover,.ocg-model-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.ocg-model-row:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:-1px}
.ocg-identity{display:flex;align-items:center;gap:6px;min-width:0}
.ocg-model-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ocg-free-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}
.ocg-unavailable-mark{flex:none;color:var(--dsw-alias-state-warn-label);font-size:11px;font-weight:600}
.ocg-empty{margin:4px 0 0;padding:24px 14px;border:1px dashed var(--dsw-alias-border-l3);border-radius:12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
`
