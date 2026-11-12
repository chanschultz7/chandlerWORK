// Site IT Tear Sheet (MOR appendix): one page per site, each measure against target, prior and the
// all-sites value, 12-month trends, other measures and recommended actions. Plus a site comparison.

import { fmt, num, pct } from '../format';
import { evaluate, M, siteRows, type Ctx } from '../metrics';
import { useApp } from '../state';
import { Chart } from '../ui/Chart';
import { COMPARE, lineOption, SERIES } from '../ui/charts';
import { fm, StatusMark } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';

const TILES: { id: string; label: string }[] = [
  { id: 'network', label: 'Network uptime' },
  { id: 'tickets_opened', label: 'Tickets opened / resolved' },
  { id: 'sla_all', label: 'Tickets resolved within SLA' },
  { id: 'mi_p1p2', label: 'P1 and P2 incidents' },
  { id: 'patch30', label: 'Workstation patch compliance' },
  { id: 'csat', label: 'User satisfaction' },
];

export function Sites() {
  const { ds, ctx, route, set } = useApp();
  const siteKey = route.site ?? route.sites[0] ?? 0;
  const site = ds.sites[siteKey] ?? ds.sites[0];
  const sc: Ctx = { ...ctx, sites: [site.key], pri: [], cat: [] };
  const ac: Ctx = { ...ctx, sites: [], pri: [], cat: [] };
  const sm = siteRows(ds, sc)[0];
  const share = (evaluate(ds, 'tickets_opened', sc).value ?? 0) / Math.max(1, evaluate(ds, 'tickets_opened', ac).value ?? 1);
  const resolved = evaluate(ds, 'tickets_resolved', sc);
  const resolvedAll = evaluate(ds, 'tickets_resolved', ac);
  const inc12 = ds.incidents.filter((i) => i.mi <= ctx.mi && i.mi > ctx.mi - 12 && i.sites.includes(site.key)).length;
  return (
    <div className="page">
      <CanvasHeader title={`Site IT Tear Sheet: ${site.name}`} right={(
        <label className="fld inline">Site
          <select value={site.key} onChange={(e) => set({ site: Number(e.target.value) })}>
            {ds.sites.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
        </label>
      )} />
      <div className="site-facts">
        <span>{site.beds ? `${site.beds} beds` : 'Outpatient'}</span><span>{num(site.users)} users</span><span>{num(site.devices)} devices</span>
        <span>Share of tickets {pct(share, 0)}</span><span>{site.ehr}</span><span>Convene site lead: {site.lead}</span>
      </div>
      <div className="kpi-strip" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        {TILES.map((t) => {
          const v = evaluate(ds, t.id, sc);
          const a = evaluate(ds, t.id, ac);
          const f = fm(t.id);
          const isTickets = t.id === 'tickets_opened';
          return (
            <div key={t.id} className={`kpi static st-${isTickets ? 'none' : v.status}`}>
              <div className="kpi-top"><span className="kpi-name">{t.label}</span><StatusMark status={isTickets ? 'none' : v.status} compact /></div>
              <div className="kpi-mid"><span className="kpi-value">{isTickets ? `${num(v.value)} / ${num(resolved.value)}` : t.id === 'csat' ? `${fmt(v.value, 'score', 1)} of 5` : f(v.value)}</span></div>
              <div className="kpi-row"><span className="kpi-target">{isTickets ? `Prior ${num(v.prior)} / ${num(resolved.prior)}` : t.id === 'mi_p1p2' ? `Prior ${num(v.prior)} · 12-mo total ${inc12}` : `Target ${f(v.target)} · Prior ${f(v.prior)}`}</span></div>
              <div className="kpi-row muted">All sites {isTickets ? `${num(a.value)} / ${num(resolvedAll.value)}` : f(a.value)}</div>
            </div>
          );
        })}
      </div>
      <div className="row cols-4">
        {(['network', 'sla_all', 'over7', 'mi_p1p2'] as const).map((id) => {
          const v = evaluate(ds, id, sc, 12);
          const a = evaluate(ds, id, ac, 12);
          const f = fm(id);
          const allSeries = id === 'over7' || id === 'mi_p1p2' ? null : a.trend.map((t) => t.value);
          return (
            <Visual key={id} title={id === 'over7' ? 'Tickets open > 7 days' : id === 'mi_p1p2' ? 'P1 and P2 incidents' : v.m.short ?? v.m.name} metricId={id} subtitle="12 months · site vs all sites"
              table={{ columns: ['Month', site.short, 'All sites'], rows: v.trend.map((t, i) => [ds.months[t.mi].label, f(t.value), f(a.trend[i]?.value)]) }}>
              <Chart height={170} ariaLabel={`${v.m.name} trend for ${site.name}`} onClick={(i) => v.trend[i] && set({ mi: v.trend[i].mi })}
                option={lineOption({ labels: v.trend.map((t) => ds.months[t.mi].short), fmt: f, target: id === 'mi_p1p2' ? null : v.target, selectedIndex: v.trend.length - 1,
                  series: [{ name: site.short, data: v.trend.map((t) => t.value), color: SERIES[0], type: id === 'mi_p1p2' ? 'bar' : 'line' }, ...(allSeries ? [{ name: 'All sites', data: allSeries, color: COMPARE, dashed: true }] : [])] })} />
            </Visual>
          );
        })}
      </div>
      <div className="other-measures">
        <b>Other measures:</b> backup failover tested <b>{sm?.failoverTested ? 'Yes' : <span className="txt-off">No</span>}</b> · open critical vulnerabilities <b>{sm?.openCritVulns ?? '–'}</b> · end-of-life devices <b>{num(sm?.eolDevices)}</b> · asset inventory accuracy <b>{pct(sm?.assetAccuracy)}</b> · local IT projects <b>{ds.projects.filter((p) => p.site === site.key).length}</b>
      </div>
      <div className="commentary">
        <div className="commentary-head">Recommended actions</div>
        <ol className="keypoints">{(ds.siteActions[site.key] ?? []).map((a) => <li key={a}>{a}</li>)}</ol>
      </div>
      <SiteComparison onPick={(k) => set({ site: k })} current={site.key} />
    </div>
  );
}

interface CmpRow { key: number; name: string; vals: Record<string, ReturnType<typeof evaluate>> }
const CMP = ['tickets_opened', 'sla_all', 'over7', 'fcr', 'csat', 'network', 'patch30', 'crit7', 'mi_p1p2'];

function SiteComparison({ onPick, current }: { onPick: (k: number) => void; current: number }) {
  const { ds, ctx } = useApp();
  const rows: CmpRow[] = ds.sites.map((s) => ({ key: s.key, name: s.name, vals: Object.fromEntries(CMP.map((id) => [id, evaluate(ds, id, { ...ctx, sites: [s.key], pri: [], cat: [] }, 1)])) }));
  const cols: Col<CmpRow>[] = [
    { key: 'name', label: 'Site', width: 220, value: (r) => r.name },
    ...CMP.map((id) => ({
      key: id, label: M(id).short ?? M(id).name,
      value: (r: CmpRow) => r.vals[id].value, render: (r: CmpRow) => fm(id)(r.vals[id].value), status: (r: CmpRow) => r.vals[id].status, exportText: (r: CmpRow) => fm(id)(r.vals[id].value),
    })),
  ];
  const g = rows.map((r) => ({ id: String(r.key), data: r }));
  return (
    <Visual title="Site comparison" subtitle={`${ds.months[ctx.mi].label} · every site on the same measures · click a row to open its tear sheet`} table={gridExport(cols, g)}>
      <Grid caption="Site comparison" columns={cols} rows={g} dense selected={(r) => r.key === current} onRowClick={(r) => onPick(r.key)} />
    </Visual>
  );
}
