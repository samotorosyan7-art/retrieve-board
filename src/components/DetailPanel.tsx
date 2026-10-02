'use client';

import { useEffect, useRef, useState } from 'react';
import { FILE_ACCEPT, MATTER_TYPES, MAX_FILE_BYTES, PRIORITIES, STATUSES } from '@/lib/constants';
import { canDeleteMatter, canEditTitle, canMakePrivate, fmtAgo, fmtBytes, fmtDate, fmtDue, isOD, pri, progColor, stat, today } from '@/lib/helpers';
import type { Project } from '@/lib/types';
import { FileRow } from './Attachments';
import { useStore } from './store';
import { Photo } from './ui';
import { ArchiveIcon, CalendarIcon, CircleCheckIcon, CopyIcon, FlagIcon, MessageSquareIcon, PaperclipIcon, SendIcon, GlobeIcon, LinkIcon, LockIcon, PencilIcon, SaveIcon, TagIcon, TimerIcon, Trash2Icon, TriangleAlertIcon, UserCheckIcon, UserPlusIcon, XIcon } from 'lucide-react';

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
    addTimeLog, setAssignees, setSupervisor, renameProject, addActivity, archiveProject, deleteProject, toast,
    comments, loadTaskComments, postComment, removeComment,
    taskFiles, loadFilesFor, uploadTaskFiles, removeTaskFile,
  } = useStore();
  const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
  const isOwner = !p.createdBy || p.createdBy === currentUser?.id;
  const canTogglePrivacy = isOwner && (p.isPrivate || canMakePrivate(currentUser));
  // Admins log time for anyone; everyone else only for themselves, and only on tasks they're assigned to.
  const isAdmin = !!currentUser?.isAdmin;
  const canLogTime = isAdmin || (!!currentUser && p.assignees.includes(currentUser.id));
  const canRename = canEditTitle(p, currentUser);

  const [notes, setNotes] = useState(p.notes || '');
  const [formOpen, setFormOpen] = useState(false);
  const [editAssignees, setEditAssignees] = useState(false);
  const [tfDesc, setTfDesc] = useState('');
  const [tfHours, setTfHours] = useState('');
  const [tfWho, setTfWho] = useState(currentUser?.id || '');
  const [tfBillable, setTfBillable] = useState(true);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const taskComments = comments[p.id] || [];

  useEffect(() => { loadTaskComments(p.id); }, [p.id, loadTaskComments]);
  useEffect(() => { loadFilesFor(p.id); }, [p.id, loadFilesFor]);

  const files = taskFiles[p.id] || [];
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  async function attach(list: FileList | null) {
    if (!list?.length || upload) return;
    await uploadTaskFiles(p.id, [...list], (done, total) => setUpload(total ? { done, total } : null));
    setUpload(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submitComment() {
    if (!commentDraft.trim() || posting) return;
    setPosting(true);
    if (await postComment(p.id, commentDraft)) setCommentDraft('');
    setPosting(false);
  }

  function saveTitle() {
    const title = (titleDraft ?? '').trim();
    setTitleDraft(null);
    if (!title) { toast(TriangleAlertIcon, 'Missing info', 'Task title cannot be empty.'); return; }
    if (renameProject(p.id, title)) toast(PencilIcon, 'Task renamed', title);
  }

  function addTimeEntry() {
    const hours = parseFloat(tfHours || '0');
    const desc = tfDesc.trim();
    const who = isAdmin ? tfWho : currentUser?.id || '';
    if (!canLogTime) return;
    if (!desc || !hours || !who) { toast(TriangleAlertIcon, 'Missing info', 'Please fill in all fields.'); return; }
    addTimeLog(p.id, { who, hours, desc, date: today(), month: new Date().getMonth() + 1, billable: tfBillable });
    addActivity(currentUser?.id || who, `logged <b>${hours}h</b>${tfBillable ? '' : ' (non-billable)'} on <b>${p.title}</b>`);
    toast(TimerIcon, 'Time logged', `${hours}h${tfBillable ? '' : ' non-billable'} added to ${p.title}`);
    setTfDesc(''); setTfHours(''); setTfBillable(true); setFormOpen(false);
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
            {od && <span className="tag" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}><TriangleAlertIcon size={11} /> Overdue</span>}
          </div>
          <button className="dp-close" onClick={closePanel}><XIcon size={14} /></button>
        </div>
        {titleDraft !== null ? (
          <input
            className="input dp-title" autoFocus value={titleDraft} style={{ padding: '4px 8px' }}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setTitleDraft(null); }}
          />
        ) : (
          <div className="dp-title" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span>{p.title}</span>
            {canRename && (
              <button className="btn-ghost" title="Rename task" style={{ padding: '2px 6px', marginTop: 1 }} onClick={() => setTitleDraft(p.title)}>
                <PencilIcon size={12} />
              </button>
            )}
            {canTogglePrivacy ? (
              <button
                className="btn-ghost" style={{ padding: '2px 6px', marginTop: 1, color: p.isPrivate ? '#7C6FF7' : undefined }}
                title={p.isPrivate ? 'Private — only you, its supervisor and admins see it. Click to make public.' : 'Public — the whole team sees it. Click to make private.'}
                onClick={() => togglePrivacy(p.id)}
              >
                {p.isPrivate ? <LockIcon size={12} /> : <GlobeIcon size={12} />}
              </button>
            ) : p.isPrivate && (
              <span title="Private task" style={{ padding: '2px 6px', marginTop: 1, color: '#7C6FF7', display: 'inline-flex' }}><LockIcon size={12} /></span>
            )}
          </div>
        )}
        <div className="dp-client">{p.client} · {p.area}</div>
      </div>

      <div className="dp-body">
        {/* PROGRESS */}
        <div className="dp-section">
          <div className="dp-section-label">Progress</div>
          <div className="dp-prog-val">{p.progress}% complete</div>
          <div className="pbar"><div className="pbar-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div>
          <input type="range" min={0} max={100} value={p.progress} className="prog-slider" onChange={e => setProgress(p.id, +e.target.value)} />
        </div>

        {/* DATES */}
        <div className="dp-section">
          <div className="date-grid">
            <div className="date-box"><div className="db-label">Created</div><div className="db-val">{fmtDate(p.created)}</div></div>
            <div className="date-box" style={od ? { borderColor: 'rgba(248,113,113,0.3)' } : undefined}>
              <div className="db-label">Due Date</div>
              <input
                type="date" value={p.due || ''}
                style={{ ...dueInput, color: od ? 'var(--p-high)' : 'var(--text-primary)' }}
                onChange={e => {
                  const due = e.target.value;
                  // A time only means something with a date.
                  patchProject(p.id, due ? { due } : { due, dueTime: undefined });
                  toast(CalendarIcon, 'Due date updated', fmtDue({ due, dueTime: due ? p.dueTime : undefined }));
                }}
              />
              {p.due && (
                <input
                  type="time" value={p.dueTime || ''} title="Due time (optional)"
                  style={{ ...dueInput, marginTop: 4, color: od ? 'var(--p-high)' : 'var(--text-secondary)' }}
                  onChange={e => {
                    const dueTime = e.target.value || undefined;
                    patchProject(p.id, { dueTime });
                    toast(CalendarIcon, 'Due time updated', fmtDue({ due: p.due, dueTime }));
                  }}
                />
              )}
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

        {/* STATUS + PRIORITY */}
        <div className="dp-section">
          <div className="form-grid">
            <div>
              <div className="dp-section-label">Status</div>
              {/* Supervisor Review asks who reviews it first, so the dropdown keeps showing the saved status until then. */}
              <select
                className="input sel" value={p.status} style={{ color: st.col, fontWeight: 600 }}
                onChange={e => {
                  const s = STATUSES.find(x => x.id === e.target.value)!;
                  if (setStatus(p.id, s.id)) toast(CircleCheckIcon, 'Status updated', `Moved to "${s.label}"`);
                }}
              >
                {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div className="dp-section-label">Priority</div>
              <select
                className="input sel" value={p.priority} style={{ color: pr.col, fontWeight: 600 }}
                onChange={e => {
                  const x = PRIORITIES.find(y => y.id === e.target.value)!;
                  patchProject(p.id, { priority: x.id });
                  toast(FlagIcon, 'Priority updated', x.label);
                }}
              >
                {PRIORITIES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* SUPERVISOR (can be set any time; also asked for when the task moves to Supervisor Review) + TASK TYPE */}
        <div className="dp-section">
          <div className="form-grid">
            <div>
              <div className="dp-section-label">Supervisor</div>
              <select
                className="input sel" value={p.supervisor || ''}
                onChange={e => { setSupervisor(p.id, e.target.value); toast(UserCheckIcon, 'Supervisor updated', emp(e.target.value)?.name || 'None'); }}
              >
                <option value="">— Not set —</option>
                {team.filter(e => !p.assignees.includes(e.id) || e.id === p.supervisor).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <div className="dp-section-label">Task Type</div>
              <select
                className="input sel" value={p.matterType || ''}
                onChange={e => { patchProject(p.id, { matterType: e.target.value }); toast(TagIcon, 'Task type updated', e.target.value || 'None'); }}
              >
                <option value="">— Not set —</option>
                {MATTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
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
            <label className="form-row" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={tfBillable} onChange={e => setTfBillable(e.target.checked)} />
              Billable — include in Billing &amp; Invoices
            </label>
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
                    <div className="tl-meta">{emp(l.who)?.name.split(' ')[0] || ''} · {fmtDate(l.date)}{l.billable === false && ' · Non-billable'}</div>
                  </div>
                  <div className="tl-right"><div className="tl-hours">{l.hours}h</div></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No time logged yet.</div>
          )}
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

        {/* COMMENTS */}
        <div className="dp-section">
          <div className="dp-section-label">Comments{taskComments.length ? ` · ${taskComments.length}` : ''}</div>
          {taskComments.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>No comments yet.</div>}
          {taskComments.map(c => {
            const e = emp(c.who);
            const canDelete = isAdmin || c.who === currentUser?.id;
            return (
              <div key={c.id} className="feed-item">
                <div className="feed-av" style={{ background: e?.color }}><Photo src={e?.img} /></div>
                <div className="feed-content" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="feed-text"><span className="bold">{e?.name || 'Former member'}</span></span>
                    <span className="feed-time" title={new Date(c.time).toLocaleString('en-GB')}>{fmtAgo(c.time)}</span>
                    {canDelete && (
                      <button className="btn-ghost" title="Delete comment" style={{ marginLeft: 'auto', padding: '1px 5px' }} onClick={() => removeComment(p.id, c.id)}>
                        <Trash2Icon size={11} />
                      </button>
                    )}
                  </div>
                  <div className="feed-text" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.text}</div>
                </div>
              </div>
            );
          })}
          <textarea
            className="input" rows={2} placeholder="Write a comment… (⌘/Ctrl + Enter to post)"
            style={{ resize: 'vertical', fontSize: 12.5, lineHeight: 1.6, marginTop: 8 }}
            value={commentDraft} onChange={e => setCommentDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); } }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn-solid" style={{ fontSize: 12, padding: '6px 12px' }} disabled={!commentDraft.trim() || posting} onClick={submitComment}>
              {posting ? <MessageSquareIcon size={12} /> : <SendIcon size={12} />} Add comment
            </button>
          </div>
        </div>

        {/* FILES */}
        <div className="dp-section">
          <div className="dp-section-label">Attachments{files.length ? ` · ${files.length}` : ''}</div>
          <div
            className={`file-drop-zone${dragOver ? ' dragging' : ''}${upload ? ' busy' : ''}`}
            onClick={() => !upload && fileInput.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); attach(e.dataTransfer.files); }}
          >
            <div className="fdz-icon"><PaperclipIcon size={20} /></div>
            <div className="fdz-txt">{upload ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…` : 'Drop files here or click to attach'}</div>
            <div className="fdz-limit">Max {fmtBytes(MAX_FILE_BYTES)} per file</div>
            <div className="fdz-sub">PDF, Office, text, ZIP or images</div>
          </div>
          <input ref={fileInput} type="file" multiple accept={FILE_ACCEPT} hidden onChange={e => attach(e.target.files)} />
          {files.length ? files.map(f => (
            <FileRow
              key={f.id} a={f}
              meta={`${emp(f.who)?.name.split(' ')[0] || 'Former member'} · ${fmtAgo(f.time)}`}
              onDelete={isAdmin || f.who === currentUser?.id ? () => removeTaskFile(p.id, f) : undefined}
            />
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

const dueInput: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-sans)', width: '100%', cursor: 'pointer', display: 'block',
};
