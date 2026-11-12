# IT Operations Analytics: MOR dashboard (prototype)

An interactive dashboard for the **IT Monthly Operations Review (MOR)** of a managed IT services
client (a hospital or health system). It turns the Convene IT MOR template into a working analytics
product with the same layout and interaction model as the RCM analytics prototype: dark header,
page tabs, a filter pane, KPI cards with target, status and trend, charts you can click to filter,
dense analytical tables, a decomposition tree and "what leadership should know" commentary.

**All data is mock.** "Sample Health System", Hospitals A to E, the clinics, the systems, the people
(shown as roles) and every figure are fictional and not tied to any real hospital, health system,
vendor or person.

## Run

Requires Node.js 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload. |
| `npm run build` | Typecheck and production build to `dist/`. |
| `npm run preview` | Serve the production build locally. |

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on pushes to `main` (turn on Pages
with "GitHub Actions" as the source in the repository settings).

## Pages and how they map to the MOR template

| Tab | MOR slides | What it shows |
|---|---|---|
| Executive Summary | 3 (and agenda, 2) | Five headline KPIs (critical system uptime, service levels met, tickets resolved, P1+P2 incidents, open critical issues), this month in brief, key points, decisions required, since last review, measures off target, 12-month trends |
| Service Scorecard | 4-5 | Every KPI with target, prior, current, vs target, status, MoM and 3-month trend, months met (12), 13-month sparkline; filter by area or off-target only |
| Service Desk | 6-7 | Volume by priority, throughput, backlog by age, tickets by site / category / priority (click to filter), site table, SLA and response/resolve times by priority, recurring categories with root cause and fix, decomposition tree |
| Clinical Apps | 8 | EHR and clinical system availability by tier, unplanned/planned downtime, interface errors, system detail |
| Infrastructure | 9 | Uptime by tier, scheduled vs unscheduled downtime, backup, patching, change, capacity, certificate and end-of-life watch |
| Major Incidents | 10, A5 | P1/P2 counts, clinical downtime, response within SLA, corrective actions, full incident log with detail |
| Security | 11 | Incidents, vulnerabilities by severity and age, PHI events, phishing, failed logins, protection coverage table |
| Sites | Tear sheet | Per-site tear sheet vs target, prior and all sites, 12-month trends, other measures, recommended actions, site comparison |
| Projects & Actions | 12-13 | Project portfolio with schedule / scope / budget / overall status, next-month actions, decisions required, next review |
| SLAs & Definitions | A1-A4 | Contract service levels and credits, metric definitions, incident severity, status rules |

## How it works

- **Filters** (left pane): reporting month, compare to prior month or prior year, site, priority and
  ticket category. Clicking a bar or table row toggles the matching filter; chips under the page title
  show what is applied. Everything is stored in the URL, so a copied link reopens the same view.
- **Status rules** follow MOR appendix A4: green meets target; amber is inside the amber band, or meets
  target with an unfavorable 3-month trend while close to target; red is outside the amber band or
  missed three months in a row; grey has no target. Status is shown by shape as well as color.
- **Targets** are the Convene defaults from the template and are marked "confirm per contract".
- Every chart and table can be shown as a table, exported to CSV, or opened in focus mode. Pages print
  cleanly to PDF.

## Code map

| Path | Purpose |
|---|---|
| `src/data/model.ts` | The `Dataset` shape every page reads. |
| `src/data/generate.ts` | Mock data generator (fixed seed; same numbers every load). |
| `src/metrics.ts` | Metric catalog (definition, target, amber band, source, owner, compute) and the status / trend engine. |
| `src/state.tsx` | Route, period and filters (in the URL hash). |
| `src/ui/` | Shell (header, tabs, filter pane), KPI cards, charts (ECharts), grid, decomposition tree. |
| `src/pages/` | One file per tab. |

### Connecting real data

Replace `generateDataset()` in `src/App.tsx` with a loader that builds the same `Dataset` from the
source systems named in the metric dictionary (IT service management tool, phone system, monitoring,
backup console, patch and vulnerability tools, SIEM, project register). The metric definitions,
status rules and pages do not need to change.
