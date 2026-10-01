'use client';

import { useState } from 'react';
import { AREAS, MATTER_TYPES, PRIORITIES, STATUSES } from '@/lib/constants';
import type { PriorityId, StatusId } from '@/lib/types';
import { useStore } from '../store';
import { Photo } from '../ui';
import { ModalFooter, ModalHeader } from './ModalHost';
import { CircleCheckIcon, GlobeIcon, LockIcon, TriangleAlertIcon } from 'lucide-react';

const WORKLOAD_STATUSES = STATUSES.filter(s => s.id === 'intake' || s.id === 'inprogress' || s.id === 'review');

export function MatterModal({ client: initialClient = '' }: { client?: string }) {
  const { team, clients, projects, createProject, toast, closeModal } = useStore();
  const [title, setTitle] = useState('');
  const [client, setClient] = useState(initialClient);
  const [area, setArea] = useState(AREAS[0]);
  const [matterType, setMatterType] = useState('');
  const [priority, setPriority] = useState<PriorityId>('medium');
  const [status, setStatus] = useState<StatusId>('intake');
  const [due, setDue] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [supervisor, setSupervisor] = useState('');

  // One assignee per task: picking someone replaces the previous pick; clicking them again clears it.
  const toggleAssign = (id: string) => {
    setAssignees(a => (a.includes(id) ? [] : [id]));
    if (id === supervisor) setSupervisor('');
  };
  // What the chosen assignee already has on their plate.
  const workload = WORKLOAD_STATUSES.map(s => ({ ...s, n: projects.filter(p => p.status === s.id && p.assignees.includes(assignees[0])).length }));

  function submit() {
    if (!title.trim() || !client.trim()) { toast(TriangleAlertIcon, 'Missing info', 'Title and client are required.'); return; }
    if (status === 'review' && !supervisor) { toast(TriangleAlertIcon, 'Missing info', 'Choose a supervisor for a task in Supervisor Review.'); return; }
    const p = createProject({ title: title.trim(), client: client.trim(), area, matterType, status, priority, assignees, due, notes, isPrivate, supervisor: supervisor || undefined });
    closeModal();
    toast(CircleCheckIcon, 'Task created', `"${p.title}" added to the board.`);
  }

  return (
    <>
      <ModalHeader title="New Task" sub="Add a new task to the board" />
      <div className="modal-body">
        <div>
          <label className="form-label">Task Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Shell Armenia Q3 Tax Compliance" autoFocus />
        </div>
        <div>
          <label className="form-label">Client Name *</label>
          <input className="input" value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. Shell Armenia" list="client-datalist" />
          <datalist id="client-datalist">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
        </div>
        <div className="form-grid">
          <div>
            <label className="form-label">Task Type</label>
            <select className="input sel" value={matterType} onChange={e => setMatterType(e.target.value)}>
              <option value="">— Not set —</option>
              {MATTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Practice Area</label>
            <select className="input sel" value={area} onChange={e => setArea(e.target.value)}>{AREAS.map(a => <option key={a}>{a}</option>)}</select>
          </div>
        </div>
        <div className="form-grid">
          <div>
            <label className="form-label">Priority</label>
            <select className="input sel" value={priority} onChange={e => setPriority(e.target.value as PriorityId)}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="input sel" value={status} onChange={e => setStatus(e.target.value as StatusId)}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div><label className="form-label">Due Date</label><input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
        <div>
          <label className="form-label">Assign To</label>
          <div className="assign-row">
            {team.map(e => (
              <div key={e.id} className={`assign-chip${assignees.includes(e.id) ? ' sel' : ''}`} onClick={() => toggleAssign(e.id)}>
                <div className="ac-mini-av"><Photo src={e.img} /></div>
                <span>{e.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          {assignees[0] && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              <span>{team.find(e => e.id === assignees[0])?.name.split(' ')[0]} currently has:</span>
              {workload.map(s => (
                <span key={s.id} style={{ background: s.bg, color: s.col, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{s.n} {s.label}</span>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="form-label">Supervisor{status === 'review' ? ' *' : ''}</label>
          <select className="input sel" value={supervisor} onChange={e => setSupervisor(e.target.value)}>
            <option value="">— Not set —</option>
            {team.filter(e => !assignees.includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="input" rows={3} placeholder="Key context, deadlines, instructions…" value={notes} onChange={e => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div className={`nm-privacy-row${isPrivate ? ' private' : ''}`}>
          <label className="nm-privacy-label" onClick={() => setIsPrivate(v => !v)}>
            <div className="nm-priv-icon">{isPrivate ? <LockIcon size={20} /> : <GlobeIcon size={20} />}</div>
            <div>
              <div className="nm-priv-title">{isPrivate ? 'Private task' : 'Public task'}</div>
              <div className="nm-priv-sub">{isPrivate ? 'Only visible to you' : 'Visible to your whole team'}</div>
            </div>
            <div className="nm-priv-toggle" />
          </label>
        </div>
        <ModalFooter label="Create Task" onSubmit={submit} />
      </div>
    </>
  );
}
