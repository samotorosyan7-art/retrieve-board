'use client';

import { useStore } from '../store';
import { ClientModal } from './ClientModal';
import { LogTimeModal } from './LogTimeModal';
import { MatterModal } from './MatterModal';
import { MemberModal } from './MemberModal';
import { SupervisorModal } from './SupervisorModal';
import { XIcon } from 'lucide-react';

export function ModalHost() {
  const { modal, closeModal } = useStore();
  return (
    <div className={`modal-backdrop${modal ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
      <div className="modal-box">
        {modal?.kind === 'matter' && <MatterModal client={modal.client} />}
        {modal?.kind === 'logTime' && <LogTimeModal />}
        {modal?.kind === 'client' && <ClientModal key={modal.id ?? 'new'} id={modal.id} onSaved={modal.onSaved} />}
        {modal?.kind === 'member' && <MemberModal key={modal.id ?? 'new'} id={modal.id} />}
        {modal?.kind === 'supervisor' && <SupervisorModal key={modal.pid} pid={modal.pid} />}
      </div>
    </div>
  );
}

export function ModalHeader({ title, sub }: { title: string; sub: string }) {
  const { closeModal } = useStore();
  return (
    <div className="modal-hdr">
      <div><div className="modal-title">{title}</div><div className="modal-sub">{sub}</div></div>
      <button className="dp-close" onClick={closeModal}><XIcon size={14} /></button>
    </div>
  );
}

export function ModalFooter({ label, onSubmit }: { label: string; onSubmit: () => void }) {
  const { closeModal } = useStore();
  return (
    <div className="modal-foot">
      <button className="btn-cancel" onClick={closeModal}>Cancel</button>
      <button className="btn-submit" onClick={onSubmit}>{label}</button>
    </div>
  );
}
