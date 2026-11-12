// Infrastructure Health (MOR slide 9): uptime by tier, downtime, backup, patching, change,
// capacity, certificates and end-of-life.

import { num, pct } from '../format';
import { evaluate, M, type MetricValue } from '../metrics';
import { useApp } from '../state';
import { Chart } from '../ui/Chart';
import { barOption, SERIES, STATUS_COLOR, stackedOption } from '../ui/charts';
import { Commentary, fm, InfoIcon, KpiStrip, RagCell, Sparkline, StatusMark, TrendTag } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';
import { BreakdownVisual } from '../ui/widgets';

const TABLE_IDS = ['network', 'wan', 'server', 'email', 'uptime_p1', 'uptime_gen', 'sched_down', 'unsched_down', 'backup', 'patch30', 'crit7', 'chg_total', 'chg_success', 'chg_emerg', 'storage', 'bandwidth', 'hostmem', 'certs60'];

export function Infrastructure() {
  const { ds, ctx, set } = useApp();
  const mi = ctx.mi;
  const x = ds.infra[mi];
  const vals = TABLE_IDS.map((id) => evaluate(ds, id, ctx));
  const cols: Col<MetricValue>[] = [
    { key: 'kpi', label: 'KPI', width: 260, value: (r) => r.m.name, render: (r) => <span className="metric-cell">{r.m.name}<InfoIcon id={r.m.id} /></span> },
    { key: 'target', label: 'Target', value: (r) => r.target, render: (r) => r.m.targetText ?? (r.target === null ? 'No target' : fm(r.m.id)(r.target)), exportText: (r) => r.m.targetText ?? fm(r.m.id)(r.target) },
    { key: 'prior', label: ds.months[mi - 1]?.short ?? 'Prior', value: (r) => r.prior, render: (r) => fm(r.m.id)(r.prior) },
    { key: 'range', label: '3-month range', value: (r) => r.range3?.[0] ?? null, render: (r) => (r.range3 ? `${fm(r.m.id)(r.range3[0])} – ${fm(r.m.id)(r.range3[1])}` : '–'), sortable: false },
    { key: 'cur', label: ds.months[mi].short, value: (r) => r.value, render: (r) => <b>{fm(r.m.id)(r.value)}</b>, status: (r) => r.status, exportText: (r) => fm(r.m.id)(r.value) },
    { key: 'status', label: 'Status', align: 'center', value: (r) => ({ off: 0, watch: 1, ok: 2, none: 3 })[r.status], render: (r) => <StatusMark status={r.status} />, exportText: (r) => r.status },
    { key: 'mom', label: 'Trend', align: 'center', value: (r) => r.m3, render: (r) => <TrendTag t={r.m3} /> },
    { key: 'spark', label: '13 months', align: 'center', sortable: false, value: () => null, render: (r) => <Sparkline values={r.trend.map((t) => t.value)} target={r.target} status={r.trend.map((t) => t.status)} />, exportText: () => '' },
  ];
  const group = (id: string) => (['network', 'wan', 'server', 'email', 'uptime_p1', 'uptime_gen', 'sched_down', 'unsched_down'].includes(id) ? 'Downtime and availability' : ['backup', 'patch30', 'crit7'].includes(id) ? 'Protection' : M(id).area === 'Change' ? 'Change' : 'Capacity and certificate watch');
  const g = vals.map((v) => ({ id: v.m.id, data: v, group: group(v.m.id) }));
  const months = ds.months.filter((m) => m.mi <= mi && m.mi > mi - 13);
  const cap = [
    { name: 'Storage', v: x.storagePeak }, { name: 'Internet bandwidth', v: x.bandwidthPeak }, { name: 'Host CPU', v: x.cpuPeak }, { name: 'Host memory', v: x.memPeak },
  ];
  return (
    <div className="page">
      <CanvasHeader />
      <KpiStrip ids={[
        { id: 'uptime_p1', label: 'Systems · uptime, P1 tier', sub: (v) => <span className="muted">General tier {fm('uptime_gen')(evaluate(ds, 'uptime_gen', ctx).value)} · prior {fm('uptime_p1')(v.prior)}</span> },
        { id: 'unsched_down', label: 'Downtime · unscheduled', sub: () => <span className="muted">Scheduled {x.schedHrs.toFixed(1)} hrs (does not count vs target)</span> },
        { id: 'backup', label: 'Recovery · backup success', sub: () => <span className="muted">{x.backupFailed} failures · {x.backupRerunOk} re-ran in &lt; 24h</span> },
        { id: 'chg_success', label: 'Change · success rate', sub: () => <span className="muted">{x.chgStd} standard · {x.chgNormal} normal · {x.chgEmerg} emergency</span> },
        { id: 'crit7', label: 'Critical patches ≤ 7 days' },
        { id: 'storage', label: 'Capacity · storage peak' },
      ]} />
      <Visual title="Infrastructure KPIs" subtitle="Status: green meets target; amber within tolerance; red misses target · all targets and thresholds: Convene default, confirm per contract" table={gridExport(cols, g)}>
        <Grid caption="Infrastructure KPIs" columns={cols} rows={g} groups dense onRowClick={() => undefined} />
      </Visual>
      <div className="row cols-3">
        <Visual title="Downtime, scheduled vs unscheduled" metricId="unsched_down" subtitle="Hours per month · only unscheduled counts against target"
          table={{ columns: ['Month', 'Scheduled', 'Unscheduled'], rows: months.map((m) => [m.label, ds.infra[m.mi].schedHrs, ds.infra[m.mi].unschedHrs]) }}>
          <Chart height={220} ariaLabel="Downtime by type" onClick={(i) => months[i] && set({ mi: months[i].mi })}
            option={stackedOption({ labels: months.map((m) => m.short), fmt: (v) => `${v.toFixed(1)} h`, series: [{ name: 'Scheduled', data: months.map((m) => ds.infra[m.mi].schedHrs), color: '#a9b0bb' }, { name: 'Unscheduled', data: months.map((m) => ds.infra[m.mi].unschedHrs), color: STATUS_COLOR.off }] })} />
        </Visual>
        <BreakdownVisual id="network" alt={['patch30', 'crit7']} dim="sites" title="Network availability by site" statusColors showCompare={false} height={220} />
        <Visual title="Changes implemented by type" metricId="chg_total" subtitle="Standard / normal / emergency · failed changes caused an incident"
          table={{ columns: ['Month', 'Standard', 'Normal', 'Emergency', 'Failed'], rows: months.map((m) => { const i = ds.infra[m.mi]; return [m.label, i.chgStd, i.chgNormal, i.chgEmerg, i.chgFailed]; }) }}>
          <Chart height={220} ariaLabel="Changes by type" onClick={(i) => months[i] && set({ mi: months[i].mi })}
            option={stackedOption({ labels: months.map((m) => m.short), fmt: (v) => num(v), series: [{ name: 'Standard', data: months.map((m) => ds.infra[m.mi].chgStd), color: SERIES[0] }, { name: 'Normal', data: months.map((m) => ds.infra[m.mi].chgNormal), color: '#86b6ef' }, { name: 'Emergency', data: months.map((m) => ds.infra[m.mi].chgEmerg), color: SERIES[1] }] })} />
        </Visual>
      </div>
      <div className="row cols-3">
        <Visual title="Capacity watch, peak use" subtitle="Amber at 80%, red at 90% of capacity" table={{ columns: ['Resource', 'Peak used'], rows: cap.map((c) => [c.name, pct(c.v, 0)]) }}>
          <Chart height={190} ariaLabel="Capacity peak use" option={barOption({ labels: cap.map((c) => c.name), horizontal: true, fmt: (v) => pct(v, 0), min: 0, max: 1, target: 0.8, series: [{ name: 'Peak', data: cap.map((c) => c.v) }], colorBy: (i) => (cap[i].v >= 0.9 ? STATUS_COLOR.off : cap[i].v >= 0.8 ? STATUS_COLOR.watch : SERIES[0]) })} />
        </Visual>
        <CertWatch />
        <EolWatch />
      </div>
      <Commentary>{ds.commentary.infrastructure}</Commentary>
    </div>
  );
}

function CertWatch() {
  const { ds } = useApp();
  type C = (typeof ds.certificates)[number];
  const cols: Col<C>[] = [
    { key: 'name', label: 'Certificate', value: (r) => r.name },
    { key: 'system', label: 'System', align: 'left', value: (r) => r.system },
    { key: 'days', label: 'Days left', value: (r) => r.days, status: (r) => (r.days <= 14 ? 'off' : 'watch') },
    { key: 'owner', label: 'Owner', align: 'left', value: (r) => r.owner },
  ];
  const g = ds.certificates.map((c) => ({ id: c.name, data: c }));
  return (
    <Visual title="Certificates expiring within 60 days" metricId="certs60" subtitle="Red inside 14 days" table={gridExport(cols, g)}>
      <Grid caption="Certificates" columns={cols} rows={g} dense defaultSort={{ key: 'days', dir: 'asc' }} />
    </Visual>
  );
}

function EolWatch() {
  const { ds } = useApp();
  type E = (typeof ds.eol)[number];
  const cols: Col<E>[] = [
    { key: 'item', label: 'Hardware or software', value: (r) => r.item, wrap: true },
    { key: 'count', label: 'Count', value: (r) => r.count },
    { key: 'risk', label: 'Risk', align: 'left', value: (r) => r.risk, render: (r) => <RagCell rag={r.risk} text={r.risk === 'R' ? 'High' : r.risk === 'A' ? 'Medium' : 'Low'} /> },
    { key: 'rep', label: 'Replacement', align: 'left', value: (r) => r.replacement, wrap: true },
  ];
  const g = ds.eol.map((c) => ({ id: c.item, data: c }));
  return (
    <Visual title="End-of-life watch" subtitle="Past or near vendor end of support" table={gridExport(cols, g)}>
      <Grid caption="End of life" columns={cols} rows={g} dense />
    </Visual>
  );
}
