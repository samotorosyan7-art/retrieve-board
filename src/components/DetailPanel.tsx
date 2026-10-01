'use client';

import { useState } from 'react';
import { MATTER_TYPES, PRIORITIES, STATUSES } from '@/lib/constants';
import { canDeleteMatter, canMakePrivate, fmtDate, isOD, pri, progColor, stat, today } from '@/lib/helpers';
import type { Project } from '@/lib/types';
import { useStore } from './store';
import { Photo, Tag } from './ui';
import { ArchiveIcon, CalendarIcon, CheckIcon, CircleCheckIcon, CopyIcon, FileTextIcon, FlagIcon, GlobeIcon, LinkIcon, LockIcon, PaperclipIcon, SaveIcon, TagIcon, TimerIcon, Trash2Icon, TriangleAlertIcon, UserCheckIcon, UserPlusIcon, XIcon } from 'lucide-react';

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
    currentUser, team, emp, closePanel, togglePrivacy, setProgress, setStatus, patchProject,
    addTimeLog, setAssignees, setSupervisor, addActivity, archiveProject, deleteProject, toast,
  } = useStore();
  const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
  const isOwner = !p.createdBy || p.createdBy === currentUser?.id;
  const canTogglePrivacy = isOwner && (p.isPrivate || canMakePrivate(currentUser));
  // Admins log time for anyone; everyone else only for themselves, and only on tasks they're assigned to.
  const isAdmin = !!currentUser?.isAdmin;
  const canLogTime = isAdmin || (!!currentUser && p.assignees.includes(currentUser.id));

  const [notes, setNotes] = useState(p.notes || '');
  const [formOpen, setFormOpen] = useState(false);
  const [editAssignees, setEditAssignees] = useState(false);
  const [tfDesc, setTfDesc] = useState('');
  const [tfHours, setTfHours] = useState('');
  const [tfWho, setTfWho] = useState(currentUser?.id || '');

  function addTimeEntry() {
    const hours = parseFloat(tfHours || '0');
    const desc = tfDesc.trim();
    const who = isAdmin ? tfWho : currentUser?.id || '';
    if (!canLogTime) return;
    if (!desc || !hours || !who) { toast(TriangleAlertIcon, 'Missing info', 'Please fill in all fields.'); return; }
    addTimeLog(p.id, { who, hours, desc, date: today(), month: new Date().getMonth() + 1 });
    addActivity(currentUser?.id || who, `logged <b>${hours}h</b> on <b>${p.title}</b>`);
    toast(TimerIcon, 'Time logged', `${hours}h added to ${p.title}`);
    setTfDesc(''); setTfHours(''); setFormOpen(false);
  }

  /** A link that opens All Tasks with this task's panel (see OpenTaskFromUrl). Only people who can see the task can open it. */
  async function copyLink() {
    const url = `${location.origin}/list?task=${encodeURIComponent(p.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(CopyIcon, 'Link copied', 'Paste it anywhere to share this task.');
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <>
      <div className="dp-header">
        <div className="dp-close-row">
          <div className="dp-tags">
            <Tag {...pr} />
            <Tag {...st} />
            {od && <span className="tag" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}><TriangleAlertIcon size={11} /> Overdue</span>}
          </div>
          <button className="dp-close" onClick={closePanel}><XIcon size={14} /></button>
        </div>
        <div className="dp-title">{p.title}</div>
        <div className="dp-client" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{p.client} · {p.area}</span>
          {canTogglePrivacy && (
            <button
              onClick={() => togglePrivacy(p.id)}
              style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 'var(--r-full)', cursor: 'pointer',
                background: p.isPrivate ? 'rgba(124,111,247,0.12)' : 'var(--bg-overlay)',
                color: p.isPrivate ? '#7C6FF7' : 'var(--text-tertiary)',
                border: `1px solid ${p.isPrivate ? 'rgba(124,111,247,0.3)' : 'var(--border-subtle)'}`,
              }}
            >
              {p.isPrivate ? <><LockIcon size={12} /> Private · make public</> : <><GlobeIcon size={12} /> Public · make private</>}
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
                onClick={() => { if (setStatus(p.id, s.id)) toast(CircleCheckIcon, 'Status updated', `Moved to "${s.label}"`); }}
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
                onClick={() => { if (p.priority !== x.id) { patchProject(p.id, { priority: x.id }); toast(FlagIcon, 'Priority updated', x.label); } }}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>

        {/* SUPERVISOR — chosen when the task moves to Supervisor Review; changeable while it's there. */}
        {p.status === 'review' && <div className="dp-section">
          <div className="dp-section-label">Supervisor</div>
          <select
            className="input sel" value={p.supervisor || ''}
            onChange={e => { setSupervisor(p.id, e.target.value); toast(UserCheckIcon, 'Supervisor updated', emp(e.target.value)?.name || 'None'); }}
          >
            <option value="">— Not set —</option>
            {team.filter(e => !p.assignees.includes(e.id) || e.id === p.supervisor).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>}

        {/* MATTER TYPE */}
        <div className="dp-section">
          <div className="dp-section-label">Task Type</div>
          <select
            className="input sel" value={p.matterType || ''}
            onChange={e => { patchProject(p.id, { matterType: e.target.value }); toast(TagIcon, 'Task type updated', e.target.value || 'None'); }}
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
                onChange={e => { patchProject(p.id, { due: e.target.value }); toast(CalendarIcon, 'Due date updated', fmtDate(e.target.value)); }}
              />
            </div>
          </div>
        </div>

        {/* ASSIGNEES */}
        <div className="dp-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <div className="dp-section-label" style={{ marginBottom: 0 }}>Assigned to</div>
            {isAdmin && (
              <button className="btn-ghost" style={{ fontSize: 10.5, padding: '3px 9px' }} onClick={() => setEditAssignees(v => !v)}>
                {editAssignees ? 'Done' : <><UserPlusIcon size={12} /> Reassign</>}
              </button>
            )}
          </div>
          {editAssignees && (
            <div className="assign-row" style={{ marginBottom: 10 }}>
              {team.map(e => {
                const on = p.assignees.includes(e.id);
                return (
                  <div
                    key={e.id} className={`assign-chip${on ? ' sel' : ''}`}
                    onClick={() => { setAssignees(p.id, on ? [] : [e.id]); setEditAssignees(false); }}
                  >
                    <div className="ac-mini-av"><Photo src={e.img} /></div>
                    <span>{e.name.split(' ')[0]}</span>
                  </div>
                );
              })}
            </div>
          )}
          {p.assignees.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Nobody assigned yet.</div>}
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
              onClick={() => { patchProject(p.id, { notes: notes.trim() }); toast(SaveIcon, 'Notes saved', 'Task notes updated.'); }}
            >
              Save
            </button>
          </div>
          <textarea className="input" rows={3} style={{ resize: 'vertical', fontSize: 12.5, lineHeight: 1.6 }} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

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
                <button className="btn-cancel" onClick={() => setFormOpen(false)}><XIcon size={14} /></button>
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
          <div className="file-drop-zone" onClick={() => toast(PaperclipIcon, 'File attached', 'In production: uploads to Google Drive folder for this task.')}>
            <div className="fdz-icon"><PaperclipIcon size={22} /></div>
            <div className="fdz-txt">Drop files here or click to attach</div>
            <div className="fdz-sub">Auto-syncs to Google Drive · {p.client} folder</div>
          </div>
          {(p.files || []).length ? p.files.map((f, i) => (
            <div className="file-row" key={i}>
              <span className="file-icon"><FileTextIcon size={16} /></span>
              <span className="file-name">{f.name}</span>
              <span className="file-size">{f.size}</span>
              {f.drive && <span className="file-drive-badge"><CheckIcon size={10} /> Drive</span>}
            </div>
          )) : <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>No files attached.</div>}
        </div>

        {/* ACTIONS */}
        <div className="dp-section" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="dp-action-btn default" onClick={copyLink}><LinkIcon size={14} /> Copy Link</button>
          {p.status !== 'archive' && (
            <button className="dp-action-btn default" onClick={() => archiveProject(p.id)}><ArchiveIcon size={14} /> Archive Task</button>
          )}
          {canDeleteMatter(p, currentUser) && (
            <button className="dp-action-btn danger" onClick={() => deleteProject(p.id)}><Trash2Icon size={14} /> Delete Task</button>
          )}
        </div>
      </div>
    </>
  );
}
