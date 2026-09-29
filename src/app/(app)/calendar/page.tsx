'use client';

import { useState } from 'react';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag, cardTitle, muted } from '@/components/ui';
import { canSeeMatter, firstWords, fmtDate, isOD, pri, stat, isOpen } from '@/lib/helpers';
import type { Project, Task } from '@/lib/types';
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, TriangleAlertIcon } from 'lucide-react';

type Item = { type: 'matter'; data: Project } | { type: 'task'; data: Task };

export default function CalendarPage() {
  const { projects, tasks, currentUser, openPanel } = useStore();
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

  // Matter deadlines + timed tasks grouped by day of month
  const byDate: Record<number, Item[]> = {};
  const push = (day: number, item: Item) => { (byDate[day] ||= []).push(item); };
  projects.forEach(p => { if (p.due && canSeeMatter(p, currentUser) && inMonth(p.due)) push(new Date(p.due).getDate(), { type: 'matter', data: p }); });
  tasks.forEach(t => { if (t.due && t.time && inMonth(t.due)) push(new Date(t.due).getDate(), { type: 'task', data: t }); });
  const itemTime = (i: Item) => (i.type === 'task' && i.data.time ? i.data.time : '23:59');

  const deadlines = projects
    .filter(p => p.due && isOpen(p) && inMonth(p.due))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
  const timedTasks = tasks
    .filter(t => t.due && t.time && !t.done && inMonth(t.due))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime() || a.time.localeCompare(b.time));

  return (
    <div className="page active" id="page-calendar">
      <PageHeader title="Task" light="Calendar" sub={`Deadlines & to-dos for ${monthName}`}>
        <button className="btn-ghost" onClick={() => shift(-1)} style={{ padding: '6px 12px' }}><ChevronLeftIcon size={14} /> Prev</button>
        <button className="btn-ghost" onClick={() => setMonth({ m: now.getMonth(), y: now.getFullYear() })} style={{ padding: '6px 12px' }}>Today</button>
        <button className="btn-ghost" onClick={() => shift(1)} style={{ padding: '6px 12px' }}>Next <ChevronRightIcon size={14} /></button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Legend color="rgba(124,111,247,0.3)" label="Task deadline" />
        <Legend color="rgba(248,113,113,0.3)" label="To-do (timed)" />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
          {Array.from({ length: firstDay }, (_, i) => <div key={'e' + i} className="cal-day other-month" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const isToday = isCurrentMonth && d === now.getDate();
            const items = (byDate[d] || []).sort((a, b) => itemTime(a).localeCompare(itemTime(b)));
            return (
              <div key={d} className={`cal-day${isToday ? ' today' : ''}`}>
                <div className="cal-date">{isToday ? <div className="cal-today-bubble">{d}</div> : d}</div>
                {items.slice(0, 3).map(item => {
                  if (item.type === 'matter') {
                    const p = item.data, st = stat(p.status);
                    return (
                      <div key={p.id} className="cal-event" style={{ background: st.bg, color: st.col }} onClick={() => openPanel(p.id)} title={p.title}>
                        <span className="cal-ev-time"><ClipboardListIcon size={10} /></span>{p.client.split(' ')[0]}
                      </div>
                    );
                  }
                  const t = item.data, pr = pri(t.priority || 'medium');
                  return (
                    <div key={t.id} className="cal-event cal-task-event" style={{ background: pr.bg, color: pr.col }} title={t.title}>
                      <span className="cal-ev-time">{t.time}</span>{firstWords(t.title, 2)}
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
          }) : <div style={muted}>No deadlines this month.</div>}
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ ...cardTitle, marginBottom: 12 }}>Timed To-dos — {monthName}</div>
          {timedTasks.length ? timedTasks.map(t => {
            const p = projects.find(x => x.id === t.pid), pr = pri(t.priority || 'medium');
            const od = new Date(t.due) < new Date();
            return (
              <div key={t.id} className="urgent-row">
                <div className="urgent-dot" style={{ background: pr.col }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="urgent-title">{t.title}</div>
                  <div className="urgent-client">{p?.client || ''} · {p ? firstWords(p.title, 4) : ''}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', background: 'var(--bg-overlay)', padding: '3px 8px', borderRadius: 'var(--r-sm)' }}>{t.time}</div>
                <Tag {...pr} />
                <div className="urgent-due" style={{ color: od ? '#F87171' : 'var(--text-tertiary)' }}>{fmtDate(t.due)}</div>
              </div>
            );
          }) : <div style={muted}>No timed to-dos this month.</div>}
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-tertiary)' }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} /> {label}
    </div>
  );
}
