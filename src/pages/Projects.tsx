// Projects and Initiatives (MOR slide 12) and Focus Areas, Actions and Decisions (slide 13).

import type { Project, Rag } from '../data/model';
import { fmt, pct } from '../format';
import { useApp } from '../state';
import { RagCell, SectionHead } from '../ui/common';
import { Grid, gridExport, type Col } from '../ui/Grid';
import { CanvasHeader } from '../ui/Shell';
import { Visual } from '../ui/Visual';

const PHASES: Project['phase'][] = ['Initiate', 'Plan', 'Build', 'Test', 'Go-live', 'Stabilize'];

export function Projects() {
  const { ds } = useApp();
  const counts = (r: Rag) => ds.projects.filter((p) => p.overall === r).length;
  const cols: Col<Project>[] = [
    { key: 'name', label: 'Project: expected outcome', width: 220, wrap: true, value: (r) => r.name, render: (r) => <span><b>{r.name}</b>: <span className="muted">{r.outcome}</span></span>, exportText: (r) => `${r.name}: ${r.outcome}` },
    { key: 'sponsor', label: 'Sponsor', align: 'left', value: (r) => r.sponsor, wrap: true },
    { key: 'phase', label: 'Phase', align: 'left', value: (r) => PHASES.indexOf(r.phase), render: (r) => <PhaseBar phase={r.phase} />, exportText: (r) => r.phase },
    { key: 'schedule', label: 'Schedule', align: 'left', value: (r) => r.schedule, render: (r) => <RagCell rag={r.schedule} /> },
    { key: 'scope', label: 'Scope', align: 'left', value: (r) => r.scope, render: (r) => <RagCell rag={r.scope} /> },
    { key: 'budget', label: 'Budget', align: 'left', value: (r) => r.budget, render: (r) => <span title={`${fmt(r.spentUsd, 'usd')} spent of ${fmt(r.budgetUsd, 'usd')}`}><RagCell rag={r.budget} text={`${pct(r.spentUsd / r.budgetUsd, 0)} spent`} /></span>, exportText: (r) => r.budget },
    { key: 'overall', label: 'Overall', align: 'left', value: (r) => r.overall, render: (r) => <b><RagCell rag={r.overall} /></b> },
    { key: 'ms', label: 'Next milestone (date)', align: 'left', value: (r) => r.milestone, render: (r) => `${r.milestone} (${r.milestoneDate})`, wrap: true },
    { key: 'blocker', label: 'Decision or blocker', align: 'left', wrap: true, value: (r) => r.blocker, render: (r) => (r.blocker === 'None' ? <span className="muted">None</span> : <span className={r.overall === 'R' ? 'txt-off' : ''}>{r.blocker}</span>) },
  ];
  const g = ds.projects.map((p) => ({ id: p.name, data: p }));
  return (
    <div className="page">
      <CanvasHeader right={<div className="score-summary"><RagCell rag="G" text={`${counts('G')} on track`} /><RagCell rag="A" text={`${counts('A')} at risk`} /><RagCell rag="R" text={`${counts('R')} off track`} /></div>} />
      <SectionHead title="Projects and initiatives" note="Slide 12: overall is the worst of schedule, scope and budget unless the project lead explains" />
      <Visual title="Project portfolio" subtitle="Status: on track (green), at risk (amber), off track (red) · phases: Initiate, Plan, Build, Test, Go-live, Stabilize" table={gridExport(cols, g)}>
        <Grid caption="Projects" columns={cols} rows={g} />
      </Visual>
      <div className="completed"><b>Completed this month:</b> {ds.completedThisMonth.join(' · ')}</div>

      <SectionHead title="Focus areas, actions and decisions" note="Slide 13" />
      <div className="row cols-2">
        <section className="visual">
          <div className="visual-head"><div className="visual-titles"><h3>Priority actions for next month</h3></div></div>
          <div className="visual-body">
            <ol className="actions">
              {ds.nextActions.map((a, i) => (
                <li key={a.action}>
                  <span className="action-num">{i + 1}</span>
                  <div>
                    <div className="action-title">{a.action}</div>
                    <div className="action-meta">Owner: {a.owner} · Due: {a.due} · Measure: {a.measure} <span className="tag-area">{a.area}</span></div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section className="visual">
          <div className="visual-head"><div className="visual-titles"><h3>Decisions required from {ds.client}</h3></div></div>
          <div className="visual-body">
            <ol className="decision-list">
              {ds.decisions.map((d) => (
                <li key={d.decision}>
                  <b>{d.decision}.</b> Options: {d.options}. Convene recommends {d.recommend} because {d.reason}.
                  <div className="action-meta">Decision maker: {d.maker} · Needed by {d.by} · Cost of delay: {d.costOfDelay}.</div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
      <div className="next-review">
        <b>Next review:</b> {ds.nextReview.when} · <b>Pre-read sent:</b> {ds.nextReview.preRead} · <b>Distribution:</b> {ds.nextReview.distribution}
      </div>
    </div>
  );
}

function PhaseBar({ phase }: { phase: Project['phase'] }) {
  const k = PHASES.indexOf(phase);
  return (
    <span className="phasebar" title={phase}>
      {PHASES.map((p, i) => <i key={p} className={i < k ? 'done' : i === k ? 'cur' : ''} />)}
      <span>{phase}</span>
    </span>
  );
}
