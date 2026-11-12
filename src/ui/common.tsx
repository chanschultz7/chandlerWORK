import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Rag } from '../data/model';
import { fmt, fmtDelta } from '../format';
import { evaluate, M, STATUS_LABEL, STATUS_SHORT, targetText, type MetricValue, type Status, type TrendLabel } from '../metrics';
import { compareMi, useApp } from '../state';
import { Icon } from './icons';

export const fm = (id: string) => (v: number | null | undefined) => fmt(v ?? null, M(id).unit, M(id).digits);

/** Status shape + label. Circle = green, triangle = amber, diamond = red (never color alone). */
export function StatusMark({ status, compact, label }: { status: Status; compact?: boolean; label?: string }) {
  return (
    <span className={`status status-${status}`} title={STATUS_LABEL[status]}>
      <span className="status-shape" aria-hidden="true" />
      {compact ? <span className="sr-only">{STATUS_SHORT[status]}</span> : <span>{label ?? STATUS_SHORT[status]}</span>}
    </span>
  );
}

const RAG_STATUS: Record<Rag, Status> = { G: 'ok', A: 'watch', R: 'off', N: 'none' };
const RAG_TEXT: Record<Rag, string> = { G: 'On track', A: 'At risk', R: 'Off track', N: 'Not started' };
export function RagCell({ rag, text }: { rag: Rag; text?: string }) {
  return <span className={`rag rag-${rag}`}><span className={`stcell st-${RAG_STATUS[rag]}`}><span className="status-shape" aria-hidden="true" /></span>{text ?? RAG_TEXT[rag]}</span>;
}

export function TrendTag({ t }: { t: TrendLabel }) {
  const cls = t === 'Favorable' ? 'fav' : t === 'Unfavorable' ? 'unfav' : 'neutral';
  return <span className={`trend-tag ${cls}`}>{t}</span>;
}

/** Change vs comparison, colored by whether it is favorable. */
export function Delta({ v, suffix }: { v: MetricValue; suffix: string }) {
  const { route } = useApp();
  const d = route.compare === 'py' ? v.pyChange : v.change;
  const m = v.m;
  if (d === null) return <span className="delta neutral">– {suffix}</span>;
  const fav = m.better === 'none' || Math.abs(d) < 1e-9 ? 'neutral' : (m.better === 'up') === d > 0 ? 'fav' : 'unfav';
  return (
    <span className={`delta ${fav}`}>
      <span className="delta-arrow" aria-hidden="true">{d > 0 ? '▲' : d < 0 ? '▼' : '●'}</span>{fmtDelta(d, m.unit, m.digits)} <span className="muted">{suffix}</span>
    </span>
  );
}

export function Sparkline({ values, target, width = 80, height = 22, status }: { values: (number | null)[]; target?: number | null; width?: number; height?: number; status?: Status[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <svg width={width} height={height} className="spark" aria-hidden="true" />;
  const all = [...pts.map((p) => p.v), ...(target !== null && target !== undefined ? [target] : [])];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => height - 3 - ((v - lo) / (hi - lo)) * (height - 6);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const lastStatus = status?.[last.i];
  return (
    <svg width={width} height={height} className="spark" aria-hidden="true">
      {target !== null && target !== undefined && <line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke="#8a929e" strokeDasharray="2 2" strokeWidth={1} />}
      <path d={d} fill="none" stroke="#2a78d6" strokeWidth={1.5} />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.4} fill={lastStatus === 'off' ? '#bb3328' : lastStatus === 'watch' ? '#d08a12' : '#2a78d6'} />
    </svg>
  );
}

/** Definition popover for a metric (A2). */
export function InfoIcon({ id }: { id: string }) {
  const { ds, ctx } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const m = M(id);
  return (
    <span className="info" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="icon-btn info-btn" aria-label={`About ${m.name}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="info" size={12} /></button>
      {open && (
        <div className="info-pop" role="dialog">
          <strong>{m.name}</strong>
          <span className="tagline">{m.code} · {m.area} · {m.scope === 'site' ? 'Site filter applies' : 'Enterprise measure (site filter does not apply)'}</span>
          <span className="info-label">Definition</span><span className="info-row">{m.definition}</span>
          <span className="info-label">Target</span><span className="info-row">{targetText(ds, m, ctx, fm(id))}{m.amberText ? ` · ${m.amberText}` : m.amber !== undefined ? ` · amber band ${fmt(m.amber, m.unit, m.digits)}` : ''}</span>
          <span className="info-label">Source · owner</span><span className="info-row">{m.source} · {m.owner}</span>
          <span className="muted small">Targets are Convene defaults; confirm per contract.</span>
        </div>
      )}
    </span>
  );
}

// ---------------------------------------------------------------- KPI card

export function KpiCard({ id, label, sub, onClick }: { id: string; label?: string; sub?: ReactNode; onClick?: () => void }) {
  const { ds, ctx, route, go } = useApp();
  const v = evaluate(ds, id, ctx);
  const m = v.m;
  const f = fm(id);
  const cmp = ds.months[compareMi(route)];
  const open = onClick ?? (() => go(m.page as never));
  const disabledSite = m.scope === 'enterprise' && ctx.sites.length > 0;
  return (
    <div className={`kpi st-${v.status}`} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }} title={`${m.name}: open ${m.page.replace('-', ' ')}`}>
      <div className="kpi-top">
        <span className="kpi-name">{label ?? m.short ?? m.name}</span>
        <InfoIcon id={id} />
      </div>
      {v.value === null ? <div className="kpi-nodata">No data for this period</div> : (
        <>
          <div className="kpi-mid">
            <span className="kpi-value">{f(v.value)}</span>
            <Sparkline values={v.trend.map((t) => t.value)} target={v.target} status={v.trend.map((t) => t.status)} width={76} height={24} />
          </div>
          <div className="kpi-row">
            {v.target !== null ? (
              <span className="kpi-target">Target {targetText(ds, m, ctx, f).replace(/^Flag.*/, f(v.target))} {v.variance !== null && Math.abs(v.variance) > 1e-9 && <span className={v.status === 'ok' ? 'txt-ok' : v.status === 'watch' ? 'txt-watch' : 'txt-off'}>{fmt_delta(v)}</span>}</span>
            ) : <span className="muted">No target</span>}
            <StatusMark status={v.status} compact />
          </div>
          <div className="kpi-row">
            {sub ?? <Delta v={v} suffix={`vs ${route.compare === 'py' ? 'PY' : cmp?.short ?? 'prior'}`} />}
          </div>
        </>
      )}
      {disabledSite && <span className="kpi-scope" title="Enterprise measure: the site filter does not apply">Enterprise</span>}
    </div>
  );
}
const fmt_delta = (v: MetricValue) => fmtDelta(v.variance, v.m.unit, v.m.digits);

export function KpiStrip({ ids, cols }: { ids: (string | { id: string; label?: string; sub?: (v: MetricValue) => ReactNode })[]; cols?: number }) {
  const { ds, ctx } = useApp();
  return (
    <div className="kpi-strip" style={{ gridTemplateColumns: `repeat(${cols ?? ids.length}, minmax(0, 1fr))` }}>
      {ids.map((x) => {
        const o = typeof x === 'string' ? { id: x } : x;
        return <KpiCard key={o.id} id={o.id} label={o.label} sub={o.sub ? o.sub(evaluate(ds, o.id, ctx)) : undefined} />;
      })}
    </div>
  );
}

/** "What leadership should know" commentary block. */
export function Commentary({ title = 'What leadership should know', children }: { title?: string; children: ReactNode }) {
  return (
    <div className="commentary">
      <div className="commentary-head"><Icon name="note" size={13} /> {title}</div>
      <div className="commentary-body">{children}</div>
    </div>
  );
}

export function SectionHead({ title, note, right }: { title: string; note?: ReactNode; right?: ReactNode }) {
  return (
    <div className="page-sec">
      <h2>{title}</h2>
      {note && <span className="page-sec-note">{note}</span>}
      {right && <span className="page-sec-right">{right}</span>}
    </div>
  );
}
