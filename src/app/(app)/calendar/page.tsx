'use client';

import { useState } from 'react';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag, cardTitle, muted } from '@/components/ui';
import { canSeeMatter, fmtDate, isOD, pri, stat, isOpen, parseDate } from '@/lib/helpers';
import type { Project } from '@/lib/types';
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, TriangleAlertIcon } from 'lucide-react';

export default function CalendarPage() {
  const { projects, currentUser, openPanel } = useStore();
  const now = new Date();
  const [{ m, y }, setMonth] = useState({ m: now.getMonth(), y: now.getFullYear() });
  // Days opened with "+N more" show every deadline instead of the first three.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleDay = (d: number) => setExpanded(s => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });
  const shift = (d: number) => { setExpanded(new Set()); setMonth(({ m, y }) => {
    const nm = m + d;
    return nm < 0 ? { m: 11, y: y - 1 } : nm > 11 ? { m: 0, y: y + 1 } : { m: nm, y };
  }); };

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = m === now.getMonth() && y === now.getFullYear();
  const inMonth = (s: string) => { const d = new Date(s); return d.getFullYear() === y && d.getMonth() === m; };

  // Admins see every visible deadline; members only tasks assigned to them.
  const mine = (p: Project) => canSeeMatter(p, currentUser) && (!!currentUser?.isAdmin || (!!currentUser && p.assignees.includes(currentUser.id)));

  // Task deadlines grouped by day of month
  const byDate: Record<number, Project[]> = {};
  projects.forEach(p => { if (p.due && mine(p) && inMonth(p.due)) (byDate[new Date(p.due).getDate()] ||= []).push(p); });

  // Upcoming = due today or later; past deadlines stay on the calendar grid only.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlines = projects
    .filter(p => p.due && isOpen(p) && mine(p) && inMonth(p.due) && parseDate(p.due)! >= startOfToday)
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return (
    <div className="page active" id="page-calendar">
      <PageHeader title="Task" light="Calendar" sub={`${currentUser?.isAdmin ? 'Deadlines' : 'Your deadlines'} for ${monthName}`}>
        <button className="btn-ghost" onClick={() => shift(-1)} style={{ padding: '6px 12px' }}><ChevronLeftIcon size={14} /> Prev</button>
        <button className="btn-ghost" onClick={() => { setExpanded(new Set()); setMonth({ m: now.getMonth(), y: now.getFullYear() }); }} style={{ padding: '6px 12px' }}>Today</button>
        <button className="btn-ghost" onClick={() => shift(1)} style={{ padding: '6px 12px' }}>Next <ChevronRightIcon size={14} /></button>
      </PageHeader>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
          {Array.from({ length: firstDay }, (_, i) => <div key={'e' + i} className="cal-day other-month" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const isToday = isCurrentMonth && d === now.getDate();
            const items = byDate[d] || [];
            const open = expanded.has(d);
            return (
              <div key={d} className={`cal-day${isToday ? ' today' : ''}`}>
                <div className="cal-date">{isToday ? <div className="cal-today-bubble">{d}</div> : d}</div>
                {(open ? items : items.slice(0, 3)).map(p => {
                  const st = stat(p.status);
                  // Long client names wrap to two lines; the tooltip always has the full name and task.
                  return (
                    <div key={p.id} className="cal-event cal-event-full" style={{ background: st.bg, color: st.col }} onClick={() => openPanel(p.id)} title={`${p.client} — ${p.title}`}>
                      <span className="cal-ev-time"><ClipboardListIcon size={10} /></span>{p.client}
                    </div>
                  );
                })}
                {items.length > 3 && (
                  <button className="cal-more cal-more-btn" onClick={() => toggleDay(d)}>
                    {open ? 'Show less' : `+${items.length - 3} more`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="card">
          <div style={{ ...cardTitle, marginBottom: 12 }}>Upcoming Deadlines — {monthName}</div>
          {deadlines.length ? deadlines.map(p => {
            const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
            return (
              <div key={p.id} className="urgent-row" onClick={() => openPanel(p.id)}>
                <div className="urgent-dot" style={{ background: od ? '#F87171' : st.col }} />
                <div style={{ flex: 1, minWidth: 0 }}><div className="urgent-title">{p.title}</div><div className="urgent-client">{p.client}</div></div>
                <AvStack ids={p.assignees.slice(0, 2)} />
                <Tag {...pr} />
                <div className="urgent-due" style={{ color: od ? '#F87171' : 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{od && <><TriangleAlertIcon size={11} /> </>}{fmtDate(p.due)}</div>
              </div>
            );
          }) : <div style={muted}>No upcoming deadlines this month.</div>}
        </div>
      </div>
    </div>
  );
}
