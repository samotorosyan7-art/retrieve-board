'use client';

import { useState } from 'react';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { firstWords, fmtShort, isOD, isOpen, isTaskOD, pri, progColor, stat } from '@/lib/helpers';
import type { Task } from '@/lib/types';
import { ArrowUpRightIcon, CheckIcon, ClockIcon, LockIcon, PartyPopperIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';

type Filter = 'all' | 'pending' | 'done' | 'overdue';

export default function TasksPage() {
  const { tasks, projects, currentUser, setModal, openPanel, selectedPid } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);

  // Tasks (board cards) assigned to me — overdue first, then by due date.
  const assigned = projects.filter(p => !!currentUser && p.assignees.includes(currentUser.id));
  const assignedOpen = assigned.filter(isOpen);
  const assignedDone = assigned.filter(p => !isOpen(p));
  const assignedShown = [...(showDone ? assignedDone : assignedOpen)].sort((a, b) => {
    if (isOD(a) !== isOD(b)) return isOD(a) ? -1 : 1;
    return new Date(a.due || '9999-12-31').getTime() - new Date(b.due || '9999-12-31').getTime();
  });
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
  const emptyTitle = { pending: 'All caught up!', overdue: 'No overdue to-dos!', done: 'No completed to-dos yet', all: 'No to-dos yet' }[filter];

  return (
    <div className="page active" id="page-tasks">
      <PageHeader title="My" light="Tasks" sub={`${assignedOpen.length} open task${assignedOpen.length !== 1 ? 's' : ''} assigned to you · ${pending.length} to-do${pending.length !== 1 ? 's' : ''} pending`}>
        <button className="btn-solid" onClick={() => setModal({ kind: 'task', id: null })}><PlusIcon size={14} /> Add To-do</button>
      </PageHeader>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Assigned to me</div>
          <div className="seg-ctrl">
            <button className={`seg-btn${!showDone ? ' active' : ''}`} onClick={() => setShowDone(false)}>Open ({assignedOpen.length})</button>
            <button className={`seg-btn${showDone ? ' active' : ''}`} onClick={() => setShowDone(true)}>Completed &amp; archived ({assignedDone.length})</button>
          </div>
        </div>
        {assignedShown.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '8px 0' }}>
            {showDone ? 'Nothing completed yet.' : 'No open tasks assigned to you <PartyPopperIcon size={13} />'}
          </div>
        ) : assignedShown.map(p => {
          const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
          return (
            <div key={p.id} className="urgent-row" onClick={() => openPanel(p.id)} style={p.id === selectedPid ? { background: 'var(--bg-active)' } : undefined}>
              <div className="urgent-dot" style={{ background: od ? '#F87171' : st.col }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="urgent-title">{p.title}</div>
                <div className="urgent-client">{[p.client, p.matterType, firstWords(p.area, 3)].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ width: 70 }} title={`${p.progress}%`}>
                <div className="util-track"><div className="util-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div>
              </div>
              <AvStack ids={p.assignees.slice(0, 3)} />
              <Tag {...pr} />
              <Tag {...st} />
              <div className="urgent-due" style={{ color: od ? '#F87171' : 'var(--text-tertiary)', width: 64, textAlign: 'right' }}>{od && <><TriangleAlertIcon size={11} /> </>}{fmtShort(p.due)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>My to-dos</div>

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
            <div style={{ marginBottom: 8 }}><PartyPopperIcon size={32} /></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{emptyTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {filter === 'pending' || filter === 'all' ? 'Use “Add To-do” for personal reminders and checklists.' : 'Check back later.'}
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
          <div className={`tc-chk ${t.done ? 'done' : 'pend'}`} onClick={e => { e.stopPropagation(); toggleTask(t.id); }}>{t.done && <CheckIcon size={12} />}</div>
        </div>
        <div className="tc-main">
          <div className={`tc-title${t.done ? ' done' : ''}`}>{t.title}</div>
          <div className="tc-meta">
            {p && (
              <span className="tc-matter" onClick={e => { e.stopPropagation(); openMatter(p.id); }} title="Open task">
                {p.client} · {firstWords(p.title, 3)}
              </span>
            )}
            {t.time && <span className="tc-time"><ClockIcon size={11} /> {t.time}</span>}
            <span className={`tc-due${od ? ' overdue' : ''}`}>{od && <><TriangleAlertIcon size={11} /> Overdue · </>} {fmtShort(t.due)}</span>
          </div>
        </div>
        <div className="tc-badges">
          {t.isPrivate && (
            <span className="tc-est" style={{ background: 'rgba(124,111,247,0.12)', color: '#7C6FF7', borderColor: 'rgba(124,111,247,0.2)' }}><LockIcon size={10} /> Private</span>
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
                <div className={`tc-sub-chk ${s.done ? 'done' : 'pend'}`} onClick={() => toggleSubtask(t.id, s.id)}>{s.done && <CheckIcon size={10} />}</div>
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
              <button className="btn-ghost" onClick={submitSub} style={{ fontSize: 11, padding: '4px 8px' }}><PlusIcon size={12} /></button>
            </div>
          </div>

          <div className="tc-actions">
            {!t.done
              ? <button className="tc-btn success" onClick={() => toggleTask(t.id)}><CheckIcon size={13} /> Mark Complete</button>
              : <button className="tc-btn default" onClick={() => toggleTask(t.id)}><RotateCcwIcon size={13} /> Reopen</button>}
            {p && <button className="tc-btn default" onClick={() => openMatter(p.id)}><ArrowUpRightIcon size={13} /> Open Task</button>}
            <button className="tc-btn default" onClick={() => setModal({ kind: 'task', id: t.id })}><PencilIcon size={13} /> Edit</button>
            <button className="tc-btn danger" onClick={() => deleteTask(t.id)}><Trash2Icon size={13} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
