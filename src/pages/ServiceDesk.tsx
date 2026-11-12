// Service Desk (MOR slides 6 and 7): demand and backlog, then speed and user experience.
// Every bar cross-filters the page by site, priority or category.

import { PRI_LABEL, PRIORITIES, type Pri } from '../data/model';
import { RESOLVE_TARGET_HRS, RESP_TARGET_MIN, SLA_TARGET } from '../data/generate';
import { fmt, fmtDelta, num, pct } from '../format';
import { evaluate, siteRows, ticketRows, type Ctx } from '../metrics';
import { useApp } from '../state';
import { Chart } from '../ui/Chart';
import { lineOption, PRI_COLORS, SERIES, stackedOption } from '../ui/charts';
import { Commentary, KpiStrip, SectionHead } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';
import { BreakdownVisual, DecompositionTree } from '../ui/widgets';

const sum = <T,>(r: T[], f: (x: T) => number) => r.reduce((a, x) => a + f(x), 0);

export function ServiceDesk() {
  const { ds, ctx } = useApp();
  const backlog = evaluate(ds, 'backlog_open', ctx);
  return (
    <div className="page">
      <CanvasHeader />
      <SectionHead title="Demand and backlog" note="Slide 6: volume, throughput, backlog and the drivers behind them" />
      <KpiStrip ids={[
        { id: 'tickets_opened', label: 'Tickets opened', sub: () => <PriMix /> },
        { id: 'throughput', label: 'Throughput · resolved % of opened' },
        { id: 'backlog_open', label: 'Open backlog at month end' },
        { id: 'over7', label: 'Backlog over 7 days', sub: () => <span className="muted">{pct(backlog.value ? (evaluate(ds, 'over7', ctx).value ?? 0) / backlog.value : null)} of open backlog</span> },
        { id: 'reopen', label: 'Reopened ticket rate' },
      ]} />
      <div className="row cols-7-5">
        <VolumeTrend />
        <BacklogTrend />
      </div>
      <div className="row cols-3">
        <BreakdownVisual id="tickets_opened" alt={['sla_all', 'over7', 'csat']} dim="sites" title="Tickets by site" height={230} />
        <BreakdownVisual id="tickets_opened" dim="cat" title="Tickets by category" top={10} showCompare />
        <BreakdownVisual id="tickets_opened" alt={['sla_all']} dim="pri" title="Tickets by priority" height={230} />
      </div>
      <SiteTable />
      <Commentary>{ds.commentary.serviceDesk}</Commentary>

      <SectionHead title="Speed and user experience" note="Slide 7: SLA by priority, first-call resolution, phone and satisfaction" />
      <KpiStrip ids={['sla_all', 'sla_p2', 'fcr', 'asa', 'abandon', 'csat']} />
      <div className="row cols-7-5">
        <PriorityTable />
        <SlaTrend />
      </div>
      <RecurringCategories />
      <DecompositionTree id="tickets_opened" dims={['sites', 'cat', 'pri']} title="Ticket decomposition" />
    </div>
  );
}

function PriMix() {
  const { ds, ctx } = useApp();
  const r = ticketRows(ds, ctx);
  return <span className="pri-mix">{(['P1', 'P2', 'P3', 'P4'] as Pri[]).map((p) => <span key={p}><i style={{ background: PRI_COLORS[p] }} />{p} {num(sum(r.filter((x) => x.pri === p), (x) => x.opened))}</span>)}</span>;
}

function VolumeTrend() {
  const { ds, ctx, set, route, toggle } = useApp();
  const months = ds.months.filter((m) => m.mi <= ctx.mi && m.mi > ctx.mi - 13);
  const series = PRIORITIES.map((p) => ({ name: p, color: PRI_COLORS[p], data: months.map((m) => sum(ticketRows(ds, { ...ctx, mi: m.mi }).filter((r) => r.pri === p), (r) => r.opened)) }));
  const resolved = months.map((m) => sum(ticketRows(ds, { ...ctx, mi: m.mi }), (r) => r.resolved));
  return (
    <Visual title="Tickets opened by priority and resolved, monthly" metricId="tickets_opened" subtitle="Columns: opened by priority · line: resolved · click a column to set the month, a legend item hides a priority"
      table={{ columns: ['Month', ...PRIORITIES, 'Resolved'], rows: months.map((m, i) => [m.label, ...series.map((s) => s.data[i]), resolved[i]]) }}>
      <Chart height={250} ariaLabel="Tickets opened by priority and resolved"
        option={stackedOption({ labels: months.map((m) => m.short), series, fmt: (v) => num(v), line: { name: 'Resolved', data: resolved }, selectedSeries: route.pri })}
        onClick={(i, name) => { if ((PRIORITIES as string[]).includes(name)) toggle('pri', name as Pri); else if (months[i]) set({ mi: months[i].mi }); }} />
    </Visual>
  );
}

function BacklogTrend() {
  const { ds, ctx, set } = useApp();
  const months = ds.months.filter((m) => m.mi <= ctx.mi && m.mi > ctx.mi - 13);
  const rows = months.map((m) => siteRows(ds, { ...ctx, mi: m.mi }));
  const over = rows.map((r) => sum(r, (x) => x.backlogOver7));
  const under = rows.map((r, i) => sum(r, (x) => x.backlogOpen) - over[i]);
  return (
    <Visual title="Backlog at month end by age" metricId="over7" subtitle="Open tickets at month end · 7 days or less vs over 7 days"
      table={{ columns: ['Month', '≤ 7 days', '> 7 days'], rows: months.map((m, i) => [m.label, under[i], over[i]]) }}>
      <Chart height={250} ariaLabel="Backlog by age"
        option={stackedOption({ labels: months.map((m) => m.short), fmt: (v) => num(v), series: [{ name: '≤ 7 days', data: under, color: '#86b6ef' }, { name: '> 7 days', data: over, color: '#184f95' }] })}
        onClick={(i) => months[i] && set({ mi: months[i].mi })} />
    </Visual>
  );
}

interface SiteRow { key: number; name: string; p: number[]; opened: number; closed: number; backlog: number; over7: number; sla: number | null; csat: number | null; share: number }

function SiteTable() {
  const { ds, ctx, route, toggle } = useApp();
  const all = sum(ticketRows(ds, { ...ctx, sites: [] }), (r) => r.opened);
  const rows: SiteRow[] = ds.sites.map((s) => {
    const c: Ctx = { ...ctx, sites: [s.key] };
    const t = ticketRows(ds, c);
    const sm = siteRows(ds, c);
    const opened = sum(t, (x) => x.opened);
    return {
      key: s.key, name: s.name, p: (['P1', 'P2', 'P3', 'P4'] as Pri[]).map((p) => sum(t.filter((x) => x.pri === p), (x) => x.opened)),
      opened, closed: sum(t, (x) => x.resolved), backlog: sum(sm, (x) => x.backlogOpen), over7: sum(sm, (x) => x.backlogOver7),
      sla: evaluate(ds, 'sla_all', c, 1).value, csat: evaluate(ds, 'csat', c, 1).value, share: all ? opened / all : 0,
    };
  });
  const cols: Col<SiteRow>[] = [
    { key: 'name', label: 'Site', width: 220, value: (r) => r.name },
    { key: 'p', label: 'P1 / P2 / P3 / P4', value: (r) => r.p[0] * 1e6 + r.p[1], render: (r) => <span className="mono-ish">{r.p.map((x) => num(x)).join(' / ')}</span>, exportText: (r) => r.p.join('/') },
    { key: 'opened', label: 'Opened', value: (r) => r.opened, render: (r) => num(r.opened), bar: true },
    { key: 'share', label: 'Share', value: (r) => r.share, render: (r) => pct(r.share, 0) },
    { key: 'closed', label: 'Closed', value: (r) => r.closed, render: (r) => num(r.closed) },
    { key: 'backlog', label: 'Open backlog', value: (r) => r.backlog, render: (r) => num(r.backlog) },
    { key: 'over7', label: 'Over 7 days', value: (r) => r.over7, render: (r) => num(r.over7), status: (r) => (r.over7 > 60 * ds.sites[r.key].weight + 5 ? 'off' : 'ok') },
    { key: 'sla', label: 'Within SLA', value: (r) => r.sla, render: (r) => pct(r.sla), status: (r) => (r.sla === null ? 'none' : r.sla >= 0.95 ? 'ok' : r.sla >= 0.93 ? 'watch' : 'off') },
    { key: 'csat', label: 'Satisfaction', value: (r) => r.csat, render: (r) => fmt(r.csat, 'score'), status: (r) => (r.csat === null ? 'none' : r.csat >= 4.5 ? 'ok' : r.csat >= 4.3 ? 'watch' : 'off') },
  ];
  const g = rows.map((r) => ({ id: String(r.key), data: r }));
  return (
    <Visual title="Sites by volume" subtitle={`${ds.months[ctx.mi].label} · sorted by tickets opened · click a row to filter the site`} table={gridExport(cols, g)}>
      <Grid caption="Sites by volume" columns={cols} rows={g} dense defaultSort={{ key: 'opened', dir: 'desc' }} selected={(r) => route.sites.includes(r.key)} onRowClick={(r) => toggle('sites', r.key)} />
    </Visual>
  );
}

interface PriRow { pri: Pri | 'ALL'; label: string; resolved: number; resp: number | null; res: number | null; respT: number | null; resT: number | null; sla: number | null; prior: number | null; slaT: number | null }

function PriorityTable() {
  const { ds, ctx, route, toggle } = useApp();
  const row = (p: Pri | 'ALL'): PriRow => {
    const c: Ctx = p === 'ALL' ? ctx : { ...ctx, pri: [p] };
    const t = ticketRows(ds, c);
    const tp = ticketRows(ds, { ...c, mi: c.mi - 1 });
    const resolved = sum(t, (x) => x.resolved);
    return {
      pri: p, label: p === 'ALL' ? 'All tickets' : PRI_LABEL[p], resolved,
      resp: resolved ? sum(t, (x) => x.respMinSum) / resolved : null, res: resolved ? sum(t, (x) => x.resolveHrsSum) / resolved : null,
      respT: p === 'ALL' ? null : RESP_TARGET_MIN[p], resT: p === 'ALL' ? null : RESOLVE_TARGET_HRS[p],
      sla: resolved ? sum(t, (x) => x.slaMet) / resolved : null, prior: sum(tp, (x) => x.resolved) ? sum(tp, (x) => x.slaMet) / sum(tp, (x) => x.resolved) : null,
      slaT: p === 'ALL' ? 0.95 : SLA_TARGET[p],
    };
  };
  const rows = [...PRIORITIES.filter((p) => !ctx.pri.length || ctx.pri.includes(p)).map(row), row('ALL')];
  const hm = (m: number | null) => (m === null ? '–' : m >= 60 ? `${(m / 60).toFixed(1)} hrs` : `${Math.round(m)} min`);
  const cols: Col<PriRow>[] = [
    { key: 'label', label: 'Priority', value: (r) => r.label, render: (r) => (r.pri === 'ALL' ? <b>{r.label}</b> : <span className="pri-label"><i style={{ background: PRI_COLORS[r.pri] }} />{r.label}</span>) },
    { key: 'resolved', label: 'Resolved', value: (r) => r.resolved, render: (r) => num(r.resolved) },
    { key: 'resp', label: 'Avg respond', value: (r) => r.resp, render: (r) => hm(r.resp), status: (r) => (r.respT === null || r.resp === null ? undefined as never : r.resp <= r.respT ? 'ok' : 'off'), exportText: (r) => hm(r.resp) },
    { key: 'res', label: 'Avg resolve', value: (r) => r.res, render: (r) => (r.res === null ? '–' : `${r.res.toFixed(1)} hrs`), status: (r) => (r.resT === null || r.res === null ? undefined as never : r.res <= r.resT ? 'ok' : 'off'), exportText: (r) => r.res?.toFixed(1) ?? '' },
    { key: 'target', label: 'Target (respond / resolve)', value: (r) => r.respT, render: (r) => (r.respT === null ? 'n/a' : `${hm(r.respT)} / ${r.resT} hrs`), sortable: false },
    { key: 'prior', label: 'Prior month SLA', value: (r) => r.prior, render: (r) => pct(r.prior) },
    { key: 'sla', label: 'Within SLA', value: (r) => r.sla, render: (r) => <b>{pct(r.sla)}</b>, status: (r) => (r.sla === null || r.slaT === null ? 'none' : r.sla >= r.slaT ? 'ok' : r.slaT - r.sla <= 0.01 && r.pri !== 'P1' ? 'watch' : 'off'), exportText: (r) => pct(r.sla) },
  ];
  const g = rows.map((r) => ({ id: r.pri, data: r }));
  return (
    <Visual title="Resolution time by priority" subtitle={`${ds.months[ctx.mi].label} · targets ${PRIORITIES.slice(0, 4).map((p) => pct(SLA_TARGET[p], 0)).join(' / ')} within SLA · click a row to filter`} table={gridExport(cols, g)}>
      <Grid caption="Resolution time by priority" columns={cols} rows={g} dense selected={(r) => r.pri !== 'ALL' && route.pri.includes(r.pri)} onRowClick={(r) => { if (r.pri !== 'ALL') toggle('pri', r.pri); }} />
    </Visual>
  );
}

function SlaTrend() {
  const { ds, ctx, set } = useApp();
  const months = ds.months.filter((m) => m.mi <= ctx.mi && m.mi > ctx.mi - 13);
  const series = (['P1', 'P2', 'P3', 'P4'] as Pri[]).map((p, i) => ({ name: p, color: [PRI_COLORS.P1, PRI_COLORS.P2, SERIES[0], '#7a7f87'][i], data: months.map((m) => evaluate(ds, `sla_${p.toLowerCase()}`, { ...ctx, mi: m.mi }, 1).value) }));
  return (
    <Visual title="SLA compliance by priority, monthly" metricId="sla_all" subtitle="Targets P1 100%, P2 98%, P3/P4 95% (dashed: 95%)"
      table={{ columns: ['Month', 'P1', 'P2', 'P3', 'P4'], rows: months.map((m, i) => [m.label, ...series.map((s) => pct(s.data[i]))]) }}>
      <Chart height={240} ariaLabel="SLA by priority trend" option={lineOption({ labels: months.map((m) => m.short), series, fmt: (v) => pct(v, 0), target: 0.95, max: 1, min: 0.85 })}
        onClick={(i) => months[i] && set({ mi: months[i].mi })} />
    </Visual>
  );
}

interface CatRow { key: number; name: string; count: number; prior: number; share: number; cause: string; fix: string }

function RecurringCategories() {
  const { ds, ctx, route, toggle } = useApp();
  const c0: Ctx = { ...ctx, cat: [] };
  const all = sum(ticketRows(ds, c0), (r) => r.opened);
  const rows: CatRow[] = ds.categories.map((c) => ({
    key: c.key, name: c.name, cause: c.rootCause, fix: c.fix,
    count: sum(ticketRows(ds, { ...c0, cat: [c.key] }), (r) => r.opened),
    prior: sum(ticketRows(ds, { ...c0, cat: [c.key], mi: ctx.mi - 1 }), (r) => r.opened),
    share: 0,
  })).map((r) => ({ ...r, share: all ? r.count / all : 0 }));
  const cols: Col<CatRow>[] = [
    { key: 'name', label: 'Recurring category', width: 190, value: (r) => r.name },
    { key: 'count', label: 'Tickets', value: (r) => r.count, render: (r) => num(r.count), bar: true },
    { key: 'share', label: 'Share', value: (r) => r.share, render: (r) => pct(r.share, 0) },
    { key: 'chg', label: 'vs prior', value: (r) => r.count - r.prior, render: (r) => <span className={r.count - r.prior > r.prior * 0.1 ? 'txt-off' : r.count < r.prior ? 'txt-ok' : ''}>{fmtDelta(r.count - r.prior, 'count')}</span> },
    { key: 'cause', label: 'Root cause', align: 'left', wrap: true, value: (r) => r.cause, sortable: false },
    { key: 'fix', label: 'Resolution (fix, owner, date)', align: 'left', wrap: true, value: (r) => r.fix, sortable: false },
  ];
  const g = rows.map((r) => ({ id: String(r.key), data: r }));
  return (
    <Visual title="Top recurring issue categories" subtitle={`${ds.months[ctx.mi].label} · ranked by ticket count · click a row to filter the category`} table={gridExport(cols, g)}>
      <Grid caption="Recurring categories" columns={cols} rows={g} dense defaultSort={{ key: 'count', dir: 'desc' }} selected={(r) => route.cat.includes(r.key)} onRowClick={(r) => toggle('cat', r.key)} />
    </Visual>
  );
}
