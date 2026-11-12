// Executive Summary (MOR slide 3): five headline KPIs, this month in brief, key points, decisions
// required, since last review, and the measures off target.

import { useMemo } from 'react';
import { fmt, num } from '../format';
import { evaluate, M, SCORECARD_IDS, type Ctx, type MetricValue } from '../metrics';
import { compareMi, useApp, type PageId } from '../state';
import { Chart } from '../ui/Chart';
import { lineOption, SERIES } from '../ui/charts';
import { fm, RagCell, Sparkline, StatusMark, TrendTag } from '../ui/common';
import { Icon } from '../ui/icons';
import { PAGE_BY_ID } from '../ui/Shell';

const HEADLINE = ['uptime_p1', 'svc_levels_met', 'tickets_resolved', 'mi_p1p2', 'open_critical'] as const;

/** Commitments from the last review, tied to the metric that shows the movement. */
const COMMITMENT_METRICS: { id: string; sites?: number[] }[] = [{ id: 'over7' }, { id: 'network', sites: [3] }, { id: 'phish' }, { id: 'vuln_crit' }];

export function Executive() {
  const { ds, ctx, route, set, go } = useApp();
  const ec: Ctx = useMemo(() => ({ ...ctx, sites: [], pri: [], cat: [] }), [ctx]);
  const v = Object.fromEntries(HEADLINE.map((id) => [id, evaluate(ds, id, ec)])) as Record<(typeof HEADLINE)[number], MetricValue>;
  const month = ds.months[route.mi];
  const cmp = ds.months[compareMi(route)];
  const incidents = ds.incidents.filter((i) => i.mi === route.mi);
  const p1 = incidents.filter((i) => i.sev === 'P1').length;
  const resolved12 = evaluate(ds, 'tickets_resolved', ec, 12).trend.map((t) => t.value ?? 0);
  const avg12 = resolved12.reduce((a, b) => a + b, 0) / Math.max(1, resolved12.length);
  const s = ds.security[route.mi];
  const offTarget = SCORECARD_IDS.map((id) => evaluate(ds, id, ec)).filter((x) => x.status === 'off' || x.status === 'watch')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'off' ? -1 : 1));
  const brief = useBrief(ec);

  const cards: { id: (typeof HEADLINE)[number]; label: string; sub: string }[] = [
    { id: 'uptime_p1', label: 'Critical system uptime', sub: `Target ${fm('uptime_p1')(v.uptime_p1.target)} · Prior ${fm('uptime_p1')(v.uptime_p1.prior)}` },
    { id: 'svc_levels_met', label: 'Service levels met', sub: `${Math.round((v.svc_levels_met.value ?? 0) * 12)} of 12 contract SLAs · Prior ${fm('svc_levels_met')(v.svc_levels_met.prior)}` },
    { id: 'tickets_resolved', label: 'Tickets resolved', sub: `Prior ${num(v.tickets_resolved.prior)} · 12-mo avg ${num(avg12)}` },
    { id: 'mi_p1p2', label: 'Major incidents (P1 + P2)', sub: `${p1} P1 · ${incidents.length - p1} P2 · Prior ${num(v.mi_p1p2.prior)}` },
    { id: 'open_critical', label: 'Open critical issues', sub: `Security and compliance · Prior ${num(v.open_critical.prior)}` },
  ];

  return (
    <div className="elt">
      <div className="elt-head">
        <div className="elt-title">
          <span className="elt-kicker">{ds.client} · IT Monthly Operations Review · Managed IT Services</span>
          <h1>Executive Summary: {month.label}</h1>
          <p>{month.label} performance with 12-month trends, compared with {route.compare === 'py' ? 'prior year' : 'prior month'} ({cmp?.short ?? 'n/a'}).</p>
        </div>
        <div className="elt-slicers no-print">
          <label className="elt-slicer"><span>Month</span>
            <select value={route.mi} onChange={(e) => set({ mi: Number(e.target.value) })}>
              {[...ds.months].reverse().map((m) => <option key={m.mi} value={m.mi}>{m.label}</option>)}
            </select>
          </label>
          <label className="elt-slicer"><span>Compare to</span>
            <select value={route.compare} onChange={(e) => set({ compare: e.target.value as 'prior' | 'py' })}>
              <option value="prior">Prior month</option><option value="py">Prior year</option>
            </select>
          </label>
          <button type="button" className="btn" onClick={() => window.print()}><Icon name="print" size={13} /> Print / PDF</button>
        </div>
      </div>

      <div className="elt-kpis">
        {cards.map((c) => {
          const x = v[c.id];
          const f = fm(c.id);
          return (
            <button type="button" key={c.id} className={`elt-kpi st-${x.status}`} onClick={() => go(x.m.page as never)} title={`Open ${PAGE_BY_ID[x.m.page as PageId]?.label ?? x.m.page}`}>
              <span className="elt-kpi-name"><span>{c.label}</span><StatusMark status={x.status} /></span>
              <span className="elt-kpi-mid">
                <span className="elt-kpi-value">{f(x.value)}</span>
                <Sparkline values={x.trend.map((t) => t.value)} target={x.target} status={x.trend.map((t) => t.status)} width={92} height={30} />
              </span>
              <span className="elt-kpi-sub">{c.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="elt-split">
        <section className="elt-card">
          <h2 className="elt-h2">This month in brief</h2>
          <p className="brief">{brief.text}</p>
          <h3 className="elt-h3">Key points</h3>
          <ol className="keypoints">
            {brief.points.map((p) => <li key={p.label}><b>{p.label}:</b> {p.text}</li>)}
          </ol>
        </section>
        <section className="elt-card elt-decisions">
          <h2 className="elt-h2">Decisions required</h2>
          <ul className="decisions">
            {ds.decisions.slice(0, 2).map((d) => (
              <li key={d.decision}><b>{d.decision}</b>, {d.maker}, needed by {d.by}. <span className="muted">Cost of delay: {d.costOfDelay}.</span></li>
            ))}
          </ul>
          <button type="button" className="link" onClick={() => go('projects')}>All decisions and next-month actions ›</button>
        </section>
      </div>

      <div className="elt-split">
        <section className="elt-sec">
          <div className="elt-sec-head"><h2>Since last review</h2><span className="elt-meta">Commitments made at the {ds.months[route.mi - 1]?.label ?? 'last'} review</span></div>
          <div className="elt-table">
            <table>
              <thead><tr><th className="al-left">Commitment</th><th className="al-left">Owner</th><th className="al-left">Status</th><th>Metric movement</th></tr></thead>
              <tbody>
                {ds.sinceLastReview.map((c, i) => {
                  const cm = COMMITMENT_METRICS[i];
                  const x = evaluate(ds, cm.id, { ...ec, sites: cm.sites ?? [] });
                  const f = fm(cm.id);
                  return (
                    <tr key={c.action}>
                      <td className="al-left">{c.action}</td>
                      <td className="al-left muted">{c.owner}</td>
                      <td className="al-left"><RagCell rag={c.status} text={c.statusText} /></td>
                      <td>{M(cm.id).short ?? M(cm.id).name}{cm.sites ? `, ${ds.sites[cm.sites[0]].short}` : ''}: {f(x.prior)} → <b>{f(x.value)}</b> <TrendTag t={x.mom} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section className="elt-sec">
          <div className="elt-sec-head"><h2>Off target this month</h2><span className="elt-meta">{offTarget.filter((x) => x.status === 'off').length} red · {offTarget.filter((x) => x.status === 'watch').length} amber of {SCORECARD_IDS.length} scorecard measures</span></div>
          <div className="elt-table">
            <table>
              <thead><tr><th className="al-left">Measure</th><th>Actual</th><th>Target</th><th className="al-center">Status</th></tr></thead>
              <tbody>
                {offTarget.slice(0, 9).map((x) => (
                  <tr key={x.m.id} className="clickable" onClick={() => go(x.m.page as never)}>
                    <td className="al-left">{x.m.short ?? x.m.name}</td>
                    <td><b>{fm(x.m.id)(x.value)}</b></td>
                    <td className="muted">{fm(x.m.id)(x.target)}</td>
                    <td className="al-center"><StatusMark status={x.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {offTarget.length > 9 && <div className="elt-more"><button type="button" className="link" onClick={() => go('scorecard')}>+{offTarget.length - 9} more in the scorecard ›</button></div>}
          </div>
        </section>
      </div>

      <section className="elt-sec">
        <div className="elt-sec-head"><h2>12-month trends</h2><span className="elt-meta">Click a month to set the reporting period</span></div>
        <div className="elt-trends">
          {(['uptime_p1', 'sla_all', 'mi_p1p2'] as const).map((id) => {
            const x = evaluate(ds, id, ec, 13);
            const f = fm(id);
            return (
              <div className="elt-trend" key={id}>
                <div className="elt-trend-head"><span className="elt-trend-name">{M(id).short ?? M(id).name}</span><span className="elt-trend-kv">Now <b>{f(x.value)}</b> Target <b>{f(x.target)}</b></span></div>
                <Chart height={150} ariaLabel={`${M(id).name} trend`}
                  option={lineOption({ labels: x.trend.map((t) => ds.months[t.mi].short), series: [{ name: M(id).short ?? M(id).name, data: x.trend.map((t) => t.value), color: SERIES[0], type: id === 'mi_p1p2' ? 'bar' : 'line' }], fmt: f, target: x.target, selectedIndex: x.trend.length - 1 })}
                  onClick={(i) => set({ mi: x.trend[i].mi })} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="elt-sec">
        <div className="elt-sec-head"><h2>Meeting agenda</h2><span className="elt-meta">Services in scope for {ds.client}</span></div>
        <div className="agenda">
          {(['executive', 'service-desk', 'clinical', 'incidents', 'security', 'projects'] as const).map((p, i) => (
            <button type="button" key={p} className="agenda-item" onClick={() => go(p === 'executive' ? 'scorecard' : p)}>
              <span className="agenda-num">{i + 1}</span>
              <span>{p === 'executive' ? 'Executive summary and service scorecard' : p === 'clinical' ? 'Clinical applications and infrastructure' : p === 'security' ? 'Security and compliance' : p === 'incidents' ? 'Major incidents' : p === 'projects' ? 'Projects, actions and decisions' : PAGE_BY_ID[p].label}</span>
              <Icon name="chevronRight" size={11} />
            </button>
          ))}
        </div>
        <p className="elt-foot">Security incidents this month: {s ? s.incLow + s.incMed + s.incHigh : '–'} · Open critical vulnerabilities: {s?.vulnC ?? '–'} · PHI exposure events: {s?.phiEvents ?? '–'}. All figures are mock data.</p>
      </section>
    </div>
  );
}

/** Narrative written from the numbers, the way you would say it in the hallway. */
function useBrief(ec: Ctx) {
  const { ds, route } = useApp();
  const mi = route.mi;
  const ehr = evaluate(ds, 'ehr_avail', ec);
  const sla = evaluate(ds, 'sla_all', ec);
  const inc = ds.incidents.filter((i) => i.mi === mi);
  const p1 = inc.filter((i) => i.sev === 'P1');
  const opened = evaluate(ds, 'tickets_opened', ec);
  const phish = evaluate(ds, 'phish', ec);
  const crit = evaluate(ds, 'vuln_crit', ec);
  const storage = evaluate(ds, 'storage', ec);
  const chg = opened.value !== null && opened.prior ? opened.value / opened.prior - 1 : null;
  const first = p1[0];
  const text = [
    `IT ${sla.status === 'ok' ? 'met' : 'came close to'} its service levels in ${ds.months[mi].label}: ${fmt(sla.value, 'pct')} of tickets were resolved within SLA against a ${fmt(sla.target, 'pct', 0)} target, on ${num(opened.value)} tickets opened${chg !== null ? ` (${chg >= 0 ? 'up' : 'down'} ${fmt(Math.abs(chg), 'pct', 0)} on last month)` : ''}.`,
    first ? `The event leaders should know about is the ${first.opened} ${first.system} outage: ${first.durationHrs.toFixed(1)} hours, ${first.impact.charAt(0).toLowerCase()}${first.impact.slice(1)}. ${first.rcStatus === 'Under review' ? 'Root cause is under review; the fix is scheduled for ' + first.due + '.' : 'The root cause is confirmed and the fix is in place.'}`
      : `There were no P1 incidents; ${inc.length} P2 incident${inc.length === 1 ? '' : 's'} ${inc.length === 1 ? 'was' : 'were'} resolved.`,
    `EHR availability was ${fm('ehr_avail')(ehr.value)} against ${fm('ehr_avail')(ehr.target)}.`,
  ].join(' ');
  const sd = ds.sites.map((s) => ({ s, v: evaluate(ds, 'tickets_opened', { ...ec, sites: [s.key] }) })).sort((a, b) => ((b.v.change ?? 0) - (a.v.change ?? 0)))[0];
  const points = [
    { label: 'Biggest issue', text: first ? `${first.system} P1 on ${first.opened} (${first.durationHrs.toFixed(1)} hrs, all sites on downtime procedures). ${first.action}; ${first.owner}, due ${first.due}.` : `${inc.length} P2 incidents; corrective actions tracked on the Major Incidents page.` },
    { label: 'Biggest improvement', text: `Critical vulnerabilities down to ${num(crit.value)} from ${num(crit.threeAgo)} three months ago; mean time to patch critical CVEs is ${fm('mttp')(evaluate(ds, 'mttp', ec).value)} against a 7-day target.` },
    { label: 'Emerging risk', text: `Storage peaked at ${fm('storage')(storage.value)} of capacity (amber at 80%, red at 90%) and the phishing click rate is ${fm('phish')(phish.value)} against a 5% target. Ticket demand at ${sd.s.short} rose by ${num(sd.v.change)} tickets. Convene is acting on all three (see next-month actions).` },
  ];
  return { text, points };
}
