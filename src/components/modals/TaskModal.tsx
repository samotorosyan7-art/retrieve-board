'use client';

import { useState } from 'react';
import { PRIORITIES } from '@/lib/constants';
import { sendTaskAssignmentEmail } from '@/lib/email';
import type { PriorityId, Task } from '@/lib/types';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';
import { CircleCheckIcon, MailIcon, TriangleAlertIcon } from 'lucide-react';

export function TaskModal({ id }: { id: string | null }) {
  const { tasks, projects, currentUser, emp, saveTask, toast, closeModal } = useStore();
  const t = id ? tasks.find(x => x.id === id) : undefined;

  const [title, setTitle] = useState(t?.title || '');
  const [pid, setPid] = useState(t?.pid || '');
  const [priority, setPriority] = useState<PriorityId>(t?.priority || 'medium');
  const [due, setDue] = useState(t?.due || '');
  const [time, setTime] = useState(t?.time || '');
  const [est, setEst] = useState(t?.estHours ? String(t.estHours) : '');
  const [notes, setNotes] = useState(t?.notes || '');

  function submit() {
    if (!title.trim()) { toast(TriangleAlertIcon, 'Required', 'A title is required.'); return; }
    const data = { title: title.trim(), pid, priority, due, time, estHours: parseFloat(est || '0') || 0, notes: notes.trim() };
    const task: Task = t
      ? { ...t, ...data }
      : { id: 't' + Date.now(), who: currentUser?.id || 'fh', done: false, subtasks: [], ...data };
    saveTask(task);
    sendTaskAssignmentEmail(task, emp(task.who), currentUser, projects.find(p => p.id === task.pid)).then(sent => {
      if (sent) toast(MailIcon, 'Email sent', `${emp(task.who)?.name.split(' ')[0]} notified of a new to-do.`);
    });
    toast(CircleCheckIcon, t ? 'To-do updated' : 'To-do added', data.title);
    closeModal();
  }

  return (
    <>
      <ModalHeader title={t ? 'Edit To-do' : 'New To-do'} sub={t ? 'Update to-do details' : 'Add a to-do to your list'} />
      <div className="modal-body">
        <div>
          <label className="form-label">Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
        </div>
        <div className="form-grid">
          <div>
            <label className="form-label">Task</label>
            <select className="input sel" value={pid} onChange={e => setPid(e.target.value)}>
              <option value="">— No task —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title.split(' ').slice(0, 4).join(' ')} — {p.client}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Priority</label>
            <select className="input sel" value={priority} onChange={e => setPriority(e.target.value as PriorityId)}>
              {PRIORITIES.map(pr => <option key={pr.id} value={pr.id}>{pr.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid">
          <div><label className="form-label">Due Date</label><input className="input" type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
          <div><label className="form-label">Time (optional)</label><input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} /></div>
        </div>
        <div>
          <label className="form-label">Est. Hours</label>
          <input className="input" type="number" step="0.5" min="0" value={est} onChange={e => setEst(e.target.value)} placeholder="e.g. 2.5" />
        </div>
        <div>
          <label className="form-label">Notes</label>
          <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <ModalFooter label={t ? 'Save Changes' : 'Add To-do'} onSubmit={submit} />
      </div>
    </>
  );
}
