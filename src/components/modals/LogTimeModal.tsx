'use client';

import { useState } from 'react';
import { today, isOpen } from '@/lib/helpers';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';
import { PencilIcon, TimerIcon, TriangleAlertIcon } from 'lucide-react';

/** Logs a new entry, or with `editPid` and `editIndex` edits that existing entry (it stays on its task). */
export function LogTimeModal({ editPid, editIndex }: { editPid?: string; editIndex?: number }) {
  const { projects, team, currentUser, addTimeLog, updateTimeLog, toast, closeModal } = useStore();
  const editTask = editPid ? projects.find(p => p.id === editPid) : undefined;
  const [original] = useState(() => (editIndex === undefined ? undefined : editTask?.timeLogs[editIndex]));
  // Admins log time on any open task for anyone; others only for themselves on tasks assigned to them.
  const isAdmin = !!currentUser?.isAdmin;
  const open = editTask ? [editTask] : projects.filter(p => isOpen(p) && (isAdmin || (!!currentUser && p.assignees.includes(currentUser.id))));
  const [pid, setPid] = useState(open[0]?.id || '');
  const [whoSel, setWho] = useState(original?.who || currentUser?.id || '');
  const [desc, setDesc] = useState(original?.desc || '');
  const [hours, setHours] = useState(original ? String(original.hours) : '');
  const [date, setDate] = useState(original?.date || today());
  const [billable, setBillable] = useState(original?.billable !== false);

  function submit() {
    const h = parseFloat(hours || '0');
    const who = isAdmin ? whoSel : original?.who || currentUser?.id || '';
    if (!pid || !who || !desc.trim() || !h || !date) { toast(TriangleAlertIcon, 'Missing info', 'Fill in all fields.'); return; }
    const log = { who, hours: h, desc: desc.trim(), date, month: new Date(date).getMonth() + 1, billable };
    if (original && editIndex !== undefined) {
      // Keep the rest of the entry (e.g. whether an admin left it off the invoice).
      const p = updateTimeLog(pid, editIndex, original, { ...original, ...log });
      if (!p) return;
      closeModal();
      toast(PencilIcon, 'Time entry updated', `${h}h${billable ? '' : ' non-billable'} on "${p.title}"`);
      return;
    }
    const p = addTimeLog(pid, log);
    closeModal();
    toast(TimerIcon, 'Time logged', `${h}h${billable ? '' : ' non-billable'} on "${p?.title}"`);
  }

  if (editPid && !original) {
    return (
      <>
        <ModalHeader title="Edit Time Entry" sub="This time entry no longer exists" />
        <div className="modal-body"><ModalFooter label="Close" onSubmit={closeModal} /></div>
      </>
    );
  }

  return (
    <>
      <ModalHeader title={original ? 'Edit Time Entry' : 'Log Time'} sub={original ? `On "${editTask?.title}"` : 'Add a time entry to a task'} />
      <div className="modal-body">
        <div>
          <label className="form-label">Task</label>
          {open.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '6px 0' }}>You have no open tasks assigned to you.</div>
          )}
          <select className="input sel" value={pid} onChange={e => setPid(e.target.value)} disabled={!open.length || !!original}>
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} />
          Billable — include in Billing &amp; Invoices
        </label>
        <ModalFooter label={original ? 'Save Changes' : 'Log Entry'} onSubmit={submit} />
      </div>
    </>
  );
}
