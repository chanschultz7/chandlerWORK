// Service Scorecard vs Targets (MOR slides 4 and 5): every KPI with target, prior month, current,
// status, MoM and 3-month trend, months met in the last 12 and a 13-month sparkline.

import { useState } from 'react';
import { fmtDelta } from '../format';
import { AREAS, evaluate, M, SCORECARD_IDS, targetText, type Area, type MetricValue } from '../metrics';
import { compareMi, useApp } from '../state';
import { fm, InfoIcon, Sparkline, StatusMark, TrendTag } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';

export function Scorecard() {
  const { ds, ctx, route, go } = useApp();
  const [area, setArea] = useState<Area | 'All'>('All');
  const [only, setOnly] = useState(false);
  const vals = SCORECARD_IDS.map((id) => evaluate(ds, id, ctx));
  const shown = vals.filter((v) => (area === 'All' || v.m.area === area) && (!only || v.status === 'off' || v.status === 'watch'));
  const counts = { ok: vals.filter((v) => v.status === 'ok').length, watch: vals.filter((v) => v.status === 'watch').length, off: vals.filter((v) => v.status === 'off').length, none: vals.filter((v) => v.status === 'none').length };
  const prior = ds.months[compareMi(route)];
  const cur = ds.months[route.mi];
  const cols: Col<MetricValue>[] = [
    { key: 'kpi', label: 'KPI', width: 300, value: (r) => r.m.name, render: (r) => <span className="metric-cell"><span className="code">{r.m.code}</span>{r.m.name}<InfoIcon id={r.m.id} />{r.m.scope === 'enterprise' && ctx.sites.length > 0 && <span className="tag-ent" title="Enterprise measure: site filter does not apply">Ent.</span>}</span> },
    { key: 'target', label: 'Target', align: 'left', value: (r) => targetText(ds, r.m, ctx, fm(r.m.id)), sortable: false },
    { key: 'prior', label: prior?.short ?? 'Prior', text: 'Comparison', value: (r) => (route.compare === 'py' ? r.py : r.prior), render: (r) => fm(r.m.id)(route.compare === 'py' ? r.py : r.prior) },
    { key: 'cur', label: cur.short, text: 'Current', value: (r) => r.value, render: (r) => <b>{fm(r.m.id)(r.value)}</b> },
    { key: 'var', label: 'vs Target', value: (r) => r.variance, status: (r) => r.status, render: (r) => (r.variance === null ? '–' : fmtDelta(r.variance, r.m.unit, r.m.digits)), exportText: (r) => (r.variance === null ? '' : fmtDelta(r.variance, r.m.unit, r.m.digits)) },
    { key: 'status', label: 'Status', align: 'center', value: (r) => ({ off: 0, watch: 1, ok: 2, none: 3 })[r.status], render: (r) => <StatusMark status={r.status} />, exportText: (r) => r.status },
    { key: 'mom', label: 'MoM', align: 'center', value: (r) => r.mom, render: (r) => <TrendTag t={r.mom} /> },
    { key: 'm3', label: '3-Month', align: 'center', value: (r) => r.m3, render: (r) => <TrendTag t={r.m3} /> },
    { key: 'met', label: 'Months met (12)', value: (r) => (r.monthsMeasured ? r.monthsMet / r.monthsMeasured : null), render: (r) => (r.monthsMeasured ? <span className={r.monthsMet / r.monthsMeasured < 0.75 ? 'txt-off' : ''}>{r.monthsMet} of {r.monthsMeasured}</span> : <span className="muted">n/a</span>), exportText: (r) => (r.monthsMeasured ? `${r.monthsMet} of ${r.monthsMeasured}` : 'n/a') },
    { key: 'trend', label: '13-month trend', align: 'center', sortable: false, value: () => null, render: (r) => <Sparkline values={r.trend.map((t) => t.value)} target={r.target} status={r.trend.map((t) => t.status)} />, exportText: () => '' },
  ];
  const rows = shown.map((v) => ({ id: v.m.id, data: v, group: v.m.area }));
  return (
    <div className="page">
      <CanvasHeader right={(
        <div className="score-summary">
          <span><StatusMark status="ok" /> {counts.ok}</span><span><StatusMark status="watch" /> {counts.watch}</span><span><StatusMark status="off" /> {counts.off}</span><span><StatusMark status="none" /> {counts.none}</span>
        </div>
      )} />
      <Visual title="Service scorecard vs targets" subtitle={`${cur.label} vs ${route.compare === 'py' ? 'prior year' : 'prior month'} · click a row to open its page · all targets are Convene defaults, confirm per contract`}
        table={gridExport(cols, rows)}
        actions={(
          <span className="toggles">
            <span className="seg seg-xs" role="radiogroup" aria-label="Area">
              {(['All', ...AREAS] as const).map((a) => <button key={a} type="button" role="radio" aria-checked={area === a} className={area === a ? 'on' : ''} onClick={() => setArea(a)}>{a}</button>)}
            </span>
            <label><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Off target only</label>
          </span>
        )}>
        <Grid caption="Service scorecard" columns={cols} rows={rows} groups dense onRowClick={(r) => go(r.m.page as never)} />
      </Visual>
      <p className="footnote">Status rules (A4): green meets target; amber is inside the amber band or meets target with an unfavorable 3-month trend; red is outside the amber band or missed three months in a row. Trend labels move more than 5% of the prior value. Months met counts the last 12 months that met target. {M('over7').targetText}.</p>
    </div>
  );
}
