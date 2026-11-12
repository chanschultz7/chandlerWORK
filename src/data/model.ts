// Data model for the IT Monthly Operations Review (MOR) dashboard.
//
// Every page reads from one Dataset. In the prototype the Dataset is synthetic (src/data/generate.ts,
// fixed seed). In production, replace generateDataset() with a loader that builds the same shape
// from the source systems listed in the metric dictionary (ITSM, phone, monitoring, backup, patch,
// vulnerability scanner, SIEM, project register).

export type Pri = 'P1' | 'P2' | 'P3' | 'P4' | 'SR';
export const PRIORITIES: Pri[] = ['P1', 'P2', 'P3', 'P4', 'SR'];
export const PRI_LABEL: Record<Pri, string> = {
  P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Moderate', P4: 'P4 Low', SR: 'Service requests',
};

export type Rag = 'G' | 'A' | 'R' | 'N';

export interface Month { mi: number; key: string; label: string; short: string; year: number; month: number; days: number }

export interface Site {
  key: number; code: string; name: string; short: string;
  beds: number; users: number; devices: number; lead: string; ehr: string;
  weight: number;
}

export interface Category { key: number; name: string; rootCause: string; fix: string }

/** One row per month, site and priority (from the IT service management tool). */
export interface TicketFact {
  mi: number; site: number; pri: Pri; cat: number;
  opened: number; resolved: number; slaMet: number;
  respMinSum: number; resolveHrsSum: number;
}

/** Site-level monthly measures (service desk phone, backlog, survey, network, patching, assets). */
export interface SiteMonth {
  mi: number; site: number;
  fcrFirst: number; fcrEligible: number;
  callsOffered: number; callsAnswered: number; asaSecSum: number; callsAbandoned: number;
  backlogOpen: number; backlogOver7: number;
  reopened: number; csatSum: number; csatN: number;
  netUpMin: number; netTotMin: number;
  patchDevices: number; patch30: number; critDevices: number; crit7: number;
  eolDevices: number; openCritVulns: number; assetAccuracy: number; failoverTested: boolean;
}

export interface ClinicalSystem { key: number; name: string; tier: 'P1' | 'General'; owner: string }

export interface SystemMonth {
  mi: number; sys: number;
  totalMin: number; unplannedMin: number; plannedHrs: number; plannedWindows: number;
  tickets: number; topIssue: string; interfaceErrors: number; interfaceDelays: number;
}

/** Enterprise infrastructure measures for the month (monitoring, backup, change, capacity). */
export interface InfraMonth {
  mi: number;
  wan: number; server: number; email: number;
  schedHrs: number; unschedHrs: number;
  backupJobs: number; backupFailed: number; backupRerunOk: number;
  storagePeak: number; bandwidthPeak: number; cpuPeak: number; memPeak: number;
  certs60: number; certs14: number;
  chgStd: number; chgNormal: number; chgEmerg: number; chgFailed: number;
}

export interface SecMonth {
  mi: number;
  incLow: number; incMed: number; incHigh: number; incOpen: number;
  phishDelivered: number; phishClicks: number;
  vulnC: number; vulnH: number; vulnM: number; vulnL: number;
  /** Open findings by age bucket (<7, 7-30, 31-90, >90 days) for C, H, M, L. */
  vulnAge: number[][];
  mttpCrit: number;
  endpointCov: number; mfaCov: number; encryption: number; training: number; adminReview: number;
  failedLogins: number; lockouts: number; phiEvents: number; patchExceptions: number;
}

export interface Incident {
  id: string; mi: number; day: number; opened: string;
  system: string; sites: number[]; sev: 'P1' | 'P2';
  durationHrs: number; clinicalDowntimeHrs: number; responseMin: number; withinSla: boolean;
  impact: string; resolution: string; rootCause: string; rcStatus: 'Confirmed' | 'Under review';
  action: string; owner: string; due: string; actionStatus: 'Open' | 'Closed' | 'Overdue';
  downtimeProcedures: boolean;
}

export interface Project {
  name: string; outcome: string; sponsor: string;
  phase: 'Initiate' | 'Plan' | 'Build' | 'Test' | 'Go-live' | 'Stabilize';
  schedule: Rag; scope: Rag; budget: Rag; overall: Rag;
  milestone: string; milestoneDate: string; blocker: string; site: number | null;
  pctComplete: number; budgetUsd: number; spentUsd: number;
}

export interface Commitment { action: string; owner: string; status: Rag; statusText: string; metric: string; prior: string; current: string }
export interface ActionItem { action: string; owner: string; due: string; measure: string; area: string }
export interface Decision { decision: string; options: string; recommend: string; reason: string; maker: string; by: string; costOfDelay: string }

export interface Certificate { name: string; system: string; expires: string; days: number; owner: string }
export interface EolItem { item: string; count: number; sites: string; risk: Rag; replacement: string }

export interface Commentary {
  brief: string;
  keyPoints: { label: string; text: string }[];
  serviceDesk: string; clinical: string; infrastructure: string; incidents: string; security: string;
}

export interface Dataset {
  client: string; provider: string; months: Month[]; currentMi: number;
  sites: Site[]; categories: Category[]; systems: ClinicalSystem[];
  tickets: TicketFact[]; siteMonths: SiteMonth[]; systemMonths: SystemMonth[];
  infra: InfraMonth[]; security: SecMonth[]; incidents: Incident[];
  projects: Project[]; completedThisMonth: string[];
  sinceLastReview: Commitment[]; nextActions: ActionItem[]; decisions: Decision[];
  certificates: Certificate[]; eol: EolItem[];
  siteActions: Record<number, string[]>;
  commentary: Commentary;
  nextReview: { when: string; preRead: string; distribution: string };
  dataThrough: string; refreshed: string;
}
