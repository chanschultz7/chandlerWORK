// Clinical Applications (MOR slide 8): EHR and clinical system availability, planned downtime and
// interface health. Enterprise measures: the site filter does not apply.

import { fmt, num, pct } from '../format';
import { evaluate, systemAvailability, systemRows } from '../metrics';
import { useApp } from '../state';
import { Chart } from '../ui/Chart';
import { barOption, SERIES, STATUS_COLOR, stackedOption } from '../ui/charts';
import { Commentary, KpiStrip, StatusMark } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';
import { TrendVisual } from '../ui/widgets';

interface SysRow { key: number; name: string; tier: string; avail: number | null; target: number; unplanned: number; planned: number; windows: number; tickets: number; issue: string; owner: string; prior: number | null }

export function Clinical() {
  const { ds, ctx } = useApp();
  const mi = ctx.mi;
  const rows: SysRow[] = ds.systems.map((s) => {
    const r = systemRows(ds, mi).find((x) => x.sys === s.key)!;
    return { key: s.key, name: s.key === 0 ? 'EHR (production)' : s.name, tier: s.tier, avail: systemAvailability(ds, mi, s.key), prior: systemAvailability(ds, mi - 1, s.key), target: s.tier === 'P1' ? 0.999 : 0.995, unplanned: r.unplannedMin, planned: r.plannedHrs, windows: r.plannedWindows, tickets: r.tickets, issue: r.topIssue, owner: s.owner };
  });
  const st = (r: SysRow) => (r.avail === null ? 'none' : r.avail >= r.target ? 'ok' : r.target - r.avail <= 0.0005 ? 'watch' : 'off') as 'ok' | 'watch' | 'off' | 'none';
  const below = rows.filter((r) => st(r) !== 'ok');
  const ehr = rows[0];
  const sr = systemRows(ds, mi);
  const errs = sr.reduce((a, r) => a + r.interfaceErrors, 0);
  const delays = sr.reduce((a, r) => a + r.interfaceDelays, 0);
  const worstIf = [...sr].sort((a, b) => b.interfaceErrors - a.interfaceErrors)[0];
  const planned = sr.reduce((a, r) => a + r.plannedHrs, 0);
  const windows = sr.reduce((a, r) => a + r.plannedWindows, 0);
  const cols: Col<SysRow>[] = [
    { key: 'name', label: 'System', width: 200, value: (r) => r.name },
    { key: 'tier', label: 'Tier', align: 'center', value: (r) => r.tier, render: (r) => <span className={`tier tier-${r.tier}`}>{r.tier}</span> },
    { key: 'avail', label: 'Availability', value: (r) => r.avail, render: (r) => <b>{pct(r.avail, 2)}</b>, status: st, exportText: (r) => pct(r.avail, 2) },
    { key: 'target', label: 'Target', value: (r) => r.target, render: (r) => pct(r.target, 1) },
    { key: 'prior', label: 'Prior month', value: (r) => r.prior, render: (r) => pct(r.prior, 2) },
    { key: 'unplanned', label: 'Unplanned (min)', value: (r) => r.unplanned, render: (r) => num(r.unplanned), bar: true },
    { key: 'planned', label: 'Planned (hrs)', value: (r) => r.planned, render: (r) => fmt(r.planned, 'count', 1) },
    { key: 'tickets', label: 'Tickets', value: (r) => r.tickets, render: (r) => num(r.tickets) },
    { key: 'issue', label: 'Top issue', align: 'left', value: (r) => r.issue },
    { key: 'owner', label: 'Owner', align: 'left', value: (r) => r.owner },
  ];
  const g = rows.map((r) => ({ id: String(r.key), data: r }));
  const months = ds.months.filter((m) => m.mi <= mi && m.mi > mi - 13);
  return (
    <div className="page">
      <CanvasHeader />
      <KpiStrip ids={[
        { id: 'ehr_avail', label: 'EHR · availability', sub: () => <span className="muted">{num(ehr.unplanned)} min unplanned · {ehr.tickets} tickets</span> },
        { id: 'clin_below', label: 'Clinical systems below target', sub: () => <span className="muted ellipsis">{below.length ? below.map((b) => b.name.replace(' (production)', '')).join(', ') : 'All systems at target'}</span> },
        { id: 'clin_avail', label: 'Other P1 clinical systems' },
        { id: 'clin_planned', label: 'Planned downtime', sub: () => <span className="muted">{fmt(planned, 'count', 1)} hrs in {windows} windows · downtime procedures used: {ds.incidents.some((i) => i.mi === mi && i.downtimeProcedures) ? 'Yes' : 'No'}</span> },
        { id: 'interface_errors', label: 'Interfaces · errors and delays', sub: () => <span className="muted">{num(errs)} errors · {delays} delays · most: {worstIf?.interfaceErrors ? ds.systems[worstIf.sys].name : '–'}</span> },
      ]} />
      <div className="row cols-5-7">
        <Visual title="Availability by clinical system" subtitle="Unplanned downtime only · colored where below tier target" table={gridExport(cols, g)}>
          <Chart height={280} ariaLabel="Availability by clinical system"
            option={barOption({ labels: rows.map((r) => r.name), horizontal: true, fmt: (v) => pct(v, 2), min: Math.min(0.99, ...rows.map((r) => r.avail ?? 1)) - 0.001, max: 1, target: 0.999,
              series: [{ name: ds.months[mi].short, data: rows.map((r) => r.avail) }], colorBy: (i) => (st(rows[i]) === 'ok' ? SERIES[0] : STATUS_COLOR[st(rows[i])]) })} />
        </Visual>
        <TrendVisual id="ehr_avail" title="EHR availability, monthly" height={280} />
      </div>
      <Visual title="Clinical systems detail" subtitle={`${ds.months[mi].label} · P1 tier target 99.9%, general 99.5% (Convene default, confirm per contract)`} table={gridExport(cols, g)}>
        <Grid caption="Clinical systems" columns={cols} rows={g} dense />
      </Visual>
      <div className="row cols-2">
        <Visual title="Unplanned downtime by system, monthly" subtitle="Minutes · stacked by system" table={{ columns: ['Month', ...ds.systems.map((s) => s.name)], rows: months.map((m) => [m.label, ...ds.systems.map((s) => systemRows(ds, m.mi).find((x) => x.sys === s.key)?.unplannedMin ?? 0)]) }}>
          <Chart height={240} ariaLabel="Unplanned downtime by system"
            option={stackedOption({ labels: months.map((m) => m.short), fmt: (v) => `${num(v)} min`, series: ds.systems.map((s, i) => ({ name: s.name, color: SERIES[i], data: months.map((m) => systemRows(ds, m.mi).find((x) => x.sys === s.key)?.unplannedMin ?? 0) })) })} />
        </Visual>
        <Visual title="System status this month" subtitle="Status per A4 rules">
          <div className="status-list">
            {rows.map((r) => (
              <div key={r.key} className="status-line">
                <StatusMark status={st(r)} compact />
                <span className="status-line-name">{r.name}</span>
                <span className="muted">{r.tier}</span>
                <b>{pct(r.avail, 2)}</b>
                <span className="muted ellipsis">{r.unplanned ? `${r.unplanned} min · ${r.issue}` : 'No unplanned downtime'}</span>
              </div>
            ))}
          </div>
          <p className="footnote">Critical-systems availability (excluding EHR): {pct(evaluate(ds, 'clin_avail', { ...ctx, sites: [] }).value, 2)}.</p>
        </Visual>
      </div>
      <Commentary>{ds.commentary.clinical}</Commentary>
    </div>
  );
}
