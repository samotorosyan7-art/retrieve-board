'use client';

import { useState } from 'react';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { PageHeader, Tag } from '@/components/ui';
import { firstWords, fmtShort, isTaskOD, pri } from '@/lib/helpers';
import type { Task } from '@/lib/types';

type Filter = 'all' | 'pending' | 'done' | 'overdue';

export default function TasksPage() {
  const { tasks, currentUser, setModal } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const all = tasks.filter(t => t.who === currentUser?.id);
  const pending = all.filter(t => !t.done);
  const done = all.filter(t => t.done);
  const overdue = pending.filter(isTaskOD);
  const byFilter = { all, pending, done, overdue }[filter];
  // Overdue first, then by due date
  const shown = [...byFilter].sort((a, b) => {
    const aOD = isTaskOD(a), bOD = isTaskOD(b);
    if (aOD !== bOD) return aOD ? -1 : 1;
    return new Date(a.due || '9999').getTime() - new Date(b.due || '9999').getTime();
  });

  const tabs: [Filter, string, number][] = [
    ['all', 'All', all.length], ['pending', 'Pending', pending.length], ['overdue', 'Overdue', overdue.length], ['done', 'Done', done.length],
  ];
  const emptyTitle = { pending: 'All caught up!', overdue: 'No overdue tasks!', done: 'No completed tasks yet', all: 'No tasks assigned' }[filter];

  return (
    <div className="page active" id="page-tasks">
      <PageHeader title="My" light="Tasks" sub={`${pending.length} pending · ${done.length} done · ${overdue.length} overdue`}>
        <button className="btn-solid" onClick={() => setModal({ kind: 'task', id: null })}>＋ Add Task</button>
      </PageHeader>

      <div className="tasks-filter-row">
        {tabs.map(([id, label, count]) => (
          <button key={id} className={`tf-btn${filter === id ? ' active' : ''}`} onClick={() => setFilter(id)}>
            {label} <span className="tf-count">{count}</span>
          </button>
        ))}
      </div>

      <div className="task-cards-grid">
        {shown.length === 0 && (
          <div className="task-empty-state">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{emptyTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {filter === 'pending' ? 'Nothing pending. Add a new task to get started.' : 'Check back later.'}
            </div>
          </div>
        )}
        {shown.map(t => (
          <TaskCard key={t.id} t={t} expanded={expanded === t.id} onToggle={() => setExpanded(e => (e === t.id ? null : t.id))} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ t, expanded, onToggle }: { t: Task; expanded: boolean; onToggle: () => void }) {
  const { projects, setModal, toggleTask, toggleSubtask, addSubtask, deleteTask } = useStore();
  const { openMatter } = useNav();
  const [newSub, setNewSub] = useState('');
  const p = projects.find(x => x.id === t.pid);
  const pr = pri(t.priority || 'medium');
  const od = isTaskOD(t);
  const subs = t.subtasks || [];
  const doneSubs = subs.filter(s => s.done).length;
  const subPct = subs.length ? Math.round((doneSubs / subs.length) * 100) : 0;

  const submitSub = () => { addSubtask(t.id, newSub); setNewSub(''); };

  return (
    <div className={`task-card${t.done ? ' tc-done' : ''}${od ? ' tc-overdue' : ''}`}>
      <div className="tc-top" onClick={onToggle}>
        <div className="tc-check-wrap">
          <div className={`tc-chk ${t.done ? 'done' : 'pend'}`} onClick={e => { e.stopPropagation(); toggleTask(t.id); }}>{t.done ? '✓' : ''}</div>
        </div>
        <div className="tc-main">
          <div className={`tc-title${t.done ? ' done' : ''}`}>{t.title}</div>
          <div className="tc-meta">
            {p && (
              <span className="tc-matter" onClick={e => { e.stopPropagation(); openMatter(p.id); }} title="Open matter">
                {p.client} · {firstWords(p.title, 3)}
              </span>
            )}
            {t.time && <span className="tc-time">🕐 {t.time}</span>}
            <span className={`tc-due${od ? ' overdue' : ''}`}>{od ? '⚠ Overdue · ' : ''} {fmtShort(t.due)}</span>
          </div>
        </div>
        <div className="tc-badges">
          {t.isPrivate && (
            <span className="tc-est" style={{ background: 'rgba(124,111,247,0.12)', color: '#7C6FF7', borderColor: 'rgba(124,111,247,0.2)' }}>🔒 Private</span>
          )}
          <Tag {...pr} />
          {!!t.estHours && <span className="tc-est">{t.estHours}h est.</span>}
          {subs.length > 0 && (
            <span className="tc-sub-badge" style={{ color: subPct === 100 ? 'var(--s-done)' : 'var(--text-tertiary)' }}>{doneSubs}/{subs.length}</span>
          )}
          <span className="tc-expand">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="tc-body">
          {t.notes && <div className="tc-notes">{t.notes}</div>}
          <div className="tc-subtasks">
            <div className="tc-section-lbl">
              {subs.length ? `Subtasks · ${doneSubs}/${subs.length}` : 'Subtasks'}
              {subs.length > 0 && (
                <div className="tc-sub-bar">
                  <div className="tc-sub-fill" style={{ width: `${subPct}%`, background: subPct === 100 ? 'var(--s-done)' : 'var(--s-inprogress)' }} />
                </div>
              )}
            </div>
            {subs.map(s => (
              <div key={s.id} className="tc-subtask-row">
                <div className={`tc-sub-chk ${s.done ? 'done' : 'pend'}`} onClick={() => toggleSubtask(t.id, s.id)}>{s.done ? '✓' : ''}</div>
                <span className={`tc-sub-title${s.done ? ' done' : ''}`}>{s.title}</span>
              </div>
            ))}
            <div className="tc-add-sub">
              <input
                className="input" placeholder={subs.length ? 'Add subtask…' : 'Add a subtask…'}
                style={{ fontSize: 11.5, padding: '5px 8px' }}
                value={newSub} onChange={e => setNewSub(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitSub(); }}
              />
              <button className="btn-ghost" onClick={submitSub} style={{ fontSize: 11, padding: '4px 8px' }}>＋</button>
            </div>
          </div>

          <div className="tc-actions">
            {!t.done
              ? <button className="tc-btn success" onClick={() => toggleTask(t.id)}>✓ Mark Complete</button>
              : <button className="tc-btn default" onClick={() => toggleTask(t.id)}>↩ Reopen</button>}
            {p && <button className="tc-btn default" onClick={() => openMatter(p.id)}>↗ Open Matter</button>}
            <button className="tc-btn default" onClick={() => setModal({ kind: 'task', id: t.id })}>✏ Edit</button>
            <button className="tc-btn danger" onClick={() => deleteTask(t.id)}>🗑</button>
          </div>
        </div>
      )}
    </div>
  );
}
