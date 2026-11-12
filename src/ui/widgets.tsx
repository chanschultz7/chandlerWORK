import { useMemo, useState } from 'react';
import { PRI_LABEL, PRIORITIES, type Pri } from '../data/model';
import { fmt } from '../format';
import { evaluate, M, type Ctx } from '../metrics';
import { useApp, type FilterField } from '../state';
import { Chart } from './Chart';
import { barOption, COMPARE, lineOption, PRI_COLORS, SERIES, STATUS_COLOR } from './charts';
import { fm } from './common';
import { Icon } from './icons';
import { Visual } from './Visual';

export const DIM_LABEL: Record<FilterField, string> = { sites: 'Site', pri: 'Priority', cat: 'Category' };

export function dimMembers(dim: FilterField, ds: ReturnType<typeof useApp>['ds']): { key: number | Pri; label: string }[] {
  if (dim === 'sites') return ds.sites.map((s) => ({ key: s.key, label: s.short }));
  if (dim === 'pri') return PRIORITIES.map((p) => ({ key: p, label: PRI_LABEL[p] }));
  return ds.categories.map((c) => ({ key: c.key, label: c.name }));
}

// ---------------------------------------------------------------- Trend

export function TrendVisual({ id, months = 13, title, height = 220, extra, ctxOverride }: { id: string; months?: number; title?: string; height?: number; extra?: string[]; ctxOverride?: Partial<Ctx> }) {
  const { ds, ctx, set } = useApp();
  const [showPy, setShowPy] = useState(false);
  const c = { ...ctx, ...ctxOverride };
  const v = evaluate(ds, id, c, months);
  const f = fm(id);
  const labels = v.trend.map((t) => ds.months[t.mi].short);
  const py = v.trend.map((t) => M(id).compute(ds, { ...c, mi: t.mi - 12 }));
  const extras = (extra ?? []).map((x, i) => ({ name: M(x).short ?? M(x).name, data: evaluate(ds, x, c, months).trend.map((t) => t.value), color: SERIES[i + 1] }));
  const hasTarget = v.trend.some((t) => t.target !== null) && !extra?.length;
  const varying = new Set(v.trend.map((t) => t.target)).size > 1;
  const m = M(id);
  return (
    <Visual title={title ?? `${m.short ?? m.name}, monthly`} metricId={id}
      subtitle={`${v.trend.length} months to ${ds.months[c.mi].short} · click a month to set the period`}
      table={{ columns: ['Month', m.name, 'Target', 'Prior year'], rows: v.trend.map((t, i) => [ds.months[t.mi].label, f(t.value), f(t.target), f(py[i])]) }}
      actions={<label className="toggles"><input type="checkbox" checked={showPy} onChange={(e) => setShowPy(e.target.checked)} /> Prior year</label>}>
      <Chart height={height} ariaLabel={`${m.name} monthly trend`}
        option={lineOption({
          labels, fmt: f, selectedIndex: v.trend.length - 1,
          target: hasTarget ? (varying ? v.trend.map((t) => t.target) : v.trend[v.trend.length - 1].target) : null,
          series: [{ name: m.short ?? m.name, data: v.trend.map((t) => t.value), color: SERIES[0] }, ...extras, ...(showPy ? [{ name: 'Prior year', data: py, color: COMPARE, dashed: true }] : [])],
        })}
        onClick={(i) => set({ mi: v.trend[i].mi })} />
    </Visual>
  );
}

// ---------------------------------------------------------------- Breakdown (click to filter)

export function BreakdownVisual({ id, dim, title, subtitle, height, top, showCompare = true, statusColors, alt }: {
  id: string; dim: FilterField; title?: string; subtitle?: string; height?: number; top?: number; showCompare?: boolean; statusColors?: boolean; alt?: string[];
}) {
  const { ds, ctx, route, toggle } = useApp();
  const [cur, setCur] = useState(id);
  const mid = alt?.length && [id, ...alt].includes(cur) ? cur : id;
  const m = M(mid);
  const f = fm(mid);
  const rows = useMemo(() => dimMembers(dim, ds).map((mem) => {
    const c = { ...ctx, [dim]: [mem.key] } as Ctx;
    const v = evaluate(ds, mid, c, 1);
    return { ...mem, value: v.value, prior: route.compare === 'py' ? v.py : v.prior, status: v.status, target: v.target };
  }).filter((r) => r.value !== null), [ds, ctx, dim, mid, route.compare]);
  let list = m.unit === 'count' || m.better !== 'down' ? [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)) : [...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  if (dim === 'pri') list = rows;
  const more = top && list.length > top ? list.length - top : 0;
  if (top) list = list.slice(0, top);
  const chosen = (route[dim] as (number | Pri)[]);
  const selected = list.map((r, i) => (chosen.includes(r.key) ? i : -1)).filter((i) => i >= 0);
  const sameTarget = new Set(list.map((r) => r.target)).size === 1 ? list[0]?.target ?? null : null;
  const cmpName = route.compare === 'py' ? 'Prior year' : 'Prior month';
  const total = list.reduce((a, r) => a + (r.value ?? 0), 0);
  const isAvail = m.unit === 'pct' && (m.digits ?? 1) >= 2;
  return (
    <Visual title={title ?? `${m.short ?? m.name} by ${DIM_LABEL[dim].toLowerCase()}`} metricId={mid}
      subtitle={subtitle ?? `${ds.months[ctx.mi].label} · click a bar to filter${more ? ` · top ${top} of ${top! + more}` : ''}`}
      noData={list.length ? null : 'No data for the current filters.'}
      actions={alt?.length ? (
        <select className="sel-xs" value={mid} onChange={(e) => setCur(e.target.value)} aria-label="Measure">
          {[id, ...alt].map((x) => <option key={x} value={x}>{M(x).short ?? M(x).name}</option>)}
        </select>
      ) : undefined}
      table={{ columns: [DIM_LABEL[dim], m.name, cmpName, ...(m.unit === 'count' ? ['Share'] : [])], rows: list.map((r) => [r.label, f(r.value), f(r.prior), ...(m.unit === 'count' ? [fmt(total ? (r.value ?? 0) / total : null, 'pct')] : [])]) }}>
      <Chart height={height ?? Math.max(140, list.length * (showCompare ? 30 : 24) + 40)} ariaLabel={`${m.name} by ${DIM_LABEL[dim]}`}
        option={barOption({
          labels: list.map((r) => r.label), horizontal: true, fmt: f, target: sameTarget, selected,
          min: isAvail ? Math.min(0.99, ...list.map((r) => r.value ?? 1)) : undefined, max: isAvail ? 1 : undefined,
          colorBy: statusColors ? (i) => (list[i].status === 'ok' ? SERIES[0] : STATUS_COLOR[list[i].status]) : dim === 'pri' ? (i) => PRI_COLORS[String(list[i].key)] : undefined,
          series: showCompare
            ? [{ name: cmpName, data: list.map((r) => r.prior), color: COMPARE }, { name: ds.months[ctx.mi].short, data: list.map((r) => r.value), color: SERIES[0] }]
            : [{ name: ds.months[ctx.mi].short, data: list.map((r) => r.value), color: SERIES[0] }],
          labelsOn: true,
        })}
        onClick={(i) => { if (list[i]) toggle(dim, list[i].key); }} />
    </Visual>
  );
}

// ---------------------------------------------------------------- Decomposition tree

export function DecompositionTree({ id, dims, title }: { id: string; dims: FilterField[]; title: string }) {
  const { ds, ctx, set, toast } = useApp();
  const [order, setOrder] = useState<FilterField[]>(dims.slice(0, 2));
  const [path, setPath] = useState<(number | Pri)[]>([]);
  const f = fm(id);
  const total = evaluate(ds, id, ctx, 1).value;
  const levels = order.slice(0, path.length + 1).map((dim, li) => {
    const c: Ctx = { ...ctx };
    for (let k = 0; k < li; k++) (c as unknown as Record<string, unknown>)[order[k]] = [path[k]];
    const rows = dimMembers(dim, ds).map((mem) => ({ ...mem, value: M(id).compute(ds, { ...c, [dim]: [mem.key] } as Ctx) ?? 0 }))
      .filter((r) => r.value > 0 && (!(ctx[dim] as unknown[]).length || (ctx[dim] as unknown[]).includes(r.key))).sort((a, b) => b.value - a.value);
    return { dim, rows };
  });
  const used = new Set(order.slice(0, path.length + 1));
  const pick = (li: number, key: number | Pri) => {
    const p = path.slice(0, li); p[li] = key; setPath(p);
    if (order.length <= li + 1) { const nx = dims.find((d) => !order.slice(0, li + 1).includes(d)); if (nx) setOrder([...order.slice(0, li + 1), nx]); }
  };
  const apply = () => { const patch: Record<string, unknown> = {}; path.forEach((k, i) => { patch[order[i]] = [k]; }); set(patch); toast(`Applied ${path.length} filter${path.length === 1 ? '' : 's'} from the decomposition path.`); };
  return (
    <Visual title={title} metricId={id}
      subtitle={<>{M(id).name}, {ds.months[ctx.mi].label}: <b>{f(total)}</b> · click a node to split it by the next dimension</>}
      table={{ columns: ['Level', 'Member', M(id).name], rows: levels.flatMap((l, li) => l.rows.map((r) => [`Level ${li + 1}: ${DIM_LABEL[l.dim]}`, r.label, f(r.value)])) }}
      actions={path.length > 0 && (
        <span className="tree-actions">
          <button type="button" className="btn btn-sm" onClick={() => { setPath([]); setOrder(dims.slice(0, 2)); }}>Reset</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={apply}><Icon name="filter" size={12} /> Apply path as filters</button>
        </span>
      )}>
      <div className="decomp">
        <div className="decomp-col decomp-root">
          <div className="decomp-head">Total</div>
          <div className="decomp-node on root"><span className="decomp-label">All</span><span className="decomp-val">{f(total)}</span><span className="decomp-bar"><i style={{ width: '100%' }} /></span></div>
        </div>
        {levels.map((l, li) => {
          const max = Math.max(1, ...l.rows.map((r) => r.value));
          const avail = dims.filter((d) => d === l.dim || !order.slice(0, li).includes(d));
          return (
            <div className="decomp-col" key={li}>
              <div className="decomp-head">
                <select value={l.dim} onChange={(e) => { setOrder([...order.slice(0, li), e.target.value as FilterField]); setPath(path.slice(0, li)); }} aria-label={`Split level ${li + 1} by`}>
                  {avail.map((d) => <option key={d} value={d}>{DIM_LABEL[d]}</option>)}
                </select>
              </div>
              <div className="decomp-list">
                {l.rows.slice(0, 10).map((r) => (
                  <button type="button" key={String(r.key)} className={`decomp-node ${path[li] === r.key ? 'on' : ''}`} onClick={() => pick(li, r.key)}>
                    <span className="decomp-label" title={r.label}>{r.label}</span>
                    <span className="decomp-val">{f(r.value)}</span>
                    <span className="decomp-bar"><i style={{ width: `${(100 * r.value) / max}%` }} /></span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {path.length === levels.length && used.size === dims.length && <div className="decomp-end muted small">End of path. Apply the path as filters to update the whole page.</div>}
      </div>
    </Visual>
  );
}
