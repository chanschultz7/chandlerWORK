// Synthetic MOR dataset. Fixed seed: the same numbers on every load.
//
// ALL DATA IS MOCK. The health system, sites, systems, people and figures are placeholders and are
// not tied to any real hospital, health system, vendor or person. Owners are shown as roles.
//
// The generator plants a story for the latest month (October 2026) so every page has something to
// say: an EHR P1 outage at Hospital A, a printing spike at Hospital B after a print-server
// migration, backup failures at Hospital C, a phishing click rate above target, and a certificate
// inside 14 days.

import type {
  Category, ClinicalSystem, Dataset, Incident, InfraMonth, Month, Pri, SecMonth, Site, SiteMonth, SystemMonth, TicketFact,
} from './model';
import { PRIORITIES } from './model';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const N_MONTHS = 18;
const START_YEAR = 2025;
const START_MONTH = 4; // May 2025 (0-based)

function buildMonths(): Month[] {
  return Array.from({ length: N_MONTHS }, (_, mi) => {
    const abs = START_YEAR * 12 + START_MONTH + mi;
    const year = Math.floor(abs / 12);
    const month = abs % 12;
    const days = new Date(year, month + 1, 0).getDate();
    return { mi, key: `${year}-${String(month + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[month]} ${year}`, short: `${MONTH_NAMES[month].slice(0, 3)} ${String(year).slice(2)}`, year, month, days };
  });
}

const SITES: Site[] = [
  { key: 0, code: 'HA', name: 'Hospital A (Main Campus)', short: 'Hospital A', beds: 420, users: 4800, devices: 6100, lead: 'Site IT Lead, Hospital A', ehr: 'EHR (enterprise instance)', weight: 0.41 },
  { key: 1, code: 'HB', name: 'Hospital B', short: 'Hospital B', beds: 190, users: 1900, devices: 2450, lead: 'Site IT Lead, Hospital B', ehr: 'EHR (enterprise instance)', weight: 0.18 },
  { key: 2, code: 'HC', name: 'Hospital C', short: 'Hospital C', beds: 130, users: 1300, devices: 1700, lead: 'Site IT Lead, Hospital C', ehr: 'EHR (enterprise instance)', weight: 0.13 },
  { key: 3, code: 'HD', name: 'Hospital D', short: 'Hospital D', beds: 90, users: 850, devices: 1150, lead: 'Site IT Lead, Hospital D', ehr: 'EHR (enterprise instance)', weight: 0.09 },
  { key: 4, code: 'HE', name: 'Hospital E (Critical Access)', short: 'Hospital E', beds: 25, users: 310, devices: 420, lead: 'Site IT Lead, Hospital E', ehr: 'EHR (enterprise instance)', weight: 0.05 },
  { key: 5, code: 'AC', name: 'Ambulatory Clinics (12 locations)', short: 'Clinics', beds: 0, users: 1350, devices: 1900, lead: 'Site IT Lead, Clinics', ehr: 'EHR (ambulatory)', weight: 0.14 },
];

const CATEGORIES: Category[] = [
  { key: 0, name: 'Password and account access', rootCause: 'Password expiry every 90 days; self-service reset adoption at 41%', fix: 'Promote self-service reset at sign-in; Service Desk Manager; Dec 15' },
  { key: 1, name: 'EHR access and workflow', rootCause: 'New-hire role templates missing two security classes', fix: 'Correct role templates with HR feed; Clinical Apps Lead; Nov 30' },
  { key: 2, name: 'Printing', rootCause: 'Print-server migration at Hospital B left 140 queues mapped to the old server', fix: 'Remap queues by GPO and retire old server; Infrastructure Lead; Nov 20' },
  { key: 3, name: 'Workstation and hardware', rootCause: 'Aging thin clients in nursing units (5+ years)', fix: 'Replace 220 units under refresh project; Field Services Lead; Jan 31' },
  { key: 4, name: 'Single sign-on and badge tap', rootCause: 'Badge reader firmware drift after Windows update', fix: 'Pin firmware version and add to patch baseline; Endpoint Lead; Nov 25' },
  { key: 5, name: 'Network and Wi-Fi', rootCause: 'Coverage gaps on two inpatient floors after renovation', fix: 'Add four access points; Network Lead; Dec 10' },
  { key: 6, name: 'Email and calendar', rootCause: 'Mailbox quota warnings after retention change', fix: 'Raise quota for clinical managers; Messaging Lead; Nov 18' },
  { key: 7, name: 'Software install and request', rootCause: 'Manual approval step for standard software', fix: 'Pre-approve 30 standard titles in the catalog; Service Desk Manager; Dec 31' },
  { key: 8, name: 'Clinical device integration', rootCause: 'Vitals monitors dropping interface after network change', fix: 'Vendor patch scheduled; Clinical Apps Lead; Dec 5' },
  { key: 9, name: 'Telephony and mobile', rootCause: 'Unit phone battery wear', fix: 'Battery swap program; Field Services Lead; Dec 20' },
];
const CAT_MIX = [0.21, 0.15, 0.1, 0.12, 0.08, 0.07, 0.07, 0.1, 0.05, 0.05];

const SYSTEMS: ClinicalSystem[] = [
  { key: 0, name: 'EHR', tier: 'P1', owner: 'Clinical Apps Lead' },
  { key: 1, name: 'PACS and imaging', tier: 'P1', owner: 'Imaging Systems Lead' },
  { key: 2, name: 'Laboratory system (LIS)', tier: 'P1', owner: 'Clinical Apps Lead' },
  { key: 3, name: 'Pharmacy and dispensing', tier: 'P1', owner: 'Clinical Apps Lead' },
  { key: 4, name: 'Interface engine', tier: 'P1', owner: 'Integration Lead' },
  { key: 5, name: 'Anesthesia documentation', tier: 'General', owner: 'Clinical Apps Lead' },
  { key: 6, name: 'Patient monitoring integration', tier: 'General', owner: 'Integration Lead' },
  { key: 7, name: 'Document imaging', tier: 'General', owner: 'Clinical Apps Lead' },
];
const SYS_ISSUES = [
  ['Slow chart open at shift change', 'Storage controller failover (P1)', 'Print-to-label delays'],
  ['Prior study retrieval lag', 'Viewer timeout on large studies', 'Worklist refresh delay'],
  ['Analyzer interface queue', 'Label printer mapping', 'Result routing rule'],
  ['Cabinet sync delay', 'Override report access', 'Formulary update lag'],
  ['ADT queue backlog', 'Lab results queue stop (P2)', 'Certificate renewal'],
  ['Device time drift', 'Case record lock', 'Login delay'],
  ['Monitor association drops', 'Vitals interface lag', 'Gateway restart'],
  ['Scanner driver', 'Batch index delay', 'Search slowness'],
];

const PRI_MIX: Record<Pri, number> = { P1: 0.0016, P2: 0.028, P3: 0.46, P4: 0.21, SR: 0.3004 };
const RESP_TARGET_MIN: Record<Pri, number> = { P1: 15, P2: 30, P3: 240, P4: 480, SR: 480 };
const RESOLVE_TARGET_HRS: Record<Pri, number> = { P1: 4, P2: 8, P3: 24, P4: 72, SR: 72 };
export const SLA_TARGET: Record<Pri, number> = { P1: 1, P2: 0.98, P3: 0.95, P4: 0.95, SR: 0.95 };
export { RESP_TARGET_MIN, RESOLVE_TARGET_HRS };

export function generateDataset(): Dataset {
  const rnd = mulberry32(20261031);
  const noise = (amp: number) => 1 + (rnd() * 2 - 1) * amp;
  const months = buildMonths();
  const cur = N_MONTHS - 1;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // ---------------------------------------------------------------- tickets
  const tickets: TicketFact[] = [];
  const siteMonths: SiteMonth[] = [];
  for (const m of months) {
    const t = m.mi / (N_MONTHS - 1); // 0..1 over the window
    const season = 1 + 0.06 * Math.sin(((m.month + 1) / 12) * Math.PI * 2) + (m.month === 7 ? 0.05 : 0); // August new-resident bump
    const base = 3300 * (1 + 0.04 * t) * season;
    for (const s of SITES) {
      let siteOpened = 0;
      let siteResolved = 0;
      for (const pri of PRIORITIES) {
        for (const c of CATEGORIES) {
          let mult = 1;
          if (c.key === 2 && s.key === 1 && m.mi === cur) mult = 3.4; // printing spike at Hospital B
          if (c.key === 2 && s.key === 1 && m.mi === cur - 1) mult = 1.3;
          if (c.key === 0) mult *= 1.06 - 0.12 * t; // self-service reset slowly working
          if (c.key === 1 && m.mi === cur) mult *= 1.12;
          const exp = base * s.weight * PRI_MIX[pri] * CAT_MIX[c.key] * mult * noise(0.12);
          const opened = pri === 'P1' ? (rnd() < exp ? 1 : 0) : Math.round(exp + (rnd() - 0.5));
          if (opened <= 0) continue;
          const resolved = Math.max(0, Math.round(opened * (0.985 + rnd() * 0.03)));
          // SLA rate: near target, planted misses.
          let rate = SLA_TARGET[pri] + 0.02 - rnd() * 0.026;
          if (pri === 'P1') rate = 1;
          if (pri === 'P2' && m.mi === cur) rate = 0.955 - rnd() * 0.02;
          if (s.key === 1 && m.mi === cur && (pri === 'P3' || pri === 'P4')) rate -= 0.055;
          if (m.mi < 6) rate -= 0.012;
          let slaMet = 0;
          const pr = clamp(rate, 0.7, 1);
          for (let k = 0; k < resolved; k++) if (rnd() < pr) slaMet++;
          const respAvg = RESP_TARGET_MIN[pri] * (0.55 + rnd() * 0.35) * (s.key === 1 && m.mi === cur ? 1.3 : 1);
          const resAvg = RESOLVE_TARGET_HRS[pri] * (0.45 + rnd() * 0.35) * (s.key === 1 && m.mi === cur ? 1.25 : 1);
          tickets.push({ mi: m.mi, site: s.key, pri, cat: c.key, opened, resolved, slaMet, respMinSum: respAvg * resolved, resolveHrsSum: resAvg * resolved });
          siteOpened += opened;
          siteResolved += resolved;
        }
      }
      const calls = Math.round(siteOpened * 0.62 * noise(0.05));
      const abandonRate = clamp(0.042 + (rnd() - 0.5) * 0.02 + (m.mi === cur && s.key === 1 ? 0.03 : 0) + (m.month === 7 ? 0.012 : 0), 0.01, 0.2);
      const abandoned = Math.round(calls * abandonRate);
      const asa = 21 + rnd() * 9 + (m.month === 7 ? 9 : 0) + (m.mi === cur && s.key === 1 ? 14 : 0);
      const backlogOpen = Math.round(siteOpened * (0.085 + rnd() * 0.02) * (m.mi === cur && s.key === 1 ? 1.5 : 1));
      const over7 = Math.round(backlogOpen * (0.16 + rnd() * 0.06 - 0.04 * t));
      const fcrEligible = Math.round(siteOpened * 0.7);
      const fcrRate = clamp(0.735 + 0.03 * t + (rnd() - 0.5) * 0.03 - (m.mi === cur && s.key === 1 ? 0.05 : 0), 0.5, 0.95);
      const csatN = Math.round(siteResolved * 0.14);
      const csat = clamp(4.5 + (rnd() - 0.5) * 0.24 + 0.05 * t - (m.mi === cur && s.key === 1 ? 0.28 : 0), 3, 5);
      const totMin = m.days * 24 * 60;
      let netDown = rnd() * 20 + (s.key === 4 ? 25 : 0);
      if (m.mi === cur && s.key === 0) netDown += 22;
      if (m.mi === cur - 4 && s.key === 3) netDown += 95; // carrier fiber cut
      const patchDevices = s.devices;
      const patch30 = Math.round(patchDevices * clamp(0.9 + 0.055 * t + (rnd() - 0.5) * 0.02, 0.8, 0.995));
      const critDevices = s.devices;
      const crit7 = Math.round(critDevices * clamp(0.93 + 0.06 * t + (rnd() - 0.5) * 0.015 - (s.key === 2 && m.mi === cur ? 0.02 : 0), 0.85, 1));
      siteMonths.push({
        mi: m.mi, site: s.key,
        fcrFirst: Math.round(fcrEligible * fcrRate), fcrEligible,
        callsOffered: calls, callsAnswered: calls - abandoned, asaSecSum: asa * (calls - abandoned), callsAbandoned: abandoned,
        backlogOpen, backlogOver7: over7,
        reopened: Math.round(siteResolved * clamp(0.034 + (rnd() - 0.5) * 0.014 + (m.mi === cur && s.key === 1 ? 0.025 : 0), 0.005, 0.2)),
        csatSum: csat * csatN, csatN,
        netUpMin: totMin - netDown, netTotMin: totMin,
        patchDevices, patch30, critDevices, crit7,
        eolDevices: Math.round(s.devices * (0.06 - 0.025 * t) * noise(0.1)),
        openCritVulns: Math.round((s.weight * 30) * (1.1 - 0.5 * t) * noise(0.25)),
        assetAccuracy: clamp(0.955 + 0.025 * t + (rnd() - 0.5) * 0.01, 0.9, 0.995),
        failoverTested: s.key !== 4 || m.mi < cur - 2,
      });
    }
  }

  // ---------------------------------------------------------------- clinical systems
  const systemMonths: SystemMonth[] = [];
  for (const m of months) {
    for (const sys of SYSTEMS) {
      const totalMin = m.days * 24 * 60;
      let unplanned = rnd() < 0.55 ? Math.round(rnd() * (sys.tier === 'P1' ? 14 : 60)) : 0;
      if (sys.key === 0 && m.mi === cur) unplanned = 192; // EHR P1, 3.2 h
      if (sys.key === 0 && m.mi === cur - 7) unplanned = 64;
      if (sys.key === 4 && m.mi === cur) unplanned = 48; // lab results queue stop (P2)
      if (sys.key === 1 && m.mi === cur - 2) unplanned = 71;
      if (sys.key === 6 && m.mi === cur) unplanned = 260;
      const windows = sys.key === 0 ? 1 + (m.month % 3 === 0 ? 1 : 0) : rnd() < 0.5 ? 1 : 0;
      const issueIx = sys.key === 0 && m.mi === cur ? 1 : sys.key === 4 && m.mi === cur ? 1 : Math.floor(rnd() * 3) === 1 ? 2 : 0;
      systemMonths.push({
        mi: m.mi, sys: sys.key, totalMin, unplannedMin: unplanned,
        plannedHrs: Math.round(windows * (1.5 + rnd() * 2.5) * 10) / 10, plannedWindows: windows,
        tickets: Math.round((sys.key === 0 ? 480 : 40 + rnd() * 80) * noise(0.15) * (sys.key === 0 && m.mi === cur ? 1.25 : 1)),
        topIssue: SYS_ISSUES[sys.key][issueIx],
        interfaceErrors: sys.key === 4 || sys.key === 2 || sys.key === 6 ? Math.round((12 + rnd() * 20) * (m.mi === cur ? 1.8 : 1)) : 0,
        interfaceDelays: sys.key === 4 || sys.key === 6 ? Math.round(rnd() * 4 + (m.mi === cur ? 3 : 0)) : 0,
      });
    }
  }

  // ---------------------------------------------------------------- infrastructure
  const infra: InfraMonth[] = months.map((m) => {
    const t = m.mi / (N_MONTHS - 1);
    const jobs = 2400 + Math.round(rnd() * 200);
    const failed = m.mi === cur ? 9 : rnd() < 0.65 ? 0 : 1 + Math.floor(rnd() * 2);
    return {
      mi: m.mi,
      wan: clamp(0.9993 + rnd() * 0.0007 - (m.mi === cur - 4 ? 0.0021 : 0), 0.99, 1),
      server: clamp(0.9991 + rnd() * 0.0009 - (m.mi === cur ? 0.0012 : 0), 0.99, 1),
      email: clamp(0.9994 + rnd() * 0.0006, 0.99, 1),
      schedHrs: Math.round((6 + rnd() * 6) * 10) / 10,
      unschedHrs: Math.round(((m.mi === cur ? 4.1 : m.mi === cur - 4 ? 2.6 : 0.4 + rnd() * 1.4)) * 10) / 10,
      backupJobs: jobs, backupFailed: failed, backupRerunOk: m.mi === cur ? 7 : failed,
      storagePeak: clamp(0.71 + 0.13 * t + (rnd() - 0.5) * 0.02, 0.5, 0.97),
      bandwidthPeak: clamp(0.58 + 0.12 * t + (rnd() - 0.5) * 0.06, 0.3, 0.97),
      cpuPeak: clamp(0.62 + (rnd() - 0.5) * 0.1, 0.3, 0.97),
      memPeak: clamp(0.7 + 0.06 * t + (rnd() - 0.5) * 0.06, 0.3, 0.97),
      certs60: m.mi === cur ? 4 : Math.round(rnd() * 3),
      certs14: m.mi === cur ? 1 : 0,
      chgStd: Math.round(150 + rnd() * 40), chgNormal: Math.round(38 + rnd() * 14), chgEmerg: m.mi === cur ? 7 : Math.round(1 + rnd() * 3),
      chgFailed: m.mi === cur ? 4 : Math.round(rnd() * 3),
    };
  });

  // ---------------------------------------------------------------- security
  const security: SecMonth[] = months.map((m) => {
    const t = m.mi / (N_MONTHS - 1);
    const delivered = 5200 + Math.round(rnd() * 400);
    const clickRate = m.mi === cur ? 0.061 : clamp(0.068 - 0.03 * t + (rnd() - 0.5) * 0.01, 0.02, 0.12);
    const vulnC = Math.max(0, Math.round((26 - 18 * t) * noise(0.2)));
    const vulnH = Math.round((210 - 90 * t) * noise(0.1));
    const vulnM = Math.round((880 - 200 * t) * noise(0.06));
    const vulnL = Math.round((1500 - 150 * t) * noise(0.05));
    const split = (n: number, w: number[]) => { const a = w.map((x) => Math.round(n * x)); a[a.length - 1] = n - a.slice(0, -1).reduce((p, q) => p + q, 0); return a; };
    return {
      mi: m.mi,
      incLow: Math.round(9 + rnd() * 6), incMed: Math.round(2 + rnd() * 3), incHigh: m.mi === cur ? 1 : rnd() < 0.2 ? 1 : 0, incOpen: m.mi === cur ? 3 : Math.round(rnd() * 2),
      phishDelivered: delivered, phishClicks: Math.round(delivered * clickRate),
      vulnC, vulnH, vulnM, vulnL,
      vulnAge: [split(vulnC, [0.5, 0.3, 0.15, 0.05]), split(vulnH, [0.3, 0.35, 0.22, 0.13]), split(vulnM, [0.18, 0.3, 0.3, 0.22]), split(vulnL, [0.12, 0.22, 0.3, 0.36])],
      mttpCrit: Math.round(clamp(9.5 - 4.5 * t + (rnd() - 0.5) * 1.2, 2, 20) * 10) / 10,
      endpointCov: clamp(0.982 + 0.014 * t + (rnd() - 0.5) * 0.004, 0.9, 1),
      mfaCov: clamp(0.93 + 0.06 * t, 0.85, 1),
      encryption: clamp(0.975 + 0.02 * t, 0.9, 1),
      training: clamp(0.86 + 0.08 * t + (rnd() - 0.5) * 0.02, 0.7, 1),
      adminReview: m.month % 3 === 2 ? 1 : clamp(0.82 + rnd() * 0.15, 0.6, 1),
      failedLogins: Math.round(18000 + rnd() * 3000 + (m.mi === cur ? 9400 : 0)),
      lockouts: Math.round(620 + rnd() * 120 + (m.mi === cur ? 310 : 0)),
      phiEvents: m.mi === cur - 5 ? 1 : 0,
      patchExceptions: Math.round(140 - 30 * t + rnd() * 10),
    };
  });

  // ---------------------------------------------------------------- major incidents
  const incidents: Incident[] = [];
  const add = (mi: number, day: number, sev: 'P1' | 'P2', system: string, sites: number[], hrs: number, x: Partial<Incident>) => {
    const m = months[mi];
    const id = `INC-${m.year % 100}${String(m.month + 1).padStart(2, '0')}-${String(incidents.filter((i) => i.mi === mi).length + 1).padStart(2, '0')}`;
    incidents.push({
      id, mi, day, opened: `${MONTH_NAMES[m.month].slice(0, 3)} ${day}, ${m.year}`, system, sites, sev,
      durationHrs: hrs, clinicalDowntimeHrs: x.clinicalDowntimeHrs ?? (sev === 'P1' ? hrs : 0),
      responseMin: x.responseMin ?? (sev === 'P1' ? 8 + Math.round(rnd() * 6) : 14 + Math.round(rnd() * 14)),
      withinSla: x.withinSla ?? true,
      impact: x.impact ?? 'Users at the affected sites worked from cached data; no downtime procedures needed',
      resolution: x.resolution ?? 'Service restarted and validated with clinical super-users',
      rootCause: x.rootCause ?? 'Configuration drift after a scheduled change',
      rcStatus: x.rcStatus ?? 'Confirmed',
      action: x.action ?? 'Add configuration check to the change template',
      owner: x.owner ?? 'Infrastructure Lead',
      due: x.due ?? `${MONTH_NAMES[(m.month + 1) % 12].slice(0, 3)} 15`,
      actionStatus: x.actionStatus ?? 'Closed',
      downtimeProcedures: x.downtimeProcedures ?? sev === 'P1',
    });
  };
  const SYS_POOL = ['PACS and imaging', 'Interface engine', 'Laboratory system (LIS)', 'Network: site link', 'Email', 'Pharmacy and dispensing', 'Single sign-on', 'Wi-Fi: inpatient floors', 'Telephony'];
  for (let mi = 0; mi < cur; mi++) {
    const nP2 = Math.round(1 + rnd() * 2.4 - (mi / cur) * 0.8);
    for (let k = 0; k < nP2; k++) {
      const sys = SYS_POOL[Math.floor(rnd() * SYS_POOL.length)];
      const site = Math.floor(rnd() * 6);
      add(mi, 2 + Math.floor(rnd() * 26), 'P2', sys, [site], Math.round((0.6 + rnd() * 3) * 10) / 10, {
        withinSla: rnd() > 0.12,
        impact: `One department at ${SITES[site].short} slowed; workaround in place`,
        actionStatus: mi >= cur - 2 && k === 0 ? 'Open' : 'Closed',
      });
    }
    if (mi === cur - 7) {
      add(mi, 11, 'P1', 'EHR', [0, 1, 2, 3, 4, 5], 1.1, { impact: 'All sites on downtime procedures for 66 min', resolution: 'Failed application node removed from pool', rootCause: 'Memory leak in vendor patch', action: 'Apply vendor hotfix; add memory alerting', owner: 'Clinical Apps Lead' });
    }
    if (mi === cur - 4) {
      add(mi, 19, 'P1', 'Network: site link', [3], 2.6, { impact: 'Hospital D offline from enterprise apps; ED on downtime procedures', resolution: 'Traffic moved to backup carrier link', rootCause: 'Carrier fiber cut; backup link failover was manual', action: 'Automate WAN failover at Hospital D', owner: 'Network Lead', actionStatus: 'Open', due: 'Nov 30', responseMin: 11 });
    }
  }
  // Current month, written out.
  add(cur, 14, 'P1', 'EHR', [0, 1, 2, 3, 4, 5], 3.2, {
    clinicalDowntimeHrs: 3.2, responseMin: 9, withinSla: true,
    impact: 'All inpatient units and EDs on downtime procedures for 3.2 hrs; 41 elective cases delayed at Hospital A',
    resolution: 'Storage array failed over to the secondary controller; EHR restarted and validated',
    rootCause: 'Storage controller firmware defect; failover did not trigger automatically', rcStatus: 'Under review',
    action: 'Apply firmware fix; test controller failover quarterly', owner: 'Infrastructure Lead', due: 'Nov 22', actionStatus: 'Open',
  });
  add(cur, 6, 'P2', 'Interface engine', [0, 1, 2, 3, 4], 0.8, {
    impact: 'Lab results stopped reaching the EHR for 48 min; results phoned to units', resolution: 'Interface queue restarted; backlog replayed',
    rootCause: 'Expired certificate on the lab interface', action: 'Add interface certificates to the 60-day watch', owner: 'Integration Lead', due: 'Oct 31', actionStatus: 'Closed', responseMin: 12,
  });
  add(cur, 21, 'P2', 'Printing', [1], 5.5, {
    withinSla: false, responseMin: 34,
    impact: 'Label and wristband printing failed on 6 units at Hospital B; hand labels used',
    resolution: 'Queues remapped to the new print server', rootCause: 'Print-server migration missed 140 queues', rcStatus: 'Confirmed',
    action: 'Remap remaining queues; add print test to migration runbook', owner: 'Infrastructure Lead', due: 'Nov 20', actionStatus: 'Open',
  });
  add(cur, 27, 'P2', 'Patient monitoring integration', [0], 4.3, {
    impact: 'Vitals not flowing to the EHR in two ICUs; manual charting', resolution: 'Gateway restarted; vendor engaged',
    rootCause: 'Vendor gateway defect after network change', rcStatus: 'Under review', action: 'Install vendor patch', owner: 'Integration Lead', due: 'Dec 5', actionStatus: 'Open',
  });
  // One action overdue from last month.
  const lastMonthOpen = incidents.find((i) => i.mi === cur - 1 && i.actionStatus === 'Open');
  if (lastMonthOpen) { lastMonthOpen.actionStatus = 'Overdue'; lastMonthOpen.due = 'Oct 31'; }

  const ds: Dataset = {
    client: 'Sample Health System', provider: 'Convene',
    months, currentMi: cur, sites: SITES, categories: CATEGORIES, systems: SYSTEMS,
    tickets, siteMonths, systemMonths, infra, security, incidents,
    projects: [
      { name: 'Storage platform refresh', outcome: 'retire end-of-life arrays; automatic failover', sponsor: 'Chief Information Officer', phase: 'Build', schedule: 'A', scope: 'G', budget: 'G', overall: 'A', milestone: 'Production cutover', milestoneDate: 'Jan 18', blocker: 'Approve weekend downtime window by Nov 25', site: null, pctComplete: 0.46, budgetUsd: 1850000, spentUsd: 790000 },
      { name: 'Thin-client replacement', outcome: '220 nursing workstations replaced', sponsor: 'Chief Nursing Officer', phase: 'Build', schedule: 'G', scope: 'G', budget: 'G', overall: 'G', milestone: 'Units 4-6 deployed', milestoneDate: 'Dec 12', blocker: 'None', site: 0, pctComplete: 0.58, budgetUsd: 310000, spentUsd: 171000 },
      { name: 'Automated WAN failover', outcome: 'sub-minute failover at all hospitals', sponsor: 'VP Infrastructure', phase: 'Test', schedule: 'R', scope: 'G', budget: 'A', overall: 'R', milestone: 'Hospital D failover test', milestoneDate: 'Nov 19', blocker: 'Carrier circuit order delayed; escalation needed', site: 3, pctComplete: 0.72, budgetUsd: 240000, spentUsd: 205000 },
      { name: 'Multifactor sign-in for all staff', outcome: '100% MFA coverage', sponsor: 'Chief Information Security Officer', phase: 'Go-live', schedule: 'G', scope: 'G', budget: 'G', overall: 'G', milestone: 'Final wave (clinics)', milestoneDate: 'Nov 30', blocker: 'None', site: null, pctComplete: 0.9, budgetUsd: 180000, spentUsd: 150000 },
      { name: 'Wi-Fi expansion, inpatient floors', outcome: 'full coverage on renovated floors', sponsor: 'VP Facilities', phase: 'Plan', schedule: 'G', scope: 'A', budget: 'G', overall: 'A', milestone: 'Site survey complete', milestoneDate: 'Dec 3', blocker: 'Scope adds two floors; decision on budget', site: 0, pctComplete: 0.15, budgetUsd: 95000, spentUsd: 12000 },
      { name: 'Service desk self-service portal', outcome: '30% of requests self-served', sponsor: 'Chief Information Officer', phase: 'Build', schedule: 'G', scope: 'G', budget: 'G', overall: 'G', milestone: 'Pilot at Hospital C', milestoneDate: 'Jan 8', blocker: 'None', site: 2, pctComplete: 0.4, budgetUsd: 120000, spentUsd: 44000 },
      { name: 'Clinic network standardization', outcome: 'one network design at all 12 clinics', sponsor: 'VP Ambulatory', phase: 'Stabilize', schedule: 'G', scope: 'G', budget: 'A', overall: 'A', milestone: 'Close-out report', milestoneDate: 'Nov 28', blocker: 'Budget overrun of 6%; accept or descope', site: 5, pctComplete: 0.95, budgetUsd: 410000, spentUsd: 434000 },
    ],
    completedThisMonth: ['Multifactor sign-in: wave 3 (Hospitals B to E) live', 'Thin-client replacement: units 1-3 deployed', 'Backup retention policy aligned to the records schedule'],
    sinceLastReview: [
      { action: 'Reduce P3 backlog older than 7 days', owner: 'Service Desk Manager', status: 'A', statusText: 'Slipped (printing spike)', metric: 'Tickets open > 7 days', prior: '', current: '' },
      { action: 'Automate WAN failover at Hospital D', owner: 'Network Lead', status: 'R', statusText: 'Past due', metric: 'Network availability, Hospital D', prior: '', current: '' },
      { action: 'Raise phishing training completion', owner: 'Security Awareness Lead', status: 'A', statusText: 'At risk', metric: 'Phishing click rate', prior: '', current: '' },
      { action: 'Close critical vulnerabilities older than 30 days', owner: 'Vulnerability Mgmt Lead', status: 'G', statusText: 'On track', metric: 'Critical vulnerabilities open', prior: '', current: '' },
    ],
    nextActions: [
      { action: 'Apply storage controller firmware fix and test automatic failover', owner: 'Infrastructure Lead', due: 'Nov 22', measure: 'EHR availability ≥ 99.9%', area: 'Infrastructure' },
      { action: 'Remap remaining print queues at Hospital B and retire the old server', owner: 'Infrastructure Lead', due: 'Nov 20', measure: 'Printing tickets at Hospital B back below 60 per month', area: 'Service Desk' },
      { action: 'Recover P2 SLA compliance with a dedicated P2 dispatch queue', owner: 'Service Desk Manager', due: 'Nov 30', measure: 'P2 SLA compliance ≥ 98%', area: 'Service Desk' },
      { action: 'Re-run failed backup jobs at Hospital C and fix the job schedule', owner: 'Backup Lead', due: 'Nov 15', measure: 'Backup success 100%', area: 'Infrastructure' },
      { action: 'Targeted phishing training for the three departments with the most clicks', owner: 'Security Awareness Lead', due: 'Dec 15', measure: 'Phishing click rate < 5%', area: 'Security' },
    ],
    decisions: [
      { decision: 'Approve a weekend downtime window for the storage cutover', options: 'Jan 18 or Feb 8', recommend: 'Jan 18', reason: 'it removes the controller defect before the winter volume peak', maker: 'Chief Information Officer', by: 'Nov 25', costOfDelay: 'Three more weeks on the defective controller; each slip moves the cutover by 3 weeks' },
      { decision: 'Fund Wi-Fi for two added inpatient floors', options: 'Add to current project ($38k) or defer to FY27', recommend: 'adding to the current project', reason: 'the contractor is on site and the floors open in February', maker: 'VP Facilities', by: 'Dec 3', costOfDelay: 'New floors open without full coverage; device integration issues continue' },
      { decision: 'Clinic network budget overrun', options: 'Accept the 6% overrun or descope two closets', recommend: 'accepting the overrun', reason: 'descoping leaves two clinics on the old design', maker: 'VP Ambulatory', by: 'Nov 28', costOfDelay: 'Close-out and warranty start delayed' },
    ],
    certificates: [
      { name: 'Lab interface TLS', system: 'Interface engine', expires: 'Nov 21, 2026', days: 9, owner: 'Integration Lead' },
      { name: 'Patient portal web', system: 'Patient portal', expires: 'Dec 2, 2026', days: 20, owner: 'Web Services Lead' },
      { name: 'Remote access gateway', system: 'VPN', expires: 'Dec 19, 2026', days: 37, owner: 'Network Lead' },
      { name: 'Imaging viewer', system: 'PACS and imaging', expires: 'Jan 4, 2027', days: 53, owner: 'Imaging Systems Lead' },
    ],
    eol: [
      { item: 'Storage arrays (primary data center)', count: 2, sites: 'Data center', risk: 'R', replacement: 'Jan 18 (storage refresh)' },
      { item: 'Thin clients, 5+ years', count: 220, sites: 'Hospital A', risk: 'A', replacement: 'Jan 31 (refresh project)' },
      { item: 'Unsupported server OS', count: 14, sites: 'Hospitals B, C', risk: 'A', replacement: 'Mar 31' },
      { item: 'Network switches past vendor support', count: 9, sites: 'Hospital E, Clinics', risk: 'G', replacement: 'Feb 28' },
    ],
    siteActions: {
      0: ['Test storage controller failover after the firmware fix; Infrastructure Lead; Nov 22', 'Finish thin-client units 4-6; Field Services Lead; Dec 12', 'Close ICU monitor interface patch; Integration Lead; Dec 5'],
      1: ['Remap remaining print queues; Infrastructure Lead; Nov 20', 'Add a floor-walker for two weeks to clear backlog; Service Desk Manager; Nov 30', 'Survey users after printing fix; Service Desk Manager; Dec 10'],
      2: ['Fix backup job schedule overlap; Backup Lead; Nov 15', 'Pilot self-service portal; Service Desk Manager; Jan 8', 'Reduce critical patch gap; Endpoint Lead; Nov 30'],
      3: ['Complete automated WAN failover test; Network Lead; Nov 19', 'Replace two end-of-life switches; Network Lead; Feb 28', 'Refresh downtime procedure binders; Site IT Lead; Dec 1'],
      4: ['Schedule failover test (missed for 3 months); Site IT Lead; Nov 26', 'Upgrade site link bandwidth; Network Lead; Jan 15', 'Replace end-of-life switches; Network Lead; Feb 28'],
      5: ['Close out network standardization; Network Lead; Nov 28', 'Finish MFA final wave; Identity Lead; Nov 30', 'Inventory reconciliation at 3 clinics; Asset Lead; Dec 15'],
    },
    commentary: {
      brief: '',
      keyPoints: [],
      serviceDesk: 'Demand rose about 7% on a printing spike at Hospital B after the print-server migration missed 140 queues. That spike pushed Hospital B backlog and reopen rates up and pulled P3/P4 SLA below target there. P2 SLA missed target enterprise-wide; a dedicated P2 dispatch queue starts Nov 18. Password tickets continue to fall as self-service reset adoption grows.',
      clinical: 'EHR availability missed target after the Oct 14 storage controller failure (192 unplanned minutes). All sites used downtime procedures. Patient monitoring integration had 260 unplanned minutes in two ICUs while the vendor works a gateway defect. Other P1 clinical systems met target.',
      infrastructure: 'Unscheduled downtime was the highest in 18 months, driven by the storage failure. Nine backup jobs failed (seven re-ran within 24 hours; two at Hospital C did not). Storage peaked above 80% for the second month; the storage refresh cutover on Jan 18 needs a decision. One certificate expires inside 14 days.',
      incidents: 'One P1 and three P2 incidents. The P1 EHR outage (3.2 hrs) is the main event this month; the root cause is under vendor review and the firmware fix is scheduled for Nov 22. The Hospital B printing P2 missed the response target. One corrective action from September is overdue.',
      security: 'No PHI exposure events. Critical vulnerabilities continue to fall and mean time to patch critical CVEs is inside target. The phishing click rate (6.1%) is above the 5% target; three departments account for half of the clicks. Failed logins and lockouts spiked mid-month from a password-spray attempt that MFA blocked.',
    },
    nextReview: { when: 'December 10, 2026, 10:00 AM, Hospital A boardroom and video link', preRead: 'December 5, 2026', distribution: 'IT steering committee' },
    dataThrough: 'Oct 31, 2026', refreshed: 'Nov 12, 2026 6:00 AM',
  };
  return ds;
}
