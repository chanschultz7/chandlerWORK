// Metric catalog and status engine.
//
// Each metric carries its MOR definition (A2), target and amber band (Convene default, confirm per
// contract), source system, data owner and a compute function over the Dataset. Status follows A4:
//   Green  = meets or beats target.
//   Amber  = misses target inside the amber band, or meets target with an unfavorable 3-month trend.
//   Red    = misses target outside the amber band, or misses target three months in a row.
//   Grey   = not measured, or no target.

import type { Dataset, Pri, TicketFact } from './data/model';
import { RESOLVE_TARGET_HRS, RESP_TARGET_MIN, SLA_TARGET } from './data/generate';
import type { Unit } from './format';

export type Status = 'ok' | 'watch' | 'off' | 'none';
export type Area = 'Service Desk' | 'Clinical Systems' | 'Infrastructure' | 'Major Incidents' | 'Security' | 'Change' | 'Executive';
export const AREAS: Area[] = ['Service Desk', 'Clinical Systems', 'Infrastructure', 'Major Incidents', 'Security', 'Change'];
export type TrendLabel = 'Favorable' | 'Stable' | 'Unfavorable' | 'Up' | 'Down' | '–';

/** A4 trend rule threshold: moved more than this share of the prior value. */
export const TREND_THRESHOLD = 0.05;

export interface Ctx { mi: number; sites: number[]; pri: Pri[]; cat: number[] }

export interface MetricDef {
  id: string; code: string; name: string; short?: string; area: Area; unit: Unit; digits?: number;
  target: number | null; better: 'up' | 'down' | 'none'; amber?: number;
  targetText?: string; amberText?: string;
  definition: string; source: string; owner: string;
  /** 'site': the site filter applies. 'enterprise': measured once for the whole client. */
  scope: 'site' | 'enterprise';
  page: string;
  compute: (ds: Dataset, c: Ctx) => number | null;
  targetFn?: (ds: Dataset, c: Ctx) => number | null;
  statusFn?: (ds: Dataset, c: Ctx, v: number | null) => Status;
}

// ---------------------------------------------------------------- indexes (built once per dataset)

const idx = new WeakMap<Dataset, { t: TicketFact[][]; sm: Dataset['siteMonths'][]; sys: Dataset['systemMonths'][] }>();
function I(ds: Dataset) {
  let x = idx.get(ds);
  if (!x) {
    const n = ds.months.length;
    x = { t: Array.from({ length: n }, () => []), sm: Array.from({ length: n }, () => []), sys: Array.from({ length: n }, () => []) };
    ds.tickets.forEach((r) => x!.t[r.mi].push(r));
    ds.siteMonths.forEach((r) => x!.sm[r.mi].push(r));
    ds.systemMonths.forEach((r) => x!.sys[r.mi].push(r));
    idx.set(ds, x);
  }
  return x;
}

export function ticketRows(ds: Dataset, c: Ctx, over: Partial<Ctx> = {}) {
  const cc = { ...c, ...over };
  if (cc.mi < 0 || cc.mi >= ds.months.length) return [];
  return I(ds).t[cc.mi].filter((r) => (!cc.sites.length || cc.sites.includes(r.site)) && (!cc.pri.length || cc.pri.includes(r.pri)) && (!cc.cat.length || cc.cat.includes(r.cat)));
}
export function siteRows(ds: Dataset, c: Ctx) {
  if (c.mi < 0 || c.mi >= ds.months.length) return [];
  return I(ds).sm[c.mi].filter((r) => !c.sites.length || c.sites.includes(r.site));
}
export function systemRows(ds: Dataset, mi: number) {
  if (mi < 0 || mi >= ds.months.length) return [];
  return I(ds).sys[mi];
}
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
const ratio = (n: number, d: number) => (d > 0 ? n / d : null);
const inMonth = (ds: Dataset, mi: number) => mi >= 0 && mi < ds.months.length;
const infra = (ds: Dataset, mi: number) => (inMonth(ds, mi) ? ds.infra[mi] : null);
const sec = (ds: Dataset, mi: number) => (inMonth(ds, mi) ? ds.security[mi] : null);

function availability(ds: Dataset, mi: number, filter: (sys: number) => boolean) {
  const rows = systemRows(ds, mi).filter((r) => filter(r.sys));
  if (!rows.length) return null;
  return 1 - sum(rows, (r) => r.unplannedMin) / sum(rows, (r) => r.totalMin);
}
export function systemAvailability(ds: Dataset, mi: number, sys: number) { return availability(ds, mi, (s) => s === sys); }
const tierOf = (ds: Dataset, sys: number) => ds.systems[sys].tier;

function incidentsIn(ds: Dataset, c: Ctx) {
  return ds.incidents.filter((i) => i.mi === c.mi && (!c.sites.length || i.sites.some((s) => c.sites.includes(s))));
}
const usersShare = (ds: Dataset, c: Ctx) => (c.sites.length ? sum(ds.sites.filter((s) => c.sites.includes(s.key)), (s) => s.weight) : 1);

// ---------------------------------------------------------------- catalog

const ITSM = 'IT service management tool';
const MON = 'Monitoring tool; downtime log';
const pri = (p: Pri) => (c: Ctx) => ({ ...c, pri: c.pri.length && !c.pri.includes(p) ? ['__none__' as Pri] : [p] });

function slaMetric(p: Pri, code: string): MetricDef {
  return {
    id: `sla_${p.toLowerCase()}`, code, name: `SLA compliance, ${p === 'SR' ? 'service requests' : p}`, short: `SLA ${p}`, area: 'Service Desk', unit: 'pct',
    target: SLA_TARGET[p], better: 'up', amber: p === 'P1' ? 0 : p === 'P2' ? 0.01 : 0.02, amberText: p === 'P1' ? 'Any miss is red' : undefined,
    definition: `${p} tickets meeting the contracted SLA ÷ eligible ${p} tickets resolved in the month.`, source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = ticketRows(ds, pri(p)(c)); return ratio(sum(r, (x) => x.slaMet), sum(r, (x) => x.resolved)); },
  };
}
function respMetric(p: Pri, code: string, kind: 'resp' | 'res'): MetricDef {
  const resp = kind === 'resp';
  return {
    id: `${kind}_${p.toLowerCase()}`, code, name: `${resp ? 'Avg time to respond' : 'Avg time to resolve'}, ${p}`, short: `${resp ? 'Respond' : 'Resolve'} ${p}`, area: 'Service Desk',
    unit: resp ? 'min' : 'hrs', digits: resp ? 0 : 1, target: resp ? RESP_TARGET_MIN[p] : RESOLVE_TARGET_HRS[p], better: 'down', amber: resp ? RESP_TARGET_MIN[p] * 0.2 : RESOLVE_TARGET_HRS[p] * 0.2,
    definition: resp ? `Average time from ticket opened to first qualified response, ${p}.` : `Average time from ticket opened to resolved, ${p}, on the contract clock.`,
    source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = ticketRows(ds, pri(p)(c)); return ratio(sum(r, (x) => (resp ? x.respMinSum : x.resolveHrsSum)), sum(r, (x) => x.resolved)); },
  };
}

/** Contract service levels used for "Service levels met" and appendix A1. */
export const CONTRACT_SLAS: { id: string; label: string; ref: string; creditUsd: number }[] = [
  { id: 'resp_p1', label: 'P1 response time', ref: 'Sch. B 2.1', creditUsd: 7500 },
  { id: 'res_p1', label: 'P1 service restored', ref: 'Sch. B 2.2', creditUsd: 10000 },
  { id: 'resp_p2', label: 'P2 response time', ref: 'Sch. B 2.3', creditUsd: 4000 },
  { id: 'sla_p2', label: 'P2 resolved within SLA', ref: 'Sch. B 2.4', creditUsd: 5000 },
  { id: 'sla_p3', label: 'P3 resolved within SLA', ref: 'Sch. B 2.5', creditUsd: 2500 },
  { id: 'sla_p4', label: 'P4 resolved within SLA', ref: 'Sch. B 2.5', creditUsd: 1500 },
  { id: 'asa', label: 'Service desk speed to answer', ref: 'Sch. B 3.1', creditUsd: 2000 },
  { id: 'abandon', label: 'Call abandonment rate', ref: 'Sch. B 3.2', creditUsd: 2000 },
  { id: 'ehr_avail', label: 'EHR availability', ref: 'Sch. C 1.1', creditUsd: 15000 },
  { id: 'network', label: 'Network availability', ref: 'Sch. C 1.3', creditUsd: 6000 },
  { id: 'backup', label: 'Backup success rate', ref: 'Sch. C 2.1', creditUsd: 3000 },
  { id: 'crit7', label: 'Critical patches within 7 days', ref: 'Sch. D 1.2', creditUsd: 4000 },
];

export const METRICS: MetricDef[] = [
  // ---------------- Executive
  {
    id: 'svc_levels_met', code: 'EX-02', name: 'Service levels met', area: 'Executive', unit: 'pct', digits: 0, target: 1, better: 'up', amber: 0.1,
    definition: 'Contract service levels (A1) met in the month ÷ contract service levels measured.', source: 'Calculated from A1', owner: 'Service Delivery Lead', scope: 'enterprise', page: 'reference',
    compute: (ds, c) => {
      const st = CONTRACT_SLAS.map((s) => rawStatus(ds, M(s.id), { ...c, sites: [], pri: [], cat: [] }));
      const measured = st.filter((s) => s !== 'none');
      return ratio(measured.filter((s) => s === 'ok').length, measured.length);
    },
  },
  {
    id: 'open_critical', code: 'EX-05', name: 'Open critical issues', area: 'Executive', unit: 'count', target: null, better: 'down',
    definition: 'Open critical vulnerabilities + open high-severity security incidents + PHI exposure events at month end.', source: 'Vulnerability scanner; incident register', owner: 'Chief Information Security Officer', scope: 'enterprise', page: 'security',
    compute: (ds, c) => { const s = sec(ds, c.mi); return s ? s.vulnC + s.incHigh + s.phiEvents : null; },
  },
  // ---------------- Service desk
  {
    id: 'tickets_opened', code: 'SD-01', name: 'Tickets opened', area: 'Service Desk', unit: 'count', target: null, better: 'none',
    definition: 'Tickets opened in the month, reported separately for P1, P2, P3, P4 and service requests.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = ticketRows(ds, c); return r.length || inMonth(ds, c.mi) ? sum(r, (x) => x.opened) : null; },
  },
  {
    id: 'tickets_resolved', code: 'SD-02', name: 'Tickets resolved', area: 'Service Desk', unit: 'count', target: null, better: 'none',
    definition: 'Tickets resolved in the month.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => (inMonth(ds, c.mi) ? sum(ticketRows(ds, c), (x) => x.resolved) : null),
  },
  {
    id: 'throughput', code: 'SD-03', name: 'Resolved as % of opened', short: 'Throughput', area: 'Service Desk', unit: 'pct', digits: 0, target: null, better: 'up',
    definition: 'Tickets resolved ÷ tickets opened in the month. Below 100% grows the backlog.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = ticketRows(ds, c); return ratio(sum(r, (x) => x.resolved), sum(r, (x) => x.opened)); },
  },
  {
    id: 'sla_all', code: 'SD-04', name: 'Tickets resolved within SLA', short: 'SLA, all tickets', area: 'Service Desk', unit: 'pct', target: 0.95, better: 'up', amber: 0.02,
    definition: 'Tickets meeting the contracted SLA ÷ eligible tickets resolved, all priorities.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = ticketRows(ds, c); return ratio(sum(r, (x) => x.slaMet), sum(r, (x) => x.resolved)); },
  },
  slaMetric('P1', 'SD-05'), slaMetric('P2', 'SD-06'), slaMetric('P3', 'SD-07'), slaMetric('P4', 'SD-08'),
  respMetric('P1', 'SD-09', 'resp'), respMetric('P2', 'SD-10', 'resp'), respMetric('P3', 'SD-11', 'resp'), respMetric('P4', 'SD-12', 'resp'),
  respMetric('P1', 'SD-13', 'res'), respMetric('P2', 'SD-14', 'res'), respMetric('P3', 'SD-15', 'res'), respMetric('P4', 'SD-16', 'res'),
  {
    id: 'fcr', code: 'SD-17', name: 'First-call resolution', short: 'First-call resolution', area: 'Service Desk', unit: 'pct', target: 0.75, better: 'up', amber: 0.03,
    definition: 'Tickets resolved by the service desk on first contact ÷ service desk tickets.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.fcrFirst), sum(r, (x) => x.fcrEligible)); },
  },
  {
    id: 'asa', code: 'SD-18', name: 'Average speed to answer', short: 'Speed to answer', area: 'Service Desk', unit: 'sec', target: 30, better: 'down', amber: 10,
    definition: 'Average seconds from a call entering the queue to an agent answering.', source: 'Phone system', owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.asaSecSum), sum(r, (x) => x.callsAnswered)); },
  },
  {
    id: 'abandon', code: 'SD-19', name: 'Call abandonment rate', short: 'Abandonment', area: 'Service Desk', unit: 'pct', target: 0.05, better: 'down', amber: 0.01,
    definition: 'Calls ended before answer ÷ calls offered; excludes calls under 10 seconds.', source: 'Phone system', owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.callsAbandoned), sum(r, (x) => x.callsOffered)); },
  },
  {
    id: 'backlog_open', code: 'SD-20', name: 'Open backlog at month end', short: 'Open backlog', area: 'Service Desk', unit: 'count', target: null, better: 'down',
    definition: 'Open incidents and requests at month end.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => (inMonth(ds, c.mi) ? sum(siteRows(ds, c), (x) => x.backlogOpen) : null),
  },
  {
    id: 'over7', code: 'SD-21', name: 'Tickets open more than 7 days', short: 'Open > 7 days', area: 'Service Desk', unit: 'count', target: 60, better: 'down', amber: 15,
    targetText: '≤ 60 (scaled to the sites selected)', definition: 'Open incidents and requests at month end older than 7 calendar days.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => (inMonth(ds, c.mi) ? sum(siteRows(ds, c), (x) => x.backlogOver7) : null),
    targetFn: (ds, c) => Math.round(60 * usersShare(ds, c)),
  },
  {
    id: 'reopen', code: 'SD-22', name: 'Reopened ticket rate', short: 'Reopened', area: 'Service Desk', unit: 'pct', target: 0.05, better: 'down', amber: 0.01,
    definition: 'Resolved tickets reopened within 10 days ÷ resolved tickets.', source: ITSM, owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => ratio(sum(siteRows(ds, c), (x) => x.reopened), sum(ticketRows(ds, { ...c, pri: [], cat: [] }), (x) => x.resolved)),
  },
  {
    id: 'csat', code: 'SD-23', name: 'User satisfaction (1 to 5)', short: 'User satisfaction', area: 'Service Desk', unit: 'score', digits: 2, target: 4.5, better: 'up', amber: 0.2,
    definition: 'Average closed-ticket survey score (1 to 5); response count reported.', source: 'Survey tool', owner: 'Service Desk Manager', scope: 'site', page: 'service-desk',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.csatSum), sum(r, (x) => x.csatN)); },
  },
  // ---------------- Clinical systems
  {
    id: 'ehr_avail', code: 'CS-01', name: 'EHR availability (unscheduled downtime only)', short: 'EHR availability', area: 'Clinical Systems', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Scheduled minutes less unscheduled downtime ÷ scheduled minutes for the production EHR.', source: MON, owner: 'Clinical Apps Lead', scope: 'enterprise', page: 'clinical',
    compute: (ds, c) => systemAvailability(ds, c.mi, 0),
  },
  {
    id: 'clin_avail', code: 'CS-02', name: 'Critical clinical systems availability', short: 'Clinical systems', area: 'Clinical Systems', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Same method as EHR, across the agreed P1 clinical system list (excluding the EHR).', source: MON, owner: 'Clinical Apps Lead', scope: 'enterprise', page: 'clinical',
    compute: (ds, c) => availability(ds, c.mi, (s) => s !== 0 && tierOf(ds, s) === 'P1'),
  },
  {
    id: 'clin_below', code: 'CS-03', name: 'Clinical systems below target', short: 'Systems below target', area: 'Clinical Systems', unit: 'count', target: 0, better: 'down', amber: 1,
    definition: 'Clinical systems whose availability missed their tier target (P1 99.9%, general 99.5%).', source: MON, owner: 'Clinical Apps Lead', scope: 'enterprise', page: 'clinical',
    compute: (ds, c) => (inMonth(ds, c.mi) ? ds.systems.filter((s) => (systemAvailability(ds, c.mi, s.key) ?? 1) < (s.tier === 'P1' ? 0.999 : 0.995)).length : null),
  },
  {
    id: 'clin_planned', code: 'CS-04', name: 'Planned clinical downtime', short: 'Planned downtime', area: 'Clinical Systems', unit: 'hrs', target: null, better: 'none',
    definition: 'Approved maintenance windows on clinical systems, reported separately.', source: 'Change calendar', owner: 'Clinical Apps Lead', scope: 'enterprise', page: 'clinical',
    compute: (ds, c) => (inMonth(ds, c.mi) ? sum(systemRows(ds, c.mi), (r) => r.plannedHrs) : null),
  },
  {
    id: 'interface_errors', code: 'CS-05', name: 'Interface errors', area: 'Clinical Systems', unit: 'count', target: null, better: 'down',
    definition: 'Interface messages failed or rejected between clinical systems.', source: 'Interface engine', owner: 'Integration Lead', scope: 'enterprise', page: 'clinical',
    compute: (ds, c) => (inMonth(ds, c.mi) ? sum(systemRows(ds, c.mi), (r) => r.interfaceErrors) : null),
  },
  // ---------------- Infrastructure
  {
    id: 'uptime_p1', code: 'IN-01', name: 'Critical-system uptime, P1 tier', short: 'Critical uptime (P1)', area: 'Infrastructure', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Availability of P1-tier systems combined; P1 and general systems assessed separately.', source: 'Infrastructure monitoring tool', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => availability(ds, c.mi, (s) => tierOf(ds, s) === 'P1'),
  },
  {
    id: 'uptime_gen', code: 'IN-02', name: 'Critical-system uptime, general tier', short: 'Uptime (general)', area: 'Infrastructure', unit: 'pct', digits: 2, target: 0.995, better: 'up', amber: 0.002,
    definition: 'Availability of general-tier systems combined.', source: 'Infrastructure monitoring tool', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => availability(ds, c.mi, (s) => tierOf(ds, s) === 'General'),
  },
  {
    id: 'sched_down', code: 'IN-03', name: 'Scheduled downtime (reported separately)', short: 'Scheduled downtime', area: 'Infrastructure', unit: 'hrs', target: null, better: 'none',
    definition: 'Approved maintenance downtime; excluded from target performance.', source: 'Change calendar; monitoring tool', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.schedHrs ?? null,
  },
  {
    id: 'unsched_down', code: 'IN-04', name: 'Unscheduled downtime (counts against target)', short: 'Unscheduled downtime', area: 'Infrastructure', unit: 'hrs', target: 2, better: 'down', amber: 1,
    definition: 'Unplanned outage duration across infrastructure services; only this downtime counts against target.', source: MON, owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.unschedHrs ?? null,
  },
  {
    id: 'network', code: 'IN-05', name: 'Network availability', short: 'Network', area: 'Infrastructure', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Minutes the core network and site links are up ÷ total minutes.', source: 'Network monitoring tool', owner: 'Network Lead', scope: 'site', page: 'infrastructure',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.netUpMin), sum(r, (x) => x.netTotMin)); },
  },
  {
    id: 'wan', code: 'IN-06', name: 'Internet and WAN availability', short: 'Internet / WAN', area: 'Infrastructure', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Minutes internet and WAN carriers are up ÷ total minutes.', source: 'Network monitoring tool', owner: 'Network Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.wan ?? null,
  },
  {
    id: 'server', code: 'IN-07', name: 'Server and hosting availability', short: 'Servers', area: 'Infrastructure', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Minutes production servers are up ÷ total minutes, excluding approved maintenance.', source: 'Infrastructure monitoring tool', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.server ?? null,
  },
  {
    id: 'email', code: 'IN-08', name: 'Email availability', short: 'Email', area: 'Infrastructure', unit: 'pct', digits: 2, target: 0.999, better: 'up', amber: 0.0005,
    definition: 'Minutes the email service is up for users ÷ total minutes.', source: 'Email admin portal', owner: 'Messaging Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.email ?? null,
  },
  {
    id: 'backup', code: 'IN-09', name: 'Backup success', short: 'Backup success', area: 'Infrastructure', unit: 'pct', digits: 2, target: 1, better: 'up',
    amberText: 'Amber if every failed job re-ran successfully within 24 hours; red otherwise',
    definition: 'Backup jobs completed without error ÷ scheduled jobs; any failure is flagged.', source: 'Backup console', owner: 'Backup Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => { const x = infra(ds, c.mi); return x ? 1 - x.backupFailed / x.backupJobs : null; },
    statusFn: (ds, c, v) => { const x = infra(ds, c.mi); if (!x || v === null) return 'none'; if (x.backupFailed === 0) return 'ok'; return x.backupRerunOk >= x.backupFailed ? 'watch' : 'off'; },
  },
  {
    id: 'patch30', code: 'IN-10', name: 'All patches within 30 days of release', short: 'Patches ≤ 30 days', area: 'Infrastructure', unit: 'pct', target: 0.95, better: 'up', amber: 0.02,
    definition: 'In-scope devices with all approved patches installed within 30 days of release.', source: 'Patch management tool', owner: 'Endpoint Lead', scope: 'site', page: 'infrastructure',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.patch30), sum(r, (x) => x.patchDevices)); },
  },
  {
    id: 'crit7', code: 'IN-11', name: 'Critical security patches within 7 days', short: 'Critical patches ≤ 7 days', area: 'Infrastructure', unit: 'pct', target: 1, better: 'up', amber: 0.03, amberText: 'Amber within 3 pts',
    definition: 'In-scope devices with critical security patches installed within 7 days.', source: 'Patch management tool', owner: 'Endpoint Lead', scope: 'site', page: 'infrastructure',
    compute: (ds, c) => { const r = siteRows(ds, c); return ratio(sum(r, (x) => x.crit7), sum(r, (x) => x.critDevices)); },
  },
  {
    id: 'storage', code: 'IN-12', name: 'Storage utilization, peak', short: 'Storage used', area: 'Infrastructure', unit: 'pct', digits: 0, target: 0.8, better: 'down', amber: 0.1, targetText: '≤ 80%', amberText: 'Amber 80%; red 90%',
    definition: 'Peak monthly storage used as percent of capacity.', source: 'Monitoring tools', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.storagePeak ?? null,
  },
  {
    id: 'bandwidth', code: 'IN-13', name: 'Internet bandwidth used, peak', short: 'Bandwidth used', area: 'Infrastructure', unit: 'pct', digits: 0, target: 0.8, better: 'down', amber: 0.1, targetText: '≤ 80%', amberText: 'Amber 80%; red 90%',
    definition: 'Peak internet bandwidth as percent of capacity.', source: 'Monitoring tools', owner: 'Network Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.bandwidthPeak ?? null,
  },
  {
    id: 'hostmem', code: 'IN-14', name: 'Server host CPU / memory used, peak', short: 'Host CPU / memory', area: 'Infrastructure', unit: 'pct', digits: 0, target: 0.8, better: 'down', amber: 0.1, targetText: '≤ 80%', amberText: 'Amber 80%; red 90%',
    definition: 'Peak host CPU or memory (whichever is higher) as percent of capacity.', source: 'Monitoring tools', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => { const x = infra(ds, c.mi); return x ? Math.max(x.cpuPeak, x.memPeak) : null; },
  },
  {
    id: 'certs60', code: 'IN-15', name: 'Certificates expiring within 60 days', short: 'Certs ≤ 60 days', area: 'Infrastructure', unit: 'count', target: 0, better: 'down', targetText: 'Flag 60 days; red 14 days', amberText: 'Amber ≤ 60 days; red ≤ 14 days',
    definition: 'In-scope certificates with an expiration date inside 60 days.', source: 'Certificate inventory', owner: 'Infrastructure Lead', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.certs60 ?? null,
    statusFn: (ds, c) => { const x = infra(ds, c.mi); if (!x) return 'none'; return x.certs14 > 0 ? 'off' : x.certs60 > 0 ? 'watch' : 'ok'; },
  },
  // ---------------- Change
  {
    id: 'chg_total', code: 'CH-01', name: 'Changes implemented', short: 'Changes', area: 'Change', unit: 'count', target: null, better: 'none',
    definition: 'Implemented changes, counted as standard, normal and emergency.', source: ITSM, owner: 'Change Manager', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => { const x = infra(ds, c.mi); return x ? x.chgStd + x.chgNormal + x.chgEmerg : null; },
  },
  {
    id: 'chg_success', code: 'CH-02', name: 'Change success rate (failed = caused incident)', short: 'Change success', area: 'Change', unit: 'pct', target: 0.98, better: 'up', amber: 0.01,
    definition: 'Changes completed without causing an incident ÷ changes implemented.', source: ITSM, owner: 'Change Manager', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => { const x = infra(ds, c.mi); return x ? 1 - x.chgFailed / (x.chgStd + x.chgNormal + x.chgEmerg) : null; },
  },
  {
    id: 'chg_emerg', code: 'CH-03', name: 'Emergency change count', short: 'Emergency changes', area: 'Change', unit: 'count', target: null, better: 'down', amberText: 'Flag an unusual increase',
    definition: 'Emergency changes implemented; a high count signals instability.', source: ITSM, owner: 'Change Manager', scope: 'enterprise', page: 'infrastructure',
    compute: (ds, c) => infra(ds, c.mi)?.chgEmerg ?? null,
    statusFn: (ds, c, v) => spike(ds, c, v, 'chg_emerg', 2),
  },
  // ---------------- Major incidents
  {
    id: 'mi_p1p2', code: 'MI-01', name: 'P1 and P2 incidents (count)', short: 'P1 + P2 incidents', area: 'Major Incidents', unit: 'count', target: 2, better: 'down', amber: 1, targetText: '≤ 2 per month',
    definition: 'Incidents classified P1 or P2 under A3, counted by date opened.', source: ITSM, owner: 'Service Delivery Lead', scope: 'site', page: 'incidents',
    compute: (ds, c) => (inMonth(ds, c.mi) ? incidentsIn(ds, c).length : null),
  },
  {
    id: 'mi_p1', code: 'MI-02', name: 'P1 incidents', area: 'Major Incidents', unit: 'count', target: 0, better: 'down', amber: 0,
    definition: 'Incidents classified P1 under A3.', source: ITSM, owner: 'Service Delivery Lead', scope: 'site', page: 'incidents',
    compute: (ds, c) => (inMonth(ds, c.mi) ? incidentsIn(ds, c).filter((i) => i.sev === 'P1').length : null),
  },
  {
    id: 'mi_downtime', code: 'MI-03', name: 'Clinical downtime from major incidents', short: 'Clinical downtime', area: 'Major Incidents', unit: 'hrs', target: null, better: 'down',
    definition: 'Hours clinical users worked on downtime procedures because of P1/P2 incidents.', source: 'Incident register', owner: 'Service Delivery Lead', scope: 'site', page: 'incidents',
    compute: (ds, c) => (inMonth(ds, c.mi) ? sum(incidentsIn(ds, c), (i) => i.clinicalDowntimeHrs) : null),
  },
  // ---------------- Security
  {
    id: 'sec_incidents', code: 'SC-01', name: 'Security incidents', area: 'Security', unit: 'count', target: null, better: 'none',
    definition: 'Security incidents reported, by count, severity and status.', source: 'SIEM; incident register', owner: 'Chief Information Security Officer', scope: 'enterprise', page: 'security',
    compute: (ds, c) => { const s = sec(ds, c.mi); return s ? s.incLow + s.incMed + s.incHigh : null; },
  },
  {
    id: 'phish', code: 'SC-02', name: 'Phishing simulation click rate after training', short: 'Phishing click rate', area: 'Security', unit: 'pct', target: 0.05, better: 'down', amber: 0.015,
    definition: 'Users clicking a simulated phishing message after training ÷ delivered simulations.', source: 'Security awareness platform', owner: 'Security Awareness Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => { const s = sec(ds, c.mi); return s ? s.phishClicks / s.phishDelivered : null; },
  },
  {
    id: 'vuln_crit', code: 'SC-03', name: 'Critical vulnerabilities open', short: 'Critical vulns', area: 'Security', unit: 'count', target: null, better: 'down', amberText: 'Flag an unusual increase',
    definition: 'Open scan findings rated Critical at month end. High, medium and low reported alongside.', source: 'Vulnerability scanner', owner: 'Vulnerability Mgmt Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.vulnC ?? null,
    statusFn: (ds, c, v) => spike(ds, c, v, 'vuln_crit', 1.2),
  },
  {
    id: 'mttp', code: 'SC-04', name: 'Mean time to patch critical CVEs', short: 'Time to patch critical', area: 'Security', unit: 'days', target: 7, better: 'down', amber: 2, targetText: '< 7 days',
    definition: 'Average days from critical CVE release or detection to patch on in-scope devices.', source: 'Vulnerability scanner; patch tool', owner: 'Vulnerability Mgmt Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.mttpCrit ?? null,
  },
  {
    id: 'endpoint', code: 'SC-05', name: 'Endpoint protection coverage', short: 'Endpoint coverage', area: 'Security', unit: 'pct', target: 1, better: 'up', amber: 0.005, amberText: 'Amber within 0.5 pts',
    definition: 'In-scope endpoints actively reporting protection ÷ in-scope endpoints.', source: 'Endpoint console; inventory', owner: 'Endpoint Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.endpointCov ?? null,
  },
  {
    id: 'mfa', code: 'SC-06', name: 'Multifactor sign-in coverage', short: 'MFA coverage', area: 'Security', unit: 'pct', target: 1, better: 'up', amber: 0.03,
    definition: 'Accounts requiring a second sign-in step ÷ in-scope accounts.', source: 'Identity platform', owner: 'Identity Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.mfaCov ?? null,
  },
  {
    id: 'encryption', code: 'SC-07', name: 'Laptop encryption', area: 'Security', unit: 'pct', target: 1, better: 'up', amber: 0.01,
    definition: 'In-scope laptops encrypted ÷ in-scope laptops.', source: 'Endpoint console', owner: 'Endpoint Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.encryption ?? null,
  },
  {
    id: 'training', code: 'SC-08', name: 'Security training completion', short: 'Training', area: 'Security', unit: 'pct', target: 0.95, better: 'up', amber: 0.03,
    definition: 'In-scope staff completing annual security training ÷ in-scope staff.', source: 'Learning system; HR list', owner: 'Security Awareness Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.training ?? null,
  },
  {
    id: 'admin_review', code: 'SC-09', name: 'Admin account review', short: 'Admin review', area: 'Security', unit: 'pct', target: 1, better: 'up', amber: 0.05,
    definition: 'Admin accounts reviewed in the period ÷ admin accounts.', source: 'Identity platform', owner: 'Identity Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.adminReview ?? null,
  },
  {
    id: 'failed_logins', code: 'SC-10', name: 'Failed logins', area: 'Security', unit: 'count', target: null, better: 'down', amberText: 'Flag unusual spikes',
    definition: 'Failed login attempts; anomaly indicator. Lockouts reported alongside.', source: 'Identity platform; SIEM', owner: 'Chief Information Security Officer', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.failedLogins ?? null,
    statusFn: (ds, c, v) => spike(ds, c, v, 'failed_logins', 1.3),
  },
  {
    id: 'lockouts', code: 'SC-11', name: 'Account lockouts', area: 'Security', unit: 'count', target: null, better: 'down', amberText: 'Flag unusual spikes',
    definition: 'Account lockouts; anomaly indicator.', source: 'Identity platform; SIEM', owner: 'Chief Information Security Officer', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.lockouts ?? null,
    statusFn: (ds, c, v) => spike(ds, c, v, 'lockouts', 1.3),
  },
  {
    id: 'phi', code: 'SC-12', name: 'PHI exposure events', area: 'Security', unit: 'count', target: 0, better: 'down', amber: 0, targetText: '0', amberText: 'Any event is red; reported separately',
    definition: 'Confirmed or suspected protected health information exposure events.', source: 'Incident register; privacy office', owner: 'Privacy Officer', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.phiEvents ?? null,
  },
  {
    id: 'patch_exc', code: 'SC-13', name: 'Patching exceptions logged', short: 'Patch exceptions', area: 'Security', unit: 'count', target: null, better: 'none', amberText: 'Review aging and risk',
    definition: 'Devices that cannot be patched, including medical devices; tracked as exceptions, not misses.', source: 'Patch tool; exception register', owner: 'Vulnerability Mgmt Lead', scope: 'enterprise', page: 'security',
    compute: (ds, c) => sec(ds, c.mi)?.patchExceptions ?? null,
  },
];

export const METRIC_BY_ID: Record<string, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.id, m]));
export const M = (id: string) => METRIC_BY_ID[id];

/** Scorecard rows (slides 4 and 5), in template order. */
export const SCORECARD_IDS = [
  'tickets_opened', 'sla_p1', 'sla_p2', 'sla_p3', 'sla_p4', 'resp_p1', 'resp_p2', 'resp_p3', 'resp_p4', 'res_p1', 'res_p2', 'res_p3', 'res_p4',
  'fcr', 'asa', 'abandon', 'over7', 'reopen', 'csat',
  'ehr_avail', 'clin_avail',
  'uptime_p1', 'uptime_gen', 'sched_down', 'unsched_down', 'backup', 'patch30', 'crit7', 'storage', 'certs60', 'network',
  'mi_p1p2',
  'sec_incidents', 'phish', 'vuln_crit', 'mttp', 'endpoint', 'failed_logins', 'phi', 'patch_exc',
  'chg_total', 'chg_success', 'chg_emerg',
];

// ---------------------------------------------------------------- status engine

function spike(ds: Dataset, c: Ctx, v: number | null, id: string, factor: number): Status {
  if (v === null) return 'none';
  const prev = [1, 2, 3].map((k) => M(id).compute(ds, { ...c, mi: c.mi - k })).filter((x): x is number => x !== null);
  if (!prev.length) return 'none';
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
  return v > avg * factor ? 'watch' : 'ok';
}

export function targetOf(ds: Dataset, m: MetricDef, c: Ctx): number | null {
  return m.targetFn ? m.targetFn(ds, c) : m.target;
}

/** Status from target and amber band only (no trend or repeat-miss rules). */
export function rawStatus(ds: Dataset, m: MetricDef, c: Ctx, value?: number | null): Status {
  const v = value === undefined ? m.compute(ds, c) : value;
  if (m.statusFn) return m.statusFn(ds, c, v);
  const t = targetOf(ds, m, c);
  if (v === null || t === null || m.better === 'none') return 'none';
  const gap = m.better === 'up' ? t - v : v - t; // > 0 means missing
  const eps = 1e-9;
  if (gap <= eps) return 'ok';
  return gap <= (m.amber ?? 0) + eps ? 'watch' : 'off';
}

export function trendLabel(m: MetricDef, cur: number | null, prior: number | null): TrendLabel {
  if (cur === null || prior === null) return '–';
  const base = Math.abs(prior) || 1;
  const d = cur - prior;
  // For availability-style percentages, use the gap to 100% so small moves still register.
  const rel = m.unit === 'pct' && (m.digits ?? 1) >= 2 ? d / Math.max(1 - prior, 0.0005) / 10 : d / base;
  if (Math.abs(rel) <= TREND_THRESHOLD) return 'Stable';
  if (m.better === 'none') return d > 0 ? 'Up' : 'Down';
  return (m.better === 'up') === d > 0 ? 'Favorable' : 'Unfavorable';
}

export interface MetricValue {
  m: MetricDef; value: number | null; target: number | null; status: Status; variance: number | null;
  prior: number | null; py: number | null; change: number | null; pyChange: number | null;
  mom: TrendLabel; m3: TrendLabel; threeAgo: number | null; range3: [number, number] | null;
  monthsMet: number; monthsMeasured: number;
  trend: { mi: number; value: number | null; target: number | null; status: Status }[];
}

const cache = new WeakMap<Dataset, Map<string, MetricValue>>();

export function evaluate(ds: Dataset, id: string, c: Ctx, trendMonths = 13): MetricValue {
  let mc = cache.get(ds);
  if (!mc) { mc = new Map(); cache.set(ds, mc); }
  const key = `${id}|${c.mi}|${c.sites.join(',')}|${c.pri.join(',')}|${c.cat.join(',')}|${trendMonths}`;
  const hit = mc.get(key);
  if (hit) return hit;
  const m = M(id);
  const at = (mi: number) => m.compute(ds, { ...c, mi });
  const value = at(c.mi);
  const prior = at(c.mi - 1);
  const py = at(c.mi - 12);
  const threeAgo = at(c.mi - 3);
  const target = targetOf(ds, m, c);
  let status = rawStatus(ds, m, c, value);
  const m3 = trendLabel(m, value, threeAgo);
  if (!m.statusFn && status !== 'none') {
    // A4: misses target three months in a row -> red.
    if (status === 'watch') {
      const p1 = rawStatus(ds, m, { ...c, mi: c.mi - 1 });
      const p2 = rawStatus(ds, m, { ...c, mi: c.mi - 2 });
      if (p1 !== 'ok' && p1 !== 'none' && p2 !== 'ok' && p2 !== 'none') status = 'off';
    }
    // A4: meets target with an unfavorable 3-month trend -> amber.
    // Applied when the measure is close to target (headroom inside the amber band, or 10% of target),
    // so noise far from target does not turn a comfortable green amber.
    if (status === 'ok' && m3 === 'Unfavorable' && target !== null && value !== null) {
      const headroom = Math.abs(value - target);
      const band = m.amber && m.amber > 0 ? m.amber : Math.abs(target) * 0.1;
      if (headroom <= band) status = 'watch';
    }
  }
  const range = [1, 2, 3].map((k) => at(c.mi - k)).filter((x): x is number => x !== null);
  let met = 0;
  let measured = 0;
  for (let k = 0; k < 12; k++) {
    const mi = c.mi - k;
    if (mi < 0) break;
    const s = rawStatus(ds, m, { ...c, mi });
    if (s !== 'none') { measured++; if (s === 'ok') met++; }
  }
  const trend = [];
  for (let k = trendMonths - 1; k >= 0; k--) {
    const mi = c.mi - k;
    if (mi < 0) continue;
    const cc = { ...c, mi };
    const v = m.compute(ds, cc);
    trend.push({ mi, value: v, target: targetOf(ds, m, cc), status: rawStatus(ds, m, cc, v) });
  }
  const out: MetricValue = {
    m, value, target, status, variance: value !== null && target !== null ? value - target : null,
    prior, py, change: value !== null && prior !== null ? value - prior : null, pyChange: value !== null && py !== null ? value - py : null,
    mom: trendLabel(m, value, prior), m3, threeAgo,
    range3: range.length ? [Math.min(...range), Math.max(...range)] : null,
    monthsMet: met, monthsMeasured: measured, trend,
  };
  mc.set(key, out);
  return out;
}

export const STATUS_LABEL: Record<Status, string> = { ok: 'Green: meets target', watch: 'Amber: watch', off: 'Red: misses target', none: 'Grey: no target' };
export const STATUS_SHORT: Record<Status, string> = { ok: 'Green', watch: 'Amber', off: 'Red', none: 'No target' };

/** Target as written in the scorecard. */
export function targetText(ds: Dataset, m: MetricDef, c: Ctx, f: (v: number | null) => string): string {
  if (m.targetText) return m.targetText;
  const t = targetOf(ds, m, c);
  if (t === null) return 'No target';
  if (m.better === 'down') return `≤ ${f(t)}`;
  if (m.better === 'up' && t < 1) return `≥ ${f(t)}`;
  return f(t);
}
