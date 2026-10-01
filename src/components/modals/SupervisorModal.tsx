'use client';

import { useState } from 'react';
import { useStore } from '../store';
import { Photo } from '../ui';
import { ModalFooter, ModalHeader } from './ModalHost';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';

/** Opens when a task is moved to Supervisor Review: pick who reviews it. Cancelling leaves the status as it was. */
export function SupervisorModal({ pid }: { pid: string }) {
  const { projects, team, sendToReview, toast, closeModal } = useStore();
  const p = projects.find(x => x.id === pid);
  const [supervisor, setSupervisor] = useState(p?.supervisor || '');
  if (!p) return null;
  // The people doing the work don't review it.
  const candidates = team.filter(e => !p.assignees.includes(e.id));
  const reviewing = (id: string) => projects.filter(x => x.status === 'review' && x.supervisor === id && x.id !== pid).length;

  function submit() {
    if (!supervisor) { toast(TriangleAlertIcon, 'Choose a supervisor', 'Pick who should review this task.'); return; }
    sendToReview(pid, supervisor);
    closeModal();
    toast(CircleCheckIcon, 'Sent for review', `"${p!.title}" is now in ${team.find(e => e.id === supervisor)?.name.split(' ')[0]}'s tasks.`);
  }

  return (
    <>
      <ModalHeader title="Supervisor Review" sub={`Who should review "${p.title}"?`} />
      <div className="modal-body">
        <div>
          <label className="form-label">Supervisor *</label>
          <div className="assign-row">
            {candidates.map(e => {
              const n = reviewing(e.id);
              return (
                <div key={e.id} className={`assign-chip${supervisor === e.id ? ' sel' : ''}`} onClick={() => setSupervisor(e.id)} title={`${n} other task${n !== 1 ? 's' : ''} awaiting their review`}>
                  <div className="ac-mini-av"><Photo src={e.img} /></div>
                  <span>{e.name.split(' ')[0]}{n > 0 && <span style={{ opacity: 0.6 }}> · {n}</span>}</span>
                </div>
              );
            })}
          </div>
        </div>
        <ModalFooter label="Send for Review" onSubmit={submit} />
      </div>
    </>
  );
}
