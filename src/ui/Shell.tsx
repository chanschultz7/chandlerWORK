// Workspace shell: header, page tabs, filter pane, canvas header (breadcrumb + applied filters),
// status bar and toasts.

import { useState, type ReactNode } from 'react';
import { PRI_LABEL, PRIORITIES, type Pri } from '../data/model';
import { compareMi, useApp, type FilterField, type PageId } from '../state';
import { Icon } from './icons';

export interface PageMeta { id: PageId; group: string; label: string; title: string; question: string; slides: string; filters: FilterField[] }

export const PAGES: PageMeta[] = [
  { id: 'executive', group: 'Summary', label: 'Executive Summary', title: 'Executive Summary', question: 'How did IT run this month, and what do leaders need to know or decide?', slides: 'MOR slide 3', filters: [] },
  { id: 'scorecard', group: 'Summary', label: 'Service Scorecard', title: 'Service Scorecard vs Targets', question: 'Which service levels met target this month, and which are trending the wrong way?', slides: 'MOR slides 4-5', filters: ['sites'] },
  { id: 'service-desk', group: 'Analytics', label: 'Service Desk', title: 'Service Desk: Demand, Speed and Experience', question: 'Is demand under control, and are users getting fast, good service?', slides: 'MOR slides 6-7', filters: ['sites', 'pri', 'cat'] },
  { id: 'clinical', group: 'Analytics', label: 'Clinical Apps', title: 'Clinical Applications: EHR and Clinical System Health', question: 'Were the EHR and clinical systems available when clinicians needed them?', slides: 'MOR slide 8', filters: [] },
  { id: 'infrastructure', group: 'Analytics', label: 'Infrastructure', title: 'Infrastructure Health: Stability, Protection and Capacity', question: 'Is the infrastructure stable, protected and sized for what is coming?', slides: 'MOR slide 9', filters: ['sites'] },
  { id: 'incidents', group: 'Analytics', label: 'Major Incidents', title: 'Major Incidents: P1 and P2 Events and Fixes', question: 'What broke, who was affected, and are the fixes on track?', slides: 'MOR slide 10 · A5', filters: ['sites'] },
  { id: 'security', group: 'Analytics', label: 'Security', title: 'Security and Compliance: Risk Posture', question: 'How exposed are we, and is protection coverage where it needs to be?', slides: 'MOR slide 11', filters: [] },
  { id: 'sites', group: 'Analytics', label: 'Sites', title: 'Site IT Tear Sheet', question: 'How is IT performing at each site compared with the rest of the system?', slides: 'MOR appendix tear sheet', filters: [] },
  { id: 'projects', group: 'Act', label: 'Projects & Actions', title: 'Projects, Actions and Decisions', question: 'Are projects on track, what are we doing next month, and what do we need decided?', slides: 'MOR slides 12-13', filters: [] },
  { id: 'reference', group: 'Appendix', label: 'SLAs & Definitions', title: 'Appendix: Contract Service Levels, Definitions and Rules', question: 'What does each measure mean, what did the contract promise, and how is status set?', slides: 'MOR A1-A4', filters: [] },
];
export const PAGE_BY_ID = Object.fromEntries(PAGES.map((p) => [p.id, p])) as Record<PageId, PageMeta>;

export function Header() {
  const { ds, route } = useApp();
  const scope = route.sites.length === 0 ? `All sites (${ds.sites.length})` : route.sites.length === 1 ? ds.sites[route.sites[0]].name : `${route.sites.length} sites`;
  const closed = route.mi < ds.currentMi + 1;
  return (
    <header className="app-header">
      <div className="brand">
        <span className="logo" aria-hidden="true"><Icon name="chart" size={14} /></span>
        <span className="product">IT Operations Analytics</span>
        <span className="sep" aria-hidden="true" />
        <span className="org">{ds.client} · {scope}</span>
      </div>
      <div className="header-meta">
        <span>Reporting period <b>{ds.months[route.mi].label}</b><span className={`pill ${closed ? 'pill-closed' : 'pill-prelim'}`}>{closed ? 'Closed' : 'Preliminary'}</span></span>
        <span className="hide-sm">Data through <b>{route.mi === ds.currentMi ? ds.dataThrough : ds.months[route.mi].label}</b></span>
        <span className="fresh-ok hide-sm"><span className="dot" aria-hidden="true" />Refreshed {ds.refreshed}</span>
      </div>
      <div className="header-right">
        <span className="user" title="Mock user">
          <span className="avatar" aria-hidden="true">SD</span>
          <span className="user-name hide-sm">Service Delivery Lead<span className="user-role">Managed IT Services</span></span>
        </span>
      </div>
    </header>
  );
}

export function NavTabs() {
  const { route, go, toast } = useApp();
  let lastGroup = '';
  return (
    <nav className="tabs no-print" aria-label="Dashboard pages">
      <div className="tab-list" role="tablist">
        {PAGES.map((p) => {
          const head = p.group !== lastGroup ? p.group : null;
          lastGroup = p.group;
          return (
            <span key={p.id} className="tab-wrap">
              {head && <span className="tab-group">{head}</span>}
              <button type="button" role="tab" aria-selected={route.page === p.id} className={`tab ${route.page === p.id ? 'on' : ''}`} onClick={() => go(p.id)}>{p.label}</button>
            </span>
          );
        })}
      </div>
      <div className="tab-actions">
        <button type="button" className="icon-btn" title="Copy link to this view" onClick={() => { try { void navigator.clipboard?.writeText(location.href); } catch { /* blocked */ } toast('Link copied. The period and filters are in the link.'); }}><Icon name="share" /></button>
        <button type="button" className="icon-btn" title="Print or save as PDF" onClick={() => window.print()}><Icon name="print" /></button>
      </div>
    </nav>
  );
}

function Slicer({ field, open: defOpen = false }: { field: FilterField; open?: boolean }) {
  const { ds, route, toggle, clear } = useApp();
  const [open, setOpen] = useState(defOpen);
  const opts: { key: number | Pri; label: string }[] = field === 'sites'
    ? ds.sites.map((s) => ({ key: s.key, label: s.name }))
    : field === 'pri' ? PRIORITIES.map((p) => ({ key: p, label: PRI_LABEL[p] }))
      : ds.categories.map((c) => ({ key: c.key, label: c.name }));
  const chosen = route[field] as (number | Pri)[];
  const name = field === 'sites' ? 'Site' : field === 'pri' ? 'Priority' : 'Ticket category';
  const summary = chosen.length === 0 ? 'All' : chosen.length === 1 ? opts.find((o) => o.key === chosen[0])?.label : `${chosen.length} selected`;
  return (
    <div className={`slicer ${chosen.length ? 'active' : ''}`}>
      <div className="slicer-head">
        <button type="button" className="slicer-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10} />
          <span className="slicer-name">{name}</span>
          <span className="slicer-sum" title={summary}>{summary}</span>
        </button>
        {chosen.length > 0 && <button type="button" className="icon-btn xs" title={`Clear ${name}`} onClick={() => clear(field)}><Icon name="close" size={10} /></button>}
      </div>
      {open && (
        <div className="slicer-body">
          <div className="slicer-list">
            {opts.map((o) => (
              <label key={String(o.key)} className={`slicer-opt ${chosen.includes(o.key) ? 'on' : ''}`}>
                <input type="checkbox" checked={chosen.includes(o.key)} onChange={() => toggle(field, o.key)} />
                <span className="opt-label">{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterPane() {
  const { ds, route, set, clear, paneOpen, setPaneOpen } = useApp();
  const meta = PAGE_BY_ID[route.page];
  const active = route.sites.length + route.pri.length + route.cat.length;
  if (!paneOpen) {
    return (
      <aside className="pane pane-closed no-print" aria-label="Filters (collapsed)">
        <button type="button" className="pane-rail" onClick={() => setPaneOpen(true)} title="Show filters">
          <Icon name="filter" /><span className="rail-text">Filters{active ? ` (${active})` : ''}</span>
        </button>
      </aside>
    );
  }
  return (
    <aside className="pane no-print" aria-label="Filters">
      <div className="pane-head">
        <span><Icon name="filter" size={13} /> Filters</span>
        <span className="pane-head-actions">
          <button type="button" className="link" disabled={!active} onClick={() => clear()}>Clear all</button>
          <button type="button" className="icon-btn" onClick={() => setPaneOpen(false)} title="Hide filter pane"><Icon name="chevronLeft" /></button>
        </span>
      </div>
      <div className="pane-scroll">
        <section className="pane-sec">
          <h4>Reporting period</h4>
          <label className="fld">Month
            <select value={route.mi} onChange={(e) => set({ mi: Number(e.target.value) })}>
              {[...ds.months].reverse().filter((m) => m.mi >= 0).map((m) => <option key={m.mi} value={m.mi}>{m.label}</option>)}
            </select>
          </label>
          <label className="fld">Compare to
            <select value={route.compare} onChange={(e) => set({ compare: e.target.value as 'prior' | 'py' })}>
              <option value="prior">Prior month ({ds.months[route.mi - 1]?.short ?? '–'})</option>
              <option value="py">Prior year ({ds.months[route.mi - 12]?.short ?? 'n/a'})</option>
            </select>
          </label>
          <div className="fld-note">Trends show up to 13 months. Data starts {ds.months[0].label}.</div>
        </section>
        <section className="pane-sec">
          <h4>Organization</h4>
          <Slicer field="sites" open={meta.filters.includes('sites')} />
          {!meta.filters.includes('sites') && meta.id !== 'executive' && <div className="fld-note">Most measures on this page are enterprise-wide; the site filter applies only where marked.</div>}
        </section>
        <section className="pane-sec">
          <h4>Service desk</h4>
          <Slicer field="pri" open={meta.filters.includes('pri') && route.pri.length > 0} />
          <Slicer field="cat" open={meta.filters.includes('cat') && route.cat.length > 0} />
          <div className="fld-note">Applies to ticket measures. Click bars on the Service Desk page to set these.</div>
        </section>
        <section className="pane-sec pane-legend">
          <h4>Status rules (A4)</h4>
          <div className="legend-list">
            <span><span className="stcell st-ok"><span className="status-shape" /></span> Green: meets target</span>
            <span><span className="stcell st-watch"><span className="status-shape" /></span> Amber: inside amber band, or meets target with an unfavorable 3-month trend</span>
            <span><span className="stcell st-off"><span className="status-shape" /></span> Red: outside amber band, or missed 3 months in a row</span>
            <span><span className="stcell st-none"><span className="status-shape" /></span> Grey: no target</span>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function CanvasHeader({ title, right, question }: { title?: string; right?: ReactNode; question?: string }) {
  const { route, ds, go } = useApp();
  const meta = PAGE_BY_ID[route.page];
  return (
    <div className="canvas-head">
      <div className="canvas-title-row">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <button type="button" className="crumb" onClick={() => go('executive')}>MOR {ds.months[route.mi].label}</button>
            <span className="crumb-sep">›</span><span className="crumb muted-crumb">{meta.group}</span>
            <span className="crumb-sep">›</span><span className="crumb current">{meta.label}</span>
            <span className="crumb-ref">{meta.slides}</span>
          </nav>
          <h1>{title ?? meta.title}</h1>
          <p className="question">{question ?? meta.question}</p>
        </div>
        {right && <div className="canvas-right">{right}</div>}
      </div>
      <AppliedFilters />
    </div>
  );
}

export function AppliedFilters() {
  const { ds, route, toggle, clear } = useApp();
  const cmp = ds.months[compareMi(route)];
  const chips: { f: FilterField; k: number | Pri; label: string }[] = [
    ...route.sites.map((k) => ({ f: 'sites' as const, k, label: ds.sites[k]?.short ?? String(k) })),
    ...route.pri.map((k) => ({ f: 'pri' as const, k, label: PRI_LABEL[k] })),
    ...route.cat.map((k) => ({ f: 'cat' as const, k, label: ds.categories[k]?.name ?? String(k) })),
  ];
  const FIELD = { sites: 'Site', pri: 'Priority', cat: 'Category' };
  return (
    <div className="applied" role="region" aria-label="Applied filters">
      <span className="applied-chip fixed"><span className="chip-field">Period</span> {ds.months[route.mi].label} <span className="muted">vs {route.compare === 'py' ? 'prior year' : 'prior month'} ({cmp?.short ?? 'n/a'})</span></span>
      {chips.map((c) => (
        <span key={`${c.f}-${c.k}`} className="applied-chip">
          <span className="chip-field">{FIELD[c.f]}</span>
          <button type="button" className="chip-val" onClick={() => toggle(c.f, c.k)} aria-label={`Remove ${c.label}`}>{c.label} <Icon name="close" size={9} /></button>
        </span>
      ))}
      {chips.length === 0 ? <span className="muted small">No filters applied. Click any bar or row to filter; use the pane on the left for more.</span>
        : <button type="button" className="link" onClick={() => clear()}>Clear all</button>}
    </div>
  );
}

export function StatusBar() {
  const { ds } = useApp();
  return (
    <footer className="statusbar no-print">
      <span><Icon name="database" size={11} /> Sources: IT service management, phone system, monitoring, backup console, patch and vulnerability tools, SIEM, project register</span>
      <span>All sources loaded</span>
      <span>Targets: Convene defaults, confirm per contract</span>
      <span className="synthetic">Mock data · {ds.client} and all sites, systems and figures are fictional</span>
    </footer>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>;
}
