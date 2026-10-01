'use client';

import { useState } from 'react';
import { CLIENT_TYPES } from '@/lib/constants';
import { today } from '@/lib/helpers';
import type { Client } from '@/lib/types';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';

const EMPTY: Omit<Client, 'id'> = {
  name: '', type: 'Corporate', contact: '', email: '', phone: '', address: '', taxId: '', notes: '', since: '',
};

export function ClientModal({ id, onSaved }: { id: string | null; onSaved?: (id: string) => void }) {
  const { clients, saveClient, toast, closeModal } = useStore();
  const existing = id ? clients.find(c => c.id === id) : undefined;
  const [c, setC] = useState<Omit<Client, 'id'>>(existing ?? { ...EMPTY, since: today() });
  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setC(prev => ({ ...prev, [k]: e.target.value }));

  function submit() {
    const name = c.name.trim(), contact = c.contact.trim();
    if (!name || !contact) { toast(TriangleAlertIcon, 'Required', 'Client name and contact are required.'); return; }
    const data: Client = {
      ...c, id: existing?.id ?? 'c' + Date.now(), name, contact,
      email: c.email.trim(), phone: c.phone.trim(), taxId: c.taxId.trim(), address: c.address.trim(),
      notes: c.notes.trim(), since: c.since || today(),
    };
    saveClient(data);
    toast(CircleCheckIcon, existing ? 'Client updated' : 'Client added', existing ? `${name} saved.` : `${name} added to your roster.`);
    onSaved?.(data.id);
    closeModal();
  }

  return (
    <>
      <ModalHeader
        title={existing ? 'Edit Client' : 'Add New Client'}
        sub={existing ? 'Update contact details' : 'Add a new client to your roster'}
      />
      <div className="modal-body">
        <div className="form-grid">
          <div style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Client / Company Name *</label>
            <input className="input" value={c.name} onChange={set('name')} placeholder="e.g. Shell Armenia" autoFocus />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Type</label>
            <select className="input sel" value={c.type} onChange={set('type')}>
              {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid">
          <div><label className="form-label">Primary Contact Name *</label><input className="input" value={c.contact} onChange={set('contact')} placeholder="e.g. Armen Mkrtchyan" /></div>
          <div><label className="form-label">Email Address</label><input className="input" type="email" value={c.email} onChange={set('email')} placeholder="contact@company.am" /></div>
        </div>
        <div className="form-grid">
          <div><label className="form-label">Phone Number</label><input className="input" type="tel" value={c.phone} onChange={set('phone')} placeholder="+374 10 123456" /></div>
          <div><label className="form-label">Tax ID / TIN</label><input className="input" value={c.taxId} onChange={set('taxId')} placeholder="AM-001122" /></div>
        </div>
        <div><label className="form-label">Address</label><input className="input" value={c.address} onChange={set('address')} placeholder="Street, City, Country" /></div>
        <div><label className="form-label">Client Since</label><input className="input" type="date" value={c.since} onChange={set('since')} /></div>
        <div>
          <label className="form-label">Internal Notes</label>
          <textarea className="input" rows={3} value={c.notes} onChange={set('notes')} placeholder="Key info, relationship context…" style={{ resize: 'vertical' }} />
        </div>
        <ModalFooter label={existing ? 'Save Changes' : 'Add Client'} onSubmit={submit} />
      </div>
    </>
  );
}
