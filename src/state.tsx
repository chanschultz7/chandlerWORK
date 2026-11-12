// Global app state: page, reporting month, comparison and cross-filters. Everything lives in the URL
// hash (#/page?m=17&site=0,1&pri=P2&cat=3) so a link reopens the same view.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dataset, Pri } from './data/model';
import type { Ctx } from './metrics';

export type PageId = 'executive' | 'scorecard' | 'service-desk' | 'clinical' | 'infrastructure' | 'incidents' | 'security' | 'sites' | 'projects' | 'reference';
export type Compare = 'prior' | 'py';
export type FilterField = 'sites' | 'pri' | 'cat';

interface Route { page: PageId; mi: number; compare: Compare; sites: number[]; pri: Pri[]; cat: number[]; tab?: string; site?: number }

const PAGES: PageId[] = ['executive', 'scorecard', 'service-desk', 'clinical', 'infrastructure', 'incidents', 'security', 'sites', 'projects', 'reference'];

function parse(hash: string, ds: Dataset): Route {
  const [path, q = ''] = hash.replace(/^#\/?/, '').split('?');
  const p = new URLSearchParams(q);
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(',').filter(Boolean) : []);
  const mi = Number(p.get('m'));
  return {
    page: (PAGES as string[]).includes(path) ? (path as PageId) : 'executive',
    mi: Number.isInteger(mi) && p.has('m') && mi >= 0 && mi <= ds.currentMi ? mi : ds.currentMi,
    compare: p.get('cmp') === 'py' ? 'py' : 'prior',
    sites: list('site').map(Number).filter((n) => n >= 0 && n < ds.sites.length),
    pri: list('pri') as Pri[],
    cat: list('cat').map(Number),
    tab: p.get('tab') ?? undefined,
    site: p.has('s') ? Number(p.get('s')) : undefined,
  };
}

function build(r: Route, ds: Dataset): string {
  const p = new URLSearchParams();
  if (r.mi !== ds.currentMi) p.set('m', String(r.mi));
  if (r.compare === 'py') p.set('cmp', 'py');
  if (r.sites.length) p.set('site', r.sites.join(','));
  if (r.pri.length) p.set('pri', r.pri.join(','));
  if (r.cat.length) p.set('cat', r.cat.join(','));
  if (r.tab) p.set('tab', r.tab);
  if (r.site !== undefined) p.set('s', String(r.site));
  const q = p.toString();
  return `#/${r.page}${q ? `?${q.replace(/%2C/g, ',')}` : ''}`;
}

interface AppValue {
  ds: Dataset;
  route: Route;
  ctx: Ctx;
  go: (page: PageId, extra?: Partial<Route>) => void;
  set: (patch: Partial<Route>) => void;
  toggle: (f: FilterField, v: number | Pri) => void;
  clear: (f?: FilterField) => void;
  paneOpen: boolean; setPaneOpen: (b: boolean) => void;
  toast: (msg: string) => void; toasts: { id: number; msg: string }[];
}

const Ctx_ = createContext<AppValue | null>(null);

export function AppProvider({ ds, children }: { ds: Dataset; children: ReactNode }) {
  const [hash, setHash] = useState(() => location.hash);
  const [paneOpen, setPaneOpen] = useState(() => window.innerWidth > 900);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const h = () => setHash(location.hash);
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const route = useMemo(() => parse(hash, ds), [hash, ds]);
  const nav = useCallback((r: Route) => {
    const h = build(r, ds);
    if (h !== location.hash) location.hash = h;
    setHash(h);
  }, [ds]);
  const set = useCallback((patch: Partial<Route>) => nav({ ...route, ...patch }), [nav, route]);
  const go = useCallback((page: PageId, extra: Partial<Route> = {}) => {
    nav({ ...route, tab: undefined, site: undefined, ...extra, page });
    document.querySelector('.canvas')?.scrollTo({ top: 0 });
  }, [nav, route]);
  const toggle = useCallback((f: FilterField, v: number | Pri) => {
    const cur = route[f] as (number | Pri)[];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    nav({ ...route, [f]: next });
  }, [nav, route]);
  const clear = useCallback((f?: FilterField) => nav(f ? { ...route, [f]: [] } : { ...route, sites: [], pri: [], cat: [] }), [nav, route]);
  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const ctx = useMemo<Ctx>(() => ({ mi: route.mi, sites: route.sites, pri: route.pri, cat: route.cat }), [route.mi, route.sites, route.pri, route.cat]);
  const value: AppValue = { ds, route, ctx, go, set, toggle, clear, paneOpen, setPaneOpen, toast, toasts };
  return <Ctx_.Provider value={value}>{children}</Ctx_.Provider>;
}

export function useApp() {
  const v = useContext(Ctx_);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

/** Comparison month index for the current route. */
export function compareMi(route: Route) { return route.compare === 'py' ? route.mi - 12 : route.mi - 1; }
