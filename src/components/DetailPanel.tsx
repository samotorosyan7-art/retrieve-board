'use client';

import { useState } from 'react';
import { MATTER_TYPES, PRIORITIES, STATUSES } from '@/lib/constants';
import { fmtDate, isOD, isTaskOD, pri, progColor, stat, today } from '@/lib/helpers';
import type { Project } from '@/lib/types';
import { useStore } from './store';
import { Photo, Tag } from './ui';

export function DetailPanel() {
  const { projects, selectedPid } = useStore();
  const p = selectedPid ? projects.find(x => x.id === selectedPid) : undefined;
  return (
    <div className={`detail-panel${p ? ' open' : ''}`}>
      {p && <PanelContent key={p.id} p={p} />}
    </div>
  );
}

function PanelContent({ p }: { p: Project }) {
  const {
    currentUser, tasks, team, emp, closePanel, togglePrivacy, setProgress, setStatus, patchProject,
    toggleTask, toggleSubtask, deleteTask, addTimeLog, addActivity, archiveProject, deleteProject, toast,
  } = useStore();
  const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
  const pTasks = tasks.filter(t => t.pid === p.id && (!t.isPrivate || t.who === currentUser?.id));
  const isOwner = !p.createdBy || p.createdBy === currentUser?.id;
  // Admins log time for anyone; everyone else only for themselves, and only on tasks they're assigned to.
  const isAdmin = !!currentUser?.isAdmin;
  const canLogTime = isAdmin || (!!currentUser && p.assignees.includes(currentUser.id));

  const [notes, setNotes] = useState(p.notes || '');
  const [formOpen, setFormOpen] = useState(false);
  const [tfDesc, setTfDesc] = useState('');
  const [tfHours, setTfHours] = useState('');
  const [tfWho, setTfWho] = useState(currentUser?.id || '');

  function addTimeEntry() {
    const hours = parseFloat(tfHours || '0');
    const desc = tfDesc.trim();
    const who = isAdmin ? tfWho : currentUser?.id || '';
    if (!canLogTime) return;
    if (!desc || !hours || !who) { toast('⚠️', 'Missing info', 'Please fill in all fields.'); return; }
    addTimeLog(p.id, { who, hours, desc, date: today(), month: new Date().getMonth() + 1 });
    addActivity(currentUser?.id || who, `logged <b>${hours}h</b> on <b>${p.title}</b>`);
    toast('⏱', 'Time logged', `${hours}h added to ${p.title}`);
    setTfDesc(''); setTfHours(''); setFormOpen(false);
  }

  return (
    <>
      <div className="dp-header">
        <div className="dp-close-row">
          <div className="dp-tags">
            <Tag {...pr} />
            <Tag {...st} />
            {od && <span className="tag" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}>⚠ Overdue</span>}
          </div>
          <button className="dp-close" onClick={closePanel}>✕</button>
        </div>
        <div className="dp-title">{p.title}</div>
        <div className="dp-client" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{p.client} · {p.area}</span>
          {isOwner && (
            <button
              onClick={() => togglePrivacy(p.id)}
              style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 'var(--r-full)', cursor: 'pointer',
                background: p.isPrivate ? 'rgba(124,111,247,0.12)' : 'var(--bg-overlay)',
                color: p.isPrivate ? '#7C6FF7' : 'var(--text-tertiary)',
                border: `1px solid ${p.isPrivate ? 'rgba(124,111,247,0.3)' : 'var(--border-subtle)'}`,
              }}
            >
              {p.isPrivate ? '🔒 Private · make public' : '🌐 Public · make private'}
            </button>
          )}
        </div>
      </div>

      <div className="dp-body">
        {/* PROGRESS */}
        <div className="dp-section">
          <div className="dp-section-label">Progress</div>
          <div className="dp-prog-val">{p.progress}% complete</div>
          <div className="pbar"><div className="pbar-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div>
          <input type="range" min={0} max={100} value={p.progress} className="prog-slider" onChange={e => setProgress(p.id, +e.target.value)} />
        </div>

        {/* STATUS */}
        <div className="dp-section">
          <div className="dp-section-label">Status</div>
          <div className="status-btns">
            {STATUSES.map(s => (
              <button
                key={s.id}
                className="stat-btn"
                style={{ background: p.status === s.id ? s.col : s.bg, color: p.status === s.id ? '#fff' : s.col, borderColor: `${s.col}44` }}
                onClick={() => { setStatus(p.id, s.id); toast('✅', 'Status updated', `Moved to "${s.label}"`); }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* PRIORITY */}
        <div className="dp-section">
          <div className="dp-section-label">Priority</div>
          <div className="status-btns">
            {PRIORITIES.map(x => (
              <button
                key={x.id}
                className="stat-btn"
                style={{ background: p.priority === x.id ? x.col : x.bg, color: p.priority === x.id ? '#fff' : x.col, borderColor: `${x.col}44` }}
                onClick={() => { if (p.priority !== x.id) { patchProject(p.id, { priority: x.id }); toast('🚩', 'Priority updated', x.label); } }}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        {/* MATTER TYPE */}
        <div className="dp-section">
          <div className="dp-section-label">Task Type</div>
          <select
            className="input sel" value={p.matterType || ''}
            onChange={e => { patchProject(p.id, { matterType: e.target.value }); toast('🏷', 'Task type updated', e.target.value || 'None'); }}
          >
            <option value="">— Not set —</option>
            {MATTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* DATES */}
        <div className="dp-section">
          <div className="date-grid">
            <div className="date-box"><div className="db-label">Created</div><div className="db-val">{fmtDate(p.created)}</div></div>
            <div className="date-box" style={od ? { borderColor: 'rgba(248,113,113,0.3)' } : undefined}>
              <div className="db-label">Due Date</div>
              <input
                type="date" value={p.due || ''}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: od ? 'var(--p-high)' : 'var(--text-primary)', fontFamily: 'var(--font-sans)', width: '100%', cursor: 'pointer' }}
                onChange={e => { patchProject(p.id, { due: e.target.value }); toast('📅', 'Due date updated', fmtDate(e.target.value)); }}
              />
            </div>
          </div>
        </div>

        {/* ASSIGNEES */}
        <div className="dp-section">
          <div className="dp-section-label">Assigned to</div>
          {p.assignees.map(id => {
            const e = emp(id);
            if (!e) return null;
            return (
              <div className="assignee-chip" key={id}>
                <div className="ac-av"><Photo src={e.img} /></div>
                <div><div className="ac-name">{e.name}</div><div className="ac-meta">{e.role}</div></div>
              </div>
            );
          })}
        </div>

        {/* NOTES */}
        <div className="dp-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <div className="dp-section-label" style={{ marginBottom: 0 }}>Notes</div>
            <button
              className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 9px' }}
              onClick={() => { patchProject(p.id, { notes: notes.trim() }); toast('💾', 'Notes saved', 'Task notes updated.'); }}
            >
              Save
            </button>
          </div>
          <textarea className="input" rows={3} style={{ resize: 'vertical', fontSize: 12.5, lineHeight: 1.6 }} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* TASKS */}
        {pTasks.length > 0 && (
          <div className="dp-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <div className="dp-section-label" style={{ marginBottom: 0 }}>To-dos ({pTasks.length})</div>
            </div>
            {pTasks.map(t => {
              const e = emp(t.who), tpr = pri(t.priority || 'medium');
              const subs = t.subtasks || [];
              const doneS = subs.filter(s => s.done).length;
              const tod = isTaskOD(t);
              return (
                <div className="dp-task-item" key={t.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div className={`dti-chk ${t.done ? 'done' : 'pend'}`} onClick={() => toggleTask(t.id)}>{t.done ? '✓' : ''}</div>
                    <div style={{ flex: 1 }}>
                      <div className={`dti-title${t.done ? ' done' : ''}`}>{t.title}</div>
                      <div className="dti-due" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
                        <span>{e?.name.split(' ')[0] || ''}</span>
                        {t.time && <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-overlay)', padding: '0 5px', borderRadius: 3 }}>{t.time}</span>}
                        <span style={{ color: tod ? 'var(--p-high)' : 'var(--text-tertiary)' }}>{tod ? '⚠ ' : ''}Due {fmtDate(t.due)}</span>
                        {!!t.estHours && <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{t.estHours}h est.</span>}
                      </div>
                    </div>
                    <Tag {...tpr} />
                    <button
                      title="Delete to-do" onClick={() => deleteTask(t.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--p-high)', opacity: 0.75, padding: '0 2px' }}
                    >
                      🗑
                    </button>
                  </div>
                  {subs.length > 0 && (
                    <div style={{ paddingLeft: 28 }}>
                      <div style={{ marginBottom: 4 }}>
                        <div className="util-track">
                          <div className="util-fill" style={{ width: `${Math.round((doneS / subs.length) * 100)}%`, background: doneS === subs.length ? 'var(--s-done)' : 'var(--s-inprogress)' }} />
                        </div>
                      </div>
                      {subs.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div className={`tc-sub-chk ${s.done ? 'done' : 'pend'}`} onClick={() => toggleSubtask(t.id, s.id)}>{s.done ? '✓' : ''}</div>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', textDecoration: s.done ? 'line-through' : undefined, flex: 1 }}>{s.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* TIME LOG */}
        <div className="dp-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <div className="dp-section-label" style={{ marginBottom: 0 }}>Time Log</div>
            {canLogTime && (
              <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setFormOpen(o => !o)}>+ Log Time</button>
            )}
          </div>
          <div className={`time-entry-form${formOpen ? ' open' : ''}`}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Log Time Entry</div>
            <div className="form-row">
              <label className="form-label">Description</label>
              <input className="input" placeholder="What did you work on?" value={tfDesc} onChange={e => setTfDesc(e.target.value)} />
            </div>
            <div className="time-form-row">
              <div>
                <label className="form-label">Hours</label>
                <input className="input" type="number" step="0.5" min="0.5" placeholder="2.5" value={tfHours} onChange={e => setTfHours(e.target.value)} />
              </div>
              {isAdmin && (
                <div>
                  <label className="form-label">Attorney</label>
                  <select className="input sel" value={tfWho} onChange={e => setTfWho(e.target.value)}>
                    {team.map(e => <option key={e.id} value={e.id}>{e.name.split(' ')[0]}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                <button className="btn-solid" style={{ whiteSpace: 'nowrap' }} onClick={addTimeEntry}>Add</button>
                <button className="btn-cancel" onClick={() => setFormOpen(false)}>✕</button>
              </div>
            </div>
          </div>
          {p.timeLogs.length ? (
            <div className="time-log-wrap">
              {p.timeLogs.map((l, i) => (
                <div className="tl-row" key={i}>
                  <div className="tl-left">
                    <div className="tl-desc">{l.desc}</div>
                    <div className="tl-meta">{emp(l.who)?.name.split(' ')[0] || ''} · {fmtDate(l.date)}</div>
                  </div>
                  <div className="tl-right"><div className="tl-hours">{l.hours}h</div></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No time logged yet.</div>
          )}
        </div>

        {/* FILES */}
        <div className="dp-section">
          <div className="dp-section-label">Files &amp; Documents</div>
          <div className="file-drop-zone" onClick={() => toast('📂', 'File attached', 'In production: uploads to Google Drive folder for this task.')}>
            <div className="fdz-icon">📎</div>
            <div className="fdz-txt">Drop files here or click to attach</div>
            <div className="fdz-sub">Auto-syncs to Google Drive · {p.client} folder</div>
          </div>
          {(p.files || []).length ? p.files.map((f, i) => (
            <div className="file-row" key={i}>
              <span className="file-icon">📄</span>
              <span className="file-name">{f.name}</span>
              <span className="file-size">{f.size}</span>
              {f.drive && <span className="file-drive-badge">✓ Drive</span>}
            </div>
          )) : <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>No files attached.</div>}
        </div>

        {/* ACTIONS */}
        <div className="dp-section" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="dp-action-btn primary" onClick={() => toast('✉️', 'Team notified', 'Task emails sent to all assignees.')}>✉️ Notify Team</button>
          <button className="dp-action-btn default" onClick={() => toast('📋', 'Copied', 'Task link copied to clipboard.')}>🔗 Copy Link</button>
          {p.status !== 'archive' && (
            <button className="dp-action-btn default" onClick={() => archiveProject(p.id)}>🗄 Archive Task</button>
          )}
          {currentUser?.isAdmin && (
            <button className="dp-action-btn danger" onClick={() => deleteProject(p.id)}>🗑 Delete Task</button>
          )}
        </div>
      </div>
    </>
  );
}
