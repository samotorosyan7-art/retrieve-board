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
  const shift = (d: number) => setMonth(({ m, y }) => {
    const nm = m + d;
    return nm < 0 ? { m: 11, y: y - 1 } : nm > 11 ? { m: 0, y: y + 1 } : { m: nm, y };
  });

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = m === now.getMonth() && y === now.getFullYear();
  const inMonth = (s: string) => { const d = new Date(s); return d.getFullYear() === y && d.getMonth() === m; };

  // Task deadlines grouped by day of month
  const byDate: Record<number, Project[]> = {};
  projects.forEach(p => { if (p.due && canSeeMatter(p, currentUser) && inMonth(p.due)) (byDate[new Date(p.due).getDate()] ||= []).push(p); });

  // Upcoming = due today or later; past deadlines stay on the calendar grid only.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlines = projects
    .filter(p => p.due && isOpen(p) && canSeeMatter(p, currentUser) && inMonth(p.due) && parseDate(p.due)! >= startOfToday)
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return (
    <div className="page active" id="page-calendar">
      <PageHeader title="Task" light="Calendar" sub={`Deadlines for ${monthName}`}>
        <button className="btn-ghost" onClick={() => shift(-1)} style={{ padding: '6px 12px' }}><ChevronLeftIcon size={14} /> Prev</button>
        <button className="btn-ghost" onClick={() => setMonth({ m: now.getMonth(), y: now.getFullYear() })} style={{ padding: '6px 12px' }}>Today</button>
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
            return (
              <div key={d} className={`cal-day${isToday ? ' today' : ''}`}>
                <div className="cal-date">{isToday ? <div className="cal-today-bubble">{d}</div> : d}</div>
                {items.slice(0, 3).map(p => {
                  const st = stat(p.status);
                  return (
                    <div key={p.id} className="cal-event" style={{ background: st.bg, color: st.col }} onClick={() => openPanel(p.id)} title={p.title}>
                      <span className="cal-ev-time"><ClipboardListIcon size={10} /></span>{p.client.split(' ')[0]}
                    </div>
                  );
                })}
                {items.length > 3 && <div className="cal-more">+{items.length - 3} more</div>}
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
