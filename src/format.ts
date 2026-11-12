export type Unit = 'pct' | 'count' | 'min' | 'hrs' | 'sec' | 'days' | 'score' | 'usd';

const nf = (d: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmt(v: number | null | undefined, unit: Unit, digits?: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '–';
  switch (unit) {
    case 'pct': return `${nf(digits ?? 1).format(v * 100)}%`;
    case 'count': return nf(digits ?? 0).format(v);
    case 'min': return `${nf(digits ?? 0).format(v)} min`;
    case 'hrs': return `${nf(digits ?? 1).format(v)} hrs`;
    case 'sec': return `${nf(digits ?? 0).format(v)} sec`;
    case 'days': return `${nf(digits ?? 1).format(v)} days`;
    case 'score': return nf(digits ?? 2).format(v);
    case 'usd': return v >= 1e6 ? `$${nf(2).format(v / 1e6)}M` : v >= 1e3 ? `$${nf(0).format(v / 1e3)}k` : `$${nf(0).format(v)}`;
  }
}

/** Signed difference in the metric's own unit (percentage points for percentages). */
export function fmtDelta(d: number | null | undefined, unit: Unit, digits?: number): string {
  if (d === null || d === undefined || Number.isNaN(d)) return '–';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  const a = Math.abs(d);
  if (unit === 'pct') return `${sign}${nf(digits ?? 1).format(a * 100)} pts`;
  return `${sign}${fmt(a, unit, digits)}`;
}

export const pct = (v: number | null | undefined, d = 1) => fmt(v, 'pct', d);
export const num = (v: number | null | undefined, d = 0) => fmt(v, 'count', d);
