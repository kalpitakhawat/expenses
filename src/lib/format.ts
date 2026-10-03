import type { Period } from '../types';

export function todayISO() {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function shiftDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function rangeFor(period: Period, custom?: { from: string; to: string }) {
  const today = todayISO();
  if (period === 'month') {
    const [year, month] = today.split('-');
    const last = new Date(Number(year), Number(month), 0).getDate();
    return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(last).padStart(2, '0')}` };
  }
  if (period === '30d') return { from: shiftDays(today, -29), to: today };
  if (period === 'year') {
    const year = today.slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  if (period === 'custom') return { from: custom?.from || '', to: custom?.to || '' };
  return { from: '', to: '' };
}

export function periodLabel(period: Period) {
  if (period === 'month') return 'This month';
  if (period === '30d') return 'Last 30 days';
  if (period === 'year') return 'This year';
  if (period === 'custom') return 'Custom range';
  return 'All time';
}

export function formatDay(iso: string) {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === shiftDays(today, -1)) return 'Yesterday';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatInr(amount: number) {
  const hasPaise = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(amount);
}

export function parseMoney(raw: string) {
  const cleaned = raw.replace(/[₹,\s]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
