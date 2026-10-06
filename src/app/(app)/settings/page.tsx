'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { homePath } from '@/lib/helpers';
import { PageHeader, Photo } from '@/components/ui';
import { PAYMENT_TERMS } from '@/lib/constants';
import type { BankAccount, FirmSettings } from '@/lib/types';
import { BanknoteIcon, LandmarkIcon, LockIcon, PencilIcon, PlusIcon, SaveIcon, Trash2Icon, TriangleAlertIcon, UsersIcon } from 'lucide-react';

const PANELS = [
  { id: 'users', icon: UsersIcon, label: 'Team & Access' },
  { id: 'billing-cfg', icon: BanknoteIcon, label: 'Billing Config' },
  { id: 'firm', icon: LandmarkIcon, label: 'Firm Profile' },
];

export default function SettingsPage() {
  const { currentUser, toast } = useStore();
  const router = useRouter();
  const [panel, setPanel] = useState('users');

  useEffect(() => {
    if (!currentUser?.isAdmin) {
      toast(LockIcon, 'Access denied', 'Settings are admin-only.');
      router.replace(homePath(currentUser));
    }
  }, [currentUser, router, toast]);
  if (!currentUser?.isAdmin) return null;

  return (
    <div className="page active" id="page-settings">
      <PageHeader title="Settings &" light="Access" sub="Admin-only configuration for Retrieve Group" />
      <div className="settings-layout">
        <div className="settings-nav-panel">
          {PANELS.map(p => (
            <button key={p.id} className={`sn-btn${panel === p.id ? ' active' : ''}`} onClick={() => setPanel(p.id)}><p.icon size={14} /> {p.label}</button>
          ))}
        </div>
        <div className="settings-content-panel">
          {panel === 'users' && <UsersPanel />}
          {panel === 'billing-cfg' && <BillingConfigPanel />}
          {panel === 'firm' && <FirmPanel />}
        </div>
      </div>
    </div>
  );
}

function UsersPanel() {
  const { team, setModal, deleteMember } = useStore();
  return (
    <div className="settings-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="ss-title" style={{ marginBottom: 2 }}>Team Members</div>
          <div className="ss-sub">Add, edit or remove team members. Changes apply immediately.</div>
        </div>
        <button className="btn-solid" onClick={() => setModal({ kind: 'member', id: null })} style={{ whiteSpace: 'nowrap' }}><PlusIcon size={14} /> Add Member</button>
      </div>
      {team.map(e => {
        const level = e.isAdmin ? 'admin' : e.isAdministration ? 'administration' : 'member';
        return (
          <div key={e.id} className="user-row">
            <div className="ur-av" style={{ background: e.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#fff' }}>
              {e.img ? <Photo src={e.img} style={{ borderRadius: 'inherit' }} /> : e.init}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ur-name">{e.name}</div>
              <div className="ur-role" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {e.role}
                {e.email && <span style={{ color: 'var(--text-tertiary)', fontSize: 10.5 }}>· {e.email}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`ur-badge ${level}`}>{level[0].toUpperCase() + level.slice(1)}</span>
            </div>
            <div className="ur-actions">
              <button className="ur-action" onClick={() => setModal({ kind: 'member', id: e.id })}><PencilIcon size={12} /> Edit</button>
              {!e.isAdmin && <button className="ur-action" style={{ color: 'var(--p-high)' }} onClick={() => deleteMember(e.id)}><Trash2Icon size={12} /></button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Draft copy of the firm settings; saved together with the panel's Save button. */
function useFirmDraft(savedMsg: string) {
  const { firm, saveFirm, toast } = useStore();
  const [draft, setDraft] = useState<FirmSettings>(firm);
  const [saving, setSaving] = useState(false);
  // Settings arrive after the page opens: take them until the admin starts editing.
  const [seeded, setSeeded] = useState(firm);
  const dirty = JSON.stringify(draft) !== JSON.stringify(firm);
  if (seeded !== firm) { setSeeded(firm); if (!dirty) setDraft(firm); }

  const text = (k: keyof FirmSettings) => ({
    value: String(draft[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setDraft(d => ({ ...d, [k]: e.target.value })),
  });
  const num = (k: keyof FirmSettings) => ({
    type: 'number', value: String(draft[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, [k]: e.target.value === '' ? 0 : +e.target.value })),
  });
  async function save() {
    setSaving(true);
    const ok = await saveFirm(draft);
    setSaving(false);
    if (ok) toast(SaveIcon, 'Saved', savedMsg);
    else toast(TriangleAlertIcon, 'Not saved', 'Could not save settings. Has migration 006 been run?');
  }
  const saveBtn = (
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button className="btn-solid" disabled={!dirty || saving} onClick={save}><SaveIcon size={14} /> {saving ? 'Saving…' : 'Save Changes'}</button>
      {dirty && !saving && <button className="btn-ghost" onClick={() => setDraft(firm)}>Discard</button>}
    </div>
  );
  return { draft, setDraft, text, num, saveBtn };
}

function BillingConfigPanel() {
  const { draft, setDraft, text, num, saveBtn } = useFirmDraft('Billing config updated.');
  const setBank = (id: string, patch: Partial<BankAccount>) =>
    setDraft(d => ({ ...d, banks: d.banks.map(b => (b.id === id ? { ...b, ...patch } : b)) }));
  const addBank = () => setDraft(d => ({ ...d, banks: [...d.banks, { id: 'b' + Date.now(), label: '', details: '' }] }));
  const removeBank = (id: string) => setDraft(d => ({ ...d, banks: d.banks.filter(b => b.id !== id) }));
  return (
    <>
      <div className="settings-section">
        <div className="ss-title">Billing Configuration</div>
        <div className="ss-sub">Hourly rates are entered manually when issuing each invoice in the Billing page — they are never stored or shown to the team.</div>
        <div style={{ padding: '12px 14px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 'var(--r-lg)', marginTop: 4 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>How invoicing works</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            1. Go to <strong>Billing &amp; Invoices</strong> and select a client<br />
            2. You&apos;ll see all their time entries for the month (description + hours)<br />
            3. Type the hourly rate for each attorney in the Rate column<br />
            4. Totals calculate instantly — export PDF or send it, choosing the bank account to show<br />
            For a fixed amount without time entries, use <strong>New monthly invoice</strong>
          </div>
        </div>
      </div>
      <div className="ss-divider" />
      <div className="settings-section">
        <div className="ss-title">Exchange Rates</div>
        <div className="ss-sub">Used for AMD and EUR invoice display.</div>
        <div className="form-grid">
          <div className="form-row"><label className="form-label">1 USD → AMD</label><input className="input" step={1} min={0} {...num('fxAMD')} /></div>
          <div className="form-row"><label className="form-label">1 USD → EUR</label><input className="input" step={0.01} min={0} {...num('fxEUR')} /></div>
        </div>
      </div>
      <div className="ss-divider" />
      <div className="settings-section">
        <div className="ss-title">Invoice Defaults</div>
        <div className="ss-sub">Shown on every invoice.</div>
        <div className="form-grid">
          <div className="form-row"><label className="form-label">VAT Rate (%)</label><input className="input" step={0.5} min={0} max={100} {...num('vatRate')} /></div>
          <div className="form-row">
            <label className="form-label">Payment Terms</label>
            <select className="input sel" {...text('paymentTerms')}>{PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}</select>
          </div>
        </div>
        <div className="form-row"><label className="form-label">Billing Contact Email</label><input className="input" type="email" {...text('billingEmail')} /></div>
        {saveBtn}
      </div>
      <div className="ss-divider" />
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="ss-title" style={{ marginBottom: 2 }}>Bank Accounts</div>
            <div className="ss-sub">Choose which one to print on each invoice. The first is selected by default.</div>
          </div>
          <button className="btn-outline" onClick={addBank} style={{ whiteSpace: 'nowrap' }}><PlusIcon size={14} /> Add account</button>
        </div>
        {draft.banks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No bank accounts — invoices will be issued without bank details.</div>}
        {draft.banks.map((b, i) => (
          <div key={b.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="input" placeholder="Name, e.g. Ameriabank · AMD" value={b.label} onChange={e => setBank(b.id, { label: e.target.value })} />
              {i === 0 && <span className="ur-badge member" style={{ whiteSpace: 'nowrap' }}>Default</span>}
              <button className="ur-action" title="Remove account" style={{ color: 'var(--p-high)' }} onClick={() => removeBank(b.id)}><Trash2Icon size={12} /></button>
            </div>
            <textarea className="input" rows={2} placeholder={'Bank, account holder, IBAN, SWIFT…'} value={b.details} onChange={e => setBank(b.id, { details: e.target.value })} />
          </div>
        ))}
        {saveBtn}
      </div>
    </>
  );
}

function FirmPanel() {
  const { text, saveBtn } = useFirmDraft('Firm profile updated.');
  const field = (label: string, k: keyof FirmSettings) => (
    <div className="form-row"><label className="form-label">{label}</label><input className="input" {...text(k)} /></div>
  );
  return (
    <div className="settings-section">
      <div className="ss-title">Firm Profile</div>
      <div className="ss-sub">Details shown on invoices and client-facing documents.</div>
      <div className="form-grid">{field('Company Name', 'name')}{field('Legal Name', 'legalName')}</div>
      {field('Website', 'website')}
      {field('Address', 'address')}
      <div className="form-grid">{field('Phone', 'phone')}{field('Email', 'email')}</div>
      {field('TIN / Tax ID', 'tin')}
      {saveBtn}
    </div>
  );
}
