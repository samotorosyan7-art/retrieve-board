import { PRIORITIES, STATUSES } from './constants';
import type { Currency, Member, Project } from './types';

export const stat = (id: string) => STATUSES.find(s => s.id === id) ?? STATUSES[0];
export const pri = (id: string) => PRIORITIES.find(p => p.id === id) ?? PRIORITIES[1];

export const parseDate = (d: string) => {
  if (!d) return null;
  const [y, m, dy] = d.split('-').map(Number);
  return new Date(y, m - 1, dy);
};
/** Still open work — not Completed and not Archived. */
export const isOpen = (p: Project) => p.status !== 'done' && p.status !== 'archive';

/** Dashboard "Urgent & Overdue": open and either overdue or high priority. */
export const isUrgent = (p: Project) => isOpen(p) && (p.priority === 'high' || isOD(p));

export const isOD = (p: Project) => {
  if (p.status === 'done' || p.status === 'archive' || !p.due) return false;
  const d = parseDate(p.due);
  return !!d && d < new Date();
};
export const progColor = (v: number) => (v >= 80 ? '#34D399' : v >= 40 ? '#FB923C' : '#F87171');
export const utilColor = (pct: number) => (pct > 80 ? '#F87171' : pct > 55 ? '#FB923C' : '#34D399');

export const fmtDate = (d: string) => {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
};
export const fmtShort = (d: string) => {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
};
export const fmtMoney = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtBill(usdAmount: number, currency: Currency, fx: Record<Currency, number>) {
  const symbols = { USD: '$', EUR: '€', AMD: '֏' };
  const converted = usdAmount * (fx[currency] || 1);
  if (currency === 'AMD') return symbols.AMD + Math.round(converted).toLocaleString('en-US');
  return symbols[currency] + converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const today = () => new Date().toISOString().split('T')[0];
export const firstWords = (s: string, n: number) => s.split(' ').slice(0, n).join(' ');
export const firstName = (m?: Member) => m?.name.split(' ')[0] ?? '';

export function escapeHtml(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Activity text is stored with <b> tags. Escape everything, then restore only <b>/</b>. */
export function sanitizeActivity(s: string) {
  return escapeHtml(s).replace(/&lt;(\/?)b&gt;/g, '<$1b>');
}

export function clientColor(name: string) {
  const colors = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#0EA5E9','#F97316','#EC4899','#14B8A6','#6366F1'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}
export const clientInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

export function canSeeMatter(p: Project, user: Member | null) {
  if (!p.isPrivate) return true;
  if (!user) return false;
  return p.createdBy === user.id || p.supervisor === user.id || user.isAdmin;
}

/** Admins delete any task; members only tasks they created (matches migration 004). */
export const canDeleteMatter = (p: Project, user: Member | null) =>
  !!user && (user.isAdmin || (!!p.createdBy && p.createdBy === user.id));

/** Direct-message room shared by two members: 'dm_<a>__<b>' with ids sorted (must match migration 002). */
export const dmRoom = (a: string, b: string) => 'dm_' + [a, b].sort().join('__');

/** Two-letter initials from a full name ("Mariam Dovlatyan" → "MD"), avoiding any in `taken`.
 *  On a clash it tries close alternatives: first initial + another letter of the last name (MO, MV…),
 *  then of the first name (MA, MR…), then the first initial with any letter. */
export function makeInitials(name: string, taken: string[]) {
  const words = name.toUpperCase().split(/\s+/).map(w => w.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  if (!words.length) return '';
  const first = words[0], last = words.length > 1 ? words[words.length - 1] : '';
  const used = new Set(taken.map(t => t.toUpperCase()));
  const a = first[0];
  const seconds = [...last, ...first.slice(1), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
  for (const b of seconds) if (!used.has(a + b)) return a + b;
  return a + (last[0] || first[1] || '');
}
