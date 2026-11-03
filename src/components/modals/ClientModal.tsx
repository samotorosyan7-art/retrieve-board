'use client';

import { useState } from 'react';
import { CLIENT_TYPES } from '@/lib/constants';
import { fmtCurrency, today } from '@/lib/helpers';
import { timeCharges } from '@/lib/invoice';
import type { Client, Currency } from '@/lib/types';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';
import { CircleCheckIcon, TriangleAlertIcon } from 'lucide-react';

const EMPTY: Omit<Client, 'id'> = {
  name: '', type: 'Corporate', contact: '', email: '', phone: '', address: '', taxId: '', notes: '', since: '',
};

export function ClientModal({ id, onSaved }: { id: string | null; onSaved?: (id: string) => void }) {
  const { clients, saveClient, clientBilling, saveClientBilling, currentUser, toast, closeModal } = useStore();
  const isAdmin = !!currentUser?.isAdmin;
  const existing = id ? clients.find(c => c.id === id) : undefined;
  const [c, setC] = useState<Omit<Client, 'id'>>(existing ?? { ...EMPTY, since: today() });
  const set = (k: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setC(prev => ({ ...prev, [k]: e.target.value }));
  // Billing terms (admins only) — typed as strings so fields can be left empty.
  const savedTerms = existing ? clientBilling[existing.id] : undefined;
  const [currency, setCurrency] = useState<Currency>(savedTerms?.currency ?? 'AMD');
  const [terms, setTerms] = useState({
    hourlyRate: savedTerms?.hourlyRate ? String(savedTerms.hourlyRate) : '',
    regularHours: savedTerms?.regularHours ? String(savedTerms.regularHours) : '',
    monthlyFee: savedTerms?.monthlyFee ? String(savedTerms.monthlyFee) : '',
  });
  const setTerm = (k: keyof typeof terms) => (e: React.ChangeEvent<HTMLInputElement>) => setTerms(t => ({ ...t, [k]: e.target.value }));
  const termNums = {
    hourlyRate: Math.max(0, parseFloat(terms.hourlyRate) || 0),
    regularHours: Math.max(0, parseFloat(terms.regularHours) || 0),
    monthlyFee: Math.max(0, parseFloat(terms.monthlyFee) || 0),
  };

  function submit() {
    const name = c.name.trim(), contact = c.contact.trim();
    if (!name || !contact) { toast(TriangleAlertIcon, 'Required', 'Client name and contact are required.'); return; }
    const data: Client = {
      ...c, id: existing?.id ?? 'c' + Date.now(), name, contact,
      email: c.email.trim(), phone: c.phone.trim(), taxId: c.taxId.trim(), address: c.address.trim(),
      notes: c.notes.trim(), since: c.since || today(),
    };
    const saved = saveClient(data);
    const termsChanged = savedTerms
      ? savedTerms.currency !== currency || (Object.keys(termNums) as (keyof typeof termNums)[]).some(k => savedTerms[k] !== termNums[k])
      : termNums.hourlyRate > 0 || termNums.regularHours > 0 || termNums.monthlyFee > 0;
    // The terms reference the client row, so they're written once it's saved.
    if (isAdmin && termsChanged) saved.then(ok => ok && saveClientBilling({ clientId: data.id, currency, ...termNums }));
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
        {isAdmin && (
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Billing terms</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Admins only — used for this client&apos;s monthly time invoice.</div>
              </div>
              <div className="seg-ctrl">
                {(['AMD', 'USD', 'EUR'] as Currency[]).map(x => (
                  <button key={x} type="button" className={`seg-btn${currency === x ? ' active' : ''}`} onClick={() => setCurrency(x)}>{x}</button>
                ))}
              </div>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div><label className="form-label">Hourly rate ({currency})</label><input className="input" type="number" min={0} step={currency === 'AMD' ? 1000 : 10} value={terms.hourlyRate} onChange={setTerm('hourlyRate')} placeholder={currency === 'AMD' ? 'e.g. 50000' : 'e.g. 200'} /></div>
              <div><label className="form-label">Regular hours under retainer</label><input className="input" type="number" min={0} step={1} value={terms.regularHours} onChange={setTerm('regularHours')} placeholder="e.g. 12" /></div>
              <div><label className="form-label">Monthly retainer ({currency})</label><input className="input" type="number" min={0} step={currency === 'AMD' ? 1000 : 10} value={terms.monthlyFee} onChange={setTerm('monthlyFee')} placeholder={currency === 'AMD' ? 'e.g. 500000' : 'e.g. 2000'} /></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {termNums.monthlyFee > 0 || termNums.regularHours > 0
                ? <>The monthly retainer covers the first {termNums.regularHours}h; hours above that are billed at the hourly rate.
                    {' '}E.g. {termNums.regularHours + 2}h logged → {fmtCurrency(timeCharges(termNums, termNums.regularHours + 2).sub, currency)}.</>
                : 'With no regular hours under retainer or monthly retainer, every hour logged is billed at the hourly rate.'}
            </div>
          </div>
        )}
        <div>
          <label className="form-label">Internal Notes</label>
          <textarea className="input" rows={3} value={c.notes} onChange={set('notes')} placeholder="Key info, relationship context…" style={{ resize: 'vertical' }} />
        </div>
        <ModalFooter label={existing ? 'Save Changes' : 'Add Client'} onSubmit={submit} />
      </div>
    </>
  );
}
