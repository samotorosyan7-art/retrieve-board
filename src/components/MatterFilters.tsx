'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AREAS, MATTER_TYPES, PRIORITIES, STATUSES } from '@/lib/constants';
import { canSeeMatter, firstWords, isOD, isOpen, isUrgent } from '@/lib/helpers';
import type { Project } from '@/lib/types';
import { useStore } from './store';
import { XIcon } from 'lucide-react';

type Filters = { client: string; type: string; emp: string; area: string; pri: string; stat: string; sort: string };
const EMPTY: Filters = { client: '', type: '', emp: '', area: '', pri: '', stat: '', sort: '' };

export const byDate = (key: 'due' | 'created', dir: 1 | -1, fallback: string) =>
  (a: Project, b: Project) => dir * (new Date(a[key] || fallback).getTime() - new Date(b[key] || fallback).getTime());

/** Filters seeded from the URL, e.g. /list?emp=<id> (Team Workload), /list?stat=overdue (Dashboard KPIs), /list?sort=deadline-desc. */
const fromParams = (q: URLSearchParams): Filters =>
  ({ ...EMPTY, emp: q.get('emp') || '', stat: q.get('stat') || '', pri: q.get('pri') || '', sort: q.get('sort') || '' });

/** Status filter values beyond the real statuses: 'open' = not completed/archived, 'overdue' = open and past due,
 *  'urgent' = the dashboard's Urgent & Overdue (open and overdue or high priority). */
const matchesStat = (p: Project, stat: string) =>
  stat === 'open' ? isOpen(p) : stat === 'overdue' ? isOD(p) : stat === 'urgent' ? isUrgent(p) : p.status === stat;

/** Filter state + the visible, filtered, sorted matter list (Kanban and List pages). All filters combine (AND). */
export function useMatterFilters() {
  const { projects, currentUser, search } = useStore();
  // useSearchParams, not window.location: on in-app navigation the new page renders before the address bar updates.
  const params = useSearchParams();
  const [f, setF] = useState<Filters>(() => fromParams(params));
  // A new URL (e.g. another dashboard link) re-seeds the filters.
  const qs = params.toString();
  const [seededFrom, setSeededFrom] = useState(qs);
  if (seededFrom !== qs) { setSeededFrom(qs); setF(fromParams(params)); }
  const q = search.toLowerCase();

  let list = projects.filter(p => {
    if (!canSeeMatter(p, currentUser)) return false;
    if (f.client && p.client !== f.client) return false;
    if (f.type && (p.matterType || '') !== f.type) return false;
    if (f.emp && !p.assignees.includes(f.emp)) return false;
    if (f.area && p.area !== f.area) return false;
    if (f.pri && p.priority !== f.pri) return false;
    if (f.stat && !matchesStat(p, f.stat)) return false;
    if (q && !p.title.toLowerCase().includes(q) && !p.client.toLowerCase().includes(q)) return false;
    return true;
  });
  if (f.sort === 'deadline-asc') list = [...list].sort(byDate('due', 1, '9999-12-31'));
  if (f.sort === 'deadline-desc') list = [...list].sort(byDate('due', -1, '0000-01-01'));
  if (f.sort === 'date-asc') list = [...list].sort(byDate('created', 1, '0'));
  if (f.sort === 'date-desc') list = [...list].sort(byDate('created', -1, '0'));
  if (f.sort === 'client-asc') list = [...list].sort((a, b) => a.client.localeCompare(b.client) || a.title.localeCompare(b.title));
  if (f.sort === 'client-desc') list = [...list].sort((a, b) => b.client.localeCompare(a.client) || a.title.localeCompare(b.title));

  return { filters: f, setFilters: setF, clear: () => setF(EMPTY), list };
}

export function MatterFilterRow({
  filters, setFilters, clear, withStatus = false,
}: ReturnType<typeof useMatterFilters> & { withStatus?: boolean }) {
  const { projects, team, currentUser } = useStore();
  const clientNames = [...new Set(projects.filter(p => canSeeMatter(p, currentUser)).map(p => p.client).filter(Boolean))].sort();
  const bind = (k: keyof Filters) => ({
    value: filters[k],
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFilters(f => ({ ...f, [k]: e.target.value })),
  });

  return (
    <div className="filter-row">
      <select className="sel" {...bind('client')}>
        <option value="">All clients</option>
        {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className="sel" {...bind('type')}>
        <option value="">All task types</option>
        {MATTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <select className="sel" {...bind('emp')}>
        <option value="">All staff</option>
        {team.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <select className="sel" {...bind('area')}>
        <option value="">All areas</option>
        {AREAS.map(a => <option key={a} value={a}>{firstWords(a, 3)}</option>)}
      </select>
      <select className="sel" {...bind('pri')}>
        <option value="">All priorities</option>
        {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
      {withStatus && (
        <select className="sel" {...bind('stat')}>
          <option value="">All statuses</option>
          <option value="open">Open (not completed)</option>
          <option value="overdue">Overdue</option>
          <option value="urgent">Urgent &amp; overdue</option>
          {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      )}
      <select className="sel" {...bind('sort')} style={{ minWidth: 130 }}>
        <option value="">Sort: Default</option>
        <option value="deadline-asc">Deadline ↑ (earliest)</option>
        <option value="deadline-desc">Deadline ↓ (latest)</option>
        <option value="date-asc">Date created ↑</option>
        <option value="date-desc">Date created ↓</option>
        <option value="client-asc">Client A → Z</option>
        <option value="client-desc">Client Z → A</option>
      </select>
      <button className="btn-ghost" onClick={clear} style={{ fontSize: 12, padding: '6px 12px' }}><XIcon size={12} /> Clear</button>
    </div>
  );
}
