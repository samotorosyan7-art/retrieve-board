'use client';

import { useState } from 'react';
import { today, isOpen } from '@/lib/helpers';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';
import { TimerIcon, TriangleAlertIcon } from 'lucide-react';

export function LogTimeModal() {
  const { projects, team, currentUser, addTimeLog, toast, closeModal } = useStore();
  // Admins log time on any open task for anyone; others only for themselves on tasks assigned to them.
  const isAdmin = !!currentUser?.isAdmin;
  const open = projects.filter(p => isOpen(p) && (isAdmin || (!!currentUser && p.assignees.includes(currentUser.id))));
  const [pid, setPid] = useState(open[0]?.id || '');
  const [whoSel, setWho] = useState(currentUser?.id || '');
  const [desc, setDesc] = useState('');
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(today());

  function submit() {
    const h = parseFloat(hours || '0');
    const who = isAdmin ? whoSel : currentUser?.id || '';
    if (!pid || !who || !desc.trim() || !h) { toast(TriangleAlertIcon, 'Missing info', 'Fill in all fields.'); return; }
    const p = addTimeLog(pid, { who, hours: h, desc: desc.trim(), date, month: new Date(date).getMonth() + 1 });
    closeModal();
    toast(TimerIcon, 'Time logged', `${h}h on "${p?.title}"`);
  }

  return (
    <>
      <ModalHeader title="Log Time" sub="Add a time entry to a task" />
      <div className="modal-body">
        <div>
          <label className="form-label">Task</label>
          {open.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>You have no open tasks assigned to you.</div>
          )}
          <select className="input sel" value={pid} onChange={e => setPid(e.target.value)} disabled={!open.length}>
            {open.map(p => <option key={p.id} value={p.id}>{p.title} — {p.client}</option>)}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label className="form-label">Attorney</label>
            <select className="input sel" value={whoSel} onChange={e => setWho(e.target.value)}>
              {team.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div><label className="form-label">Description</label><input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="What did you work on?" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="form-label">Hours</label><input className="input" type="number" step="0.5" min="0.5" placeholder="1.5" value={hours} onChange={e => setHours(e.target.value)} /></div>
          <div><label className="form-label">Date</label><input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <ModalFooter label="Log Entry" onSubmit={submit} />
      </div>
    </>
  );
}
