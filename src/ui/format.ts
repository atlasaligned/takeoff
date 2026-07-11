import { weekToDate } from '../engine/balance';

/** money is in $M */
export function fmtMoney(m: number): string {
  const neg = m < 0 ? '−' : '';
  const x = Math.abs(m);
  if (x >= 1_000_000) return `${neg}$${(x / 1_000_000).toFixed(2)}T`;
  if (x >= 10_000) return `${neg}$${(x / 1000).toFixed(1)}B`;
  if (x >= 1000) return `${neg}$${(x / 1000).toFixed(2)}B`;
  if (x >= 100) return `${neg}$${Math.round(x)}M`;
  if (x >= 1) return `${neg}$${x.toFixed(x < 10 ? 1 : 0)}M`;
  if (x === 0) return '$0';
  // sub-million values (e.g. chip unit prices): whole dollars
  return `${neg}$${Math.round(x * 1e6).toLocaleString('en-US')}`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function fmtFlop(f: number): string {
  if (f <= 0) return '0';
  const e = Math.floor(Math.log10(f));
  const mant = f / Math.pow(10, e);
  return `${mant.toFixed(1)}e${e}`;
}

export function fmtDate(week: number): string {
  return weekToDate(week).label;
}

export function fmtWeeks(w: number): string {
  if (!Number.isFinite(w)) return '—';
  return `${Math.ceil(w)} wk`;
}
