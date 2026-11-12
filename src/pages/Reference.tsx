// Appendix: A1 contract service levels and credits, A2 metric definitions, A3 severity
// definitions, A4 status rules.

import { fmt } from '../format';
import { AREAS, CONTRACT_SLAS, evaluate, METRICS, rawStatus, targetText, type MetricDef, type MetricValue, type Status } from '../metrics';
import { useApp } from '../state';
import { fm, StatusMark } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';

const TABS = [['a1', 'A1 · Contract service levels'], ['a2', 'A2 · Metric definitions'], ['a3', 'A3 · Incident severity'], ['a4', 'A4 · Status rules']] as const;

export function Reference() {
  const { route, set } = useApp();
  const tab = TABS.some((t) => t[0] === route.tab) ? route.tab : 'a1';
  return (
    <div className="page">
      <CanvasHeader />
      <div className="subtabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => set({ tab: k })}>{l}</button>)}
      </div>
      {tab === 'a1' && <ContractSlas />}
      {tab === 'a2' && <Definitions />}
      {tab === 'a3' && <Severity />}
      {tab === 'a4' && <StatusRules />}
    </div>
  );
}

interface SlaRow { label: string; ref: string; v: MetricValue; credit: number; met: Status }

function ContractSlas() {
  const { ds, ctx } = useApp();
  const ec = { ...ctx, sites: [], pri: [], cat: [] };
  const rows: SlaRow[] = CONTRACT_SLAS.map((s) => { const v = evaluate(ds, s.id, ec); return { label: s.label, ref: s.ref, credit: s.creditUsd, v, met: rawStatus(ds, v.m, ec, v.value) }; });
  // Contract view: met or missed against target only (trend rules do not apply to credits).
  const atRisk = (r: SlaRow) => (r.met === 'off' ? r.credit : 0);
  const cols: Col<SlaRow>[] = [
    { key: 'label', label: 'Service level', width: 220, value: (r) => r.label },
    { key: 'ref', label: 'Contract ref.', align: 'left', value: (r) => r.ref },
    { key: 'target', label: 'Target', value: (r) => r.v.target, render: (r) => targetText(ds, r.v.m, ec, fm(r.v.m.id)), exportText: (r) => targetText(ds, r.v.m, ec, fm(r.v.m.id)) },
    { key: 'measured', label: 'Measured', value: (r) => r.v.value, render: (r) => <b>{fm(r.v.m.id)(r.v.value)}</b>, exportText: (r) => fm(r.v.m.id)(r.v.value) },
    { key: 'met', label: 'Met', align: 'center', value: (r) => r.met, render: (r) => <StatusMark status={r.met} label={r.met === 'ok' ? 'Met' : r.met === 'watch' ? 'Missed (amber band)' : 'Missed'} />, exportText: (r) => (r.met === 'ok' ? 'Met' : 'Missed') },
    { key: 'months', label: 'Months met (12)', value: (r) => r.v.monthsMet, render: (r) => `${r.v.monthsMet} of ${r.v.monthsMeasured}` },
    { key: 'risk', label: 'Credit at risk', value: (r) => atRisk(r), render: (r) => (atRisk(r) ? <span className="txt-off">{fmt(atRisk(r), 'usd')}</span> : '$0'), exportText: (r) => atRisk(r) },
    { key: 'applied', label: 'Credit applied', value: (r) => atRisk(r), render: (r) => fmt(atRisk(r), 'usd'), exportText: (r) => atRisk(r) },
    { key: 'notes', label: 'Notes', align: 'left', wrap: true, value: (r) => notes(r), sortable: false },
  ];
  const g = rows.map((r) => ({ id: r.label, data: r }));
  const total = rows.reduce((a, r) => a + atRisk(r), 0);
  return (
    <Visual title="A1. Contract service levels and service credits" subtitle={`${ds.months[ctx.mi].label} · contract: Managed IT Services Agreement (mock), schedules B-D · credits follow the contract formula`} table={gridExport(cols, g)}>
      <Grid caption="Contract service levels" columns={cols} rows={g} dense />
      <div className="credit-total">Total service credits this month: <b>{fmt(total, 'usd')}</b> at risk · <b>{fmt(total, 'usd')}</b> applied · credit memo reference CM-{ds.months[ctx.mi].key.replace('-', '')}</div>
      <p className="footnote">Convene reports every miss, including misses where no credit applies or an exclusion is claimed. Credit values are illustrative mock figures.</p>
    </Visual>
  );
}
function notes(r: SlaRow) {
  if (r.v.m.id === 'ehr_avail' && r.v.status !== 'ok') return 'Storage controller P1 (Oct 14); vendor root cause under review, no exclusion claimed';
  if (r.v.m.id === 'backup' && r.v.status !== 'ok') return 'Failed jobs at Hospital C; two did not re-run within 24 hours';
  if (r.met === 'watch') return 'Inside amber band; no credit';
  if (r.met === 'ok' && r.v.status === 'watch') return 'Met; 3-month trend unfavorable';
  return '';
}

function Definitions() {
  const { ds, ctx } = useApp();
  const list = METRICS.filter((m) => m.area !== 'Executive' || true);
  const cols: Col<MetricDef>[] = [
    { key: 'code', label: 'Code', value: (r) => r.code, width: 60 },
    { key: 'name', label: 'Metric', align: 'left', value: (r) => r.name, width: 220 },
    { key: 'def', label: 'Definition', align: 'left', wrap: true, value: (r) => r.definition, sortable: false },
    { key: 'target', label: 'Target', align: 'left', value: (r) => targetText(ds, r, ctx, fm(r.id)), sortable: false },
    { key: 'amber', label: 'Amber band', align: 'left', wrap: true, value: (r) => r.amberText ?? (r.target === null ? 'n/a' : r.amber !== undefined ? fmt(r.amber, r.unit, r.digits) : 'Below target is red'), sortable: false },
    { key: 'src', label: 'Source system', align: 'left', wrap: true, value: (r) => r.source },
    { key: 'owner', label: 'Data owner', align: 'left', value: (r) => r.owner },
    { key: 'scope', label: 'Site filter', align: 'center', value: (r) => (r.scope === 'site' ? 'Yes' : 'Enterprise') },
  ];
  const g = list.map((m) => ({ id: m.id, data: m, group: m.area }));
  const order = ['Executive', ...AREAS];
  g.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  return (
    <Visual title="A2. Metric definitions, targets and data sources" subtitle="Confirm with the client before the first review · all targets are Convene defaults, confirm per contract" table={gridExport(cols, g)}>
      <Grid caption="Metric definitions" columns={cols} rows={g} groups dense />
    </Visual>
  );
}

const SEVERITY = [
  { sev: 'P1 Critical', def: 'A clinical or business-critical system is down or unsafe for many users. Patient care or revenue work stops or moves to downtime procedures.', ex: 'EHR down at a hospital; network outage at a hospital; suspected ransomware', resp: '15 min', restore: '4 hrs', notify: 'Phone call to the client on-call contact in 15 min; bridge call opened', cadence: 'Every 30 min' },
  { sev: 'P2 High', def: 'A critical system is degraded, or one department or site cannot work. A workaround exists but slows care or work.', ex: 'Imaging slow in the ED; lab interface stopped; a clinic offline', resp: '30 min', restore: '8 hrs', notify: 'Email and phone to the client contact in 30 min', cadence: 'Every 2 hrs' },
  { sev: 'P3 Moderate', def: 'A function is impaired for a small group or one user, with a workaround. No effect on patient care.', ex: 'Unit printer down with a backup printer; error for one user', resp: '4 hrs', restore: '1 day', notify: 'Ticket updates only', cadence: 'Daily' },
  { sev: 'P4 Low', def: 'A minor issue, question, or cosmetic defect.', ex: 'How-to question; non-urgent software change', resp: '8 hrs', restore: '3 days', notify: 'Ticket updates only', cadence: 'As needed' },
];

function Severity() {
  return (
    <Visual title="A3. Incident severity definitions (Convene to confirm)" subtitle="Applies to all incidents">
      <div className="tableview plain">
        <table className="grid">
          <thead><tr>{['Severity', 'Definition (clinical and business impact)', 'Examples', 'Response target', 'Restore target', 'Client notification', 'Update cadence'].map((h, i) => <th key={h} className={i < 3 || i > 4 ? 'al-left' : ''}>{h}</th>)}</tr></thead>
          <tbody>
            {SEVERITY.map((s) => (
              <tr key={s.sev}>
                <td className="al-left"><span className={`sev sev-${s.sev.slice(0, 2)}`}>{s.sev}</span></td>
                <td className="al-left wrap-cell">{s.def}</td><td className="al-left wrap-cell muted">{s.ex}</td>
                <td>{s.resp}</td><td>{s.restore}</td><td className="al-left wrap-cell">{s.notify}</td><td className="al-left">{s.cadence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">Rules: when unsure, classify higher. Any risk to patient safety makes an incident at least P2. Security incidents follow the incident response plan and the restricted security pack.</p>
    </Visual>
  );
}

function StatusRules() {
  const rows = [
    { s: 'ok' as const, label: 'Green', perf: 'Meets or beats target.', proj: 'On track for schedule, scope and budget.', act: 'Complete, or on track for the due date.' },
    { s: 'watch' as const, label: 'Amber', perf: 'Misses target but inside the amber band (A2), or meets target with an unfavorable 3-month trend.', proj: 'One dimension at risk; recovery plan agreed.', act: 'At risk of missing the due date; owner has a recovery date.' },
    { s: 'off' as const, label: 'Red', perf: 'Misses target outside the amber band, or misses target three months in a row.', proj: 'Off track with no agreed recovery plan, or blocked by a decision.', act: 'Past due, or blocked.' },
    { s: 'none' as const, label: 'Grey', perf: 'Not measured, or data not received.', proj: 'Not started or on hold.', act: 'Not started.' },
  ];
  return (
    <div className="row cols-7-5">
      <Visual title="A4. Status rules (red, amber, green)" subtitle="Applies to every page · status colors are never set by judgment alone">
        <div className="tableview plain">
          <table className="grid">
            <thead><tr><th className="al-left">Status</th><th className="al-left">Performance metrics</th><th className="al-left">Projects</th><th className="al-left">Actions and commitments</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.label}><td className="al-left"><StatusMark status={r.s} label={r.label} /></td><td className="al-left wrap-cell">{r.perf}</td><td className="al-left wrap-cell">{r.proj}</td><td className="al-left wrap-cell">{r.act}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="footnote">Where the contract defines a different rule, the contract wins; note it on A2. Shapes (circle, triangle, diamond) carry status as well as color.</p>
      </Visual>
      <Visual title="Trend labels" subtitle="MoM and 3-month columns">
        <div className="tableview plain">
          <table className="grid">
            <thead><tr><th className="al-left">Label</th><th className="al-left">Rule</th></tr></thead>
            <tbody>
              <tr><td className="al-left"><span className="trend-tag fav">Favorable</span></td><td className="al-left wrap-cell">Moved toward target by more than 5% of the prior value.</td></tr>
              <tr><td className="al-left"><span className="trend-tag neutral">Stable</span></td><td className="al-left wrap-cell">Moved less than 5% in either direction.</td></tr>
              <tr><td className="al-left"><span className="trend-tag unfav">Unfavorable</span></td><td className="al-left wrap-cell">Moved away from target by more than 5% of the prior value.</td></tr>
              <tr><td className="al-left"><span className="trend-tag neutral">Up / Down</span></td><td className="al-left wrap-cell">Volume measures with no target direction.</td></tr>
            </tbody>
          </table>
        </div>
        <p className="footnote">Availability measures use the change in downtime (the gap to 100%) so small moves still register.</p>
      </Visual>
    </div>
  );
}
