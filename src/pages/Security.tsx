// Security and Compliance (MOR slide 11): events, exposure, PHI, signals, and protection coverage.

import { num, pct } from '../format';
import { evaluate, type MetricValue } from '../metrics';
import { useApp } from '../state';
import { Chart } from '../ui/Chart';
import { lineOption, SERIES, stackedOption } from '../ui/charts';
import { Commentary, fm, InfoIcon, KpiStrip, Sparkline, StatusMark } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';
import { TrendVisual } from '../ui/widgets';

const PROTECTION: { id: string; check: string }[] = [
  { id: 'endpoint', check: 'In-scope computers and servers reporting in' },
  { id: 'mfa', check: 'Accounts requiring a second sign-in step' },
  { id: 'crit7', check: 'Devices with critical patches in 7 days' },
  { id: 'encryption', check: 'In-scope laptops encrypted' },
  { id: 'training', check: 'In-scope staff completing training' },
  { id: 'admin_review', check: 'Admin accounts reviewed in period' },
  { id: 'phish', check: 'Clicks after training ÷ delivered simulations' },
  { id: 'vuln_crit', check: 'Critical findings open (C / H / M / L shown)' },
  { id: 'mttp', check: 'Mean days from release or detection to patch' },
  { id: 'failed_logins', check: 'Failed logins / lockouts; flag unusual spikes' },
  { id: 'phi', check: 'Confirmed or suspected PHI exposure events' },
  { id: 'patch_exc', check: 'Devices unable to patch, tracked separately' },
];

export function Security() {
  const { ds, ctx, set } = useApp();
  const ec = { ...ctx, sites: [] };
  const mi = ctx.mi;
  const s = ds.security[mi];
  const p = ds.security[mi - 1];
  type R = { v: MetricValue; check: string };
  const rows: R[] = PROTECTION.map((x) => ({ v: evaluate(ds, x.id, ec), check: x.check }));
  const special = (r: R, which: 'cur' | 'prior') => {
    const x = which === 'cur' ? s : p;
    if (!x) return '–';
    if (r.v.m.id === 'vuln_crit') return `${x.vulnC} / ${x.vulnH} / ${x.vulnM} / ${x.vulnL}`;
    if (r.v.m.id === 'failed_logins') return `${num(x.failedLogins)} / ${num(x.lockouts)}`;
    return fm(r.v.m.id)(which === 'cur' ? r.v.value : r.v.prior);
  };
  const cols: Col<R>[] = [
    { key: 'metric', label: 'Metric', width: 220, value: (r) => r.v.m.name, render: (r) => <span className="metric-cell">{r.v.m.name}<InfoIcon id={r.v.m.id} /></span> },
    { key: 'check', label: 'What we check', align: 'left', value: (r) => r.check, sortable: false },
    { key: 'prior', label: 'Prior', value: (r) => r.v.prior, render: (r) => special(r, 'prior'), exportText: (r) => special(r, 'prior') },
    { key: 'cur', label: 'Current', value: (r) => r.v.value, render: (r) => <b>{special(r, 'cur')}</b>, status: (r) => r.v.status, exportText: (r) => special(r, 'cur') },
    { key: 'target', label: 'Target', value: (r) => r.v.target, render: (r) => r.v.m.targetText ?? (r.v.target === null ? (r.v.m.amberText ? `No target; ${r.v.m.amberText.toLowerCase()}` : 'No target') : fm(r.v.m.id)(r.v.target)), sortable: false },
    { key: 'status', label: 'Status', align: 'center', value: (r) => r.v.status, render: (r) => <StatusMark status={r.v.status} />, exportText: (r) => r.v.status },
    { key: 'spark', label: '13 months', align: 'center', sortable: false, value: () => null, render: (r) => <Sparkline values={r.v.trend.map((t) => t.value)} target={r.v.target} status={r.v.trend.map((t) => t.status)} />, exportText: () => '' },
  ];
  const g = rows.map((r) => ({ id: r.v.m.id, data: r }));
  const AGE = ['< 7 days', '7–30 days', '31–90 days', '> 90 days'];
  const SEV = ['Critical', 'High', 'Medium', 'Low'];
  const months = ds.months.filter((m) => m.mi <= mi && m.mi > mi - 13);
  const oldest = s.vulnAge[0][3] + s.vulnAge[1][3];
  return (
    <div className="page">
      <CanvasHeader />
      <KpiStrip ids={[
        { id: 'sec_incidents', label: 'Events · security incidents', sub: () => <span className="muted">{s.incLow} low · {s.incMed} medium · {s.incHigh} high · {s.incOpen} open</span> },
        { id: 'vuln_crit', label: 'Exposure · critical findings', sub: () => <span className="muted">C {s.vulnC} · H {s.vulnH} · M {s.vulnM} · L {num(s.vulnL)}</span> },
        { id: 'mttp', label: 'Mean time to patch critical CVEs' },
        { id: 'phi', label: 'PHI · exposure events', sub: () => <span className="muted">Target zero; any event is red and separately reported</span> },
        { id: 'phish', label: 'Signals · phishing click rate', sub: () => <span className="muted">{num(s.phishClicks)} clicks of {num(s.phishDelivered)} delivered</span> },
        { id: 'failed_logins', label: 'Signals · failed logins', sub: () => <span className="muted">{num(s.lockouts)} lockouts</span> },
      ]} />
      <div className="row cols-5-7">
        <Visual title="Vulnerability findings by severity and age" metricId="vuln_crit" subtitle={`Open findings at month end · ${oldest} critical/high older than 90 days · ${s.patchExceptions} devices with logged patching exceptions`}
          table={{ columns: ['Severity', ...AGE], rows: SEV.map((sv, i) => [sv, ...s.vulnAge[i]]) }}>
          <Chart height={240} ariaLabel="Vulnerabilities by severity and age"
            option={stackedOption({ labels: SEV, horizontal: true, fmt: (v) => num(v), series: AGE.map((a, k) => ({ name: a, color: ['#86b6ef', '#3987e5', '#184f95', '#0d366b'][k], data: SEV.map((_, i) => s.vulnAge[i][k]) })) })} />
        </Visual>
        <Visual title="Critical and high findings, monthly" subtitle="Open at month end · click a month to set the period"
          table={{ columns: ['Month', 'Critical', 'High'], rows: months.map((m) => [m.label, ds.security[m.mi].vulnC, ds.security[m.mi].vulnH]) }}>
          <Chart height={240} ariaLabel="Critical and high findings trend" onClick={(i) => months[i] && set({ mi: months[i].mi })}
            option={lineOption({ labels: months.map((m) => m.short), fmt: (v) => num(v), selectedIndex: months.length - 1, min: 0, series: [{ name: 'High', data: months.map((m) => ds.security[m.mi].vulnH), color: SERIES[1] }, { name: 'Critical', data: months.map((m) => ds.security[m.mi].vulnC), color: '#bb3328' }] })} />
        </Visual>
      </div>
      <Visual title="Protection and security metrics" subtitle={`${ds.months[mi].label} · lowest coverage: ${lowest(rows)} · targets are Convene defaults, confirm per contract`} table={gridExport(cols, g)}>
        <Grid caption="Protection and security metrics" columns={cols} rows={g} dense />
      </Visual>
      <div className="row cols-2">
        <TrendVisual id="phish" title="Phishing simulation click rate, monthly" height={200} ctxOverride={{ sites: [] }} />
        <Visual title="Failed logins and lockouts, monthly" metricId="failed_logins" subtitle="Spikes are flagged when more than 30% above the prior 3-month average"
          table={{ columns: ['Month', 'Failed logins', 'Lockouts'], rows: months.map((m) => [m.label, ds.security[m.mi].failedLogins, ds.security[m.mi].lockouts]) }}>
          <Chart height={200} ariaLabel="Failed logins and lockouts" onClick={(i) => months[i] && set({ mi: months[i].mi })}
            option={lineOption({ labels: months.map((m) => m.short), fmt: (v) => num(v), selectedIndex: months.length - 1, min: 0, series: [{ name: 'Failed logins', data: months.map((m) => ds.security[m.mi].failedLogins), color: SERIES[0] }, { name: 'Lockouts ×10', data: months.map((m) => ds.security[m.mi].lockouts * 10), color: SERIES[1] }] })} />
        </Visual>
      </div>
      <Commentary>{ds.commentary.security} Training completion is {pct(s.training, 0)} against a 95% target.</Commentary>
    </div>
  );
}

function lowest(rows: { v: MetricValue }[]) {
  const cov = rows.filter((r) => r.v.m.unit === 'pct' && r.v.m.better === 'up' && r.v.value !== null && r.v.target !== null)
    .sort((a, b) => (a.v.value! - a.v.target!) - (b.v.value! - b.v.target!))[0];
  return cov ? `${cov.v.m.short ?? cov.v.m.name} at ${fm(cov.v.m.id)(cov.v.value)}` : '–';
}
