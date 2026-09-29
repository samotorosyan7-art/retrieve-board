'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { PageHeader, Photo } from '@/components/ui';
import { BanknoteIcon, BellIcon, CalendarIcon, FileSignatureIcon, HardDriveIcon, LandmarkIcon, LinkIcon, LockIcon, MailIcon, PencilIcon, PlugIcon, PlusIcon, SaveIcon, SendIcon, SheetIcon, Trash2Icon, UsersIcon, EuroIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const PANELS = [
  { id: 'users', icon: UsersIcon, label: 'Team & Access' },
  { id: 'notif', icon: BellIcon, label: 'Notifications' },
  { id: 'integrations', icon: PlugIcon, label: 'Integrations' },
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
      router.replace('/dashboard');
    }
  }, [currentUser, router, toast]);
  if (!currentUser?.isAdmin) return null;

  return (
    <div className="page active" id="page-settings">
      <PageHeader title="Settings &" light="Access" sub="Admin-only configuration for Retrieve PM" />
      <div className="settings-layout">
        <div className="settings-nav-panel">
          {PANELS.map(p => (
            <button key={p.id} className={`sn-btn${panel === p.id ? ' active' : ''}`} onClick={() => setPanel(p.id)}><p.icon size={14} /> {p.label}</button>
          ))}
        </div>
        <div className="settings-content-panel">
          {panel === 'users' && <UsersPanel />}
          {panel === 'notif' && <NotifPanel />}
          {panel === 'integrations' && <IntegrationsPanel />}
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
        const level = e.isAdmin ? 'admin' : e.isBilling ? 'billing' : e.isAdmin_assistant ? 'assistant' : 'member';
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

const NOTIFS: [string, string, boolean][] = [
  ['Task assigned to me', 'You receive an email when a task is assigned to your account', true],
  ['Task deadline (48h)', 'Alert when a deadline is within 48 hours', true],
  ['Status change', "Alert when a task you're on changes status", false],
  ['File uploaded', 'Alert when a file is added to your task', false],
  ['New task assigned', 'Alert when added to a new task', true],
  ['Invoice dispatched', 'Confirmation when billing report is sent', true],
  ['Weekly digest (Monday)', 'Summary of your active tasks and pending to-dos', false],
];

function NotifPanel() {
  const { toast } = useStore();
  return (
    <div className="settings-section">
      <div className="ss-title">Email Notifications</div>
      <div className="ss-sub">Configure when your team receives automatic alerts.</div>
      {NOTIFS.map(([name, desc, on]) => (
        <div key={name} className="toggle-row">
          <div className="tr-info"><div className="tr-name">{name}</div><div className="tr-desc">{desc}</div></div>
          <label className="toggle" style={{ position: 'relative' }}>
            <input type="checkbox" defaultChecked={on} onChange={() => toast(BellIcon, 'Saved', 'Notification preference updated.')} />
            <div className="toggle-track" /><div className="toggle-thumb" />
          </label>
        </div>
      ))}
    </div>
  );
}

const INTEGRATIONS: { icon: LucideIcon; name: string; desc: React.ReactNode; connected: boolean }[] = [
  { icon: HardDriveIcon, name: 'Google Drive', desc: "Auto-sync uploaded files to the firm's shared Drive folder.", connected: true },
  {
    icon: MailIcon, name: 'Email (Resend)', connected: true,
    desc: <>Send email notifications when tasks are assigned. <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ color: 'var(--s-billing)' }}>Manage at resend.com →</a></>,
  },
  { icon: CalendarIcon, name: 'Google Calendar', desc: 'Sync task deadlines with your Google Calendar.', connected: false },
  { icon: SheetIcon, name: 'Google Sheets', desc: 'Export billing data automatically to Sheets.', connected: false },
  { icon: SendIcon, name: 'Telegram Bot', desc: 'Receive task notifications in Telegram.', connected: false },
  { icon: FileSignatureIcon, name: 'DocuSign', desc: 'Send contracts for e-signature from any task.', connected: false },
];

function IntegrationsPanel() {
  const { toast } = useStore();
  return (
    <div className="settings-section">
      <div className="ss-title">Connected Services</div>
      <div className="ss-sub">Sync Retrieve PM with your existing tools.</div>
      {INTEGRATIONS.map(i => (
        <div key={i.name} className="integ-row">
          <div className="integ-icon"><i.icon size={22} /></div>
          <div className="integ-info"><div className="integ-name">{i.name}</div><div className="integ-desc">{i.desc}</div></div>
          <div className={`integ-status ${i.connected ? 'connected' : 'disconnected'}`}>{i.connected ? '● Connected' : '○ Connect'}</div>
          <button className="ur-action" onClick={() => toast(LinkIcon, i.name, i.connected ? 'Disconnecting…' : 'OAuth flow required in production.')}>
            {i.connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      ))}
    </div>
  );
}

function BillingConfigPanel() {
  const { fx, setFx, toast } = useStore();
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
            4. Totals calculate instantly — export PDF when ready
          </div>
        </div>
      </div>
      <div className="ss-divider" />
      <div className="settings-section">
        <div className="ss-title">Exchange Rates</div>
        <div className="ss-sub">Used for AMD and EUR invoice display. Update as needed.</div>
        <div className="form-grid">
          <div className="form-row">
            <label className="form-label">1 USD → AMD</label>
            <input className="input" type="number" step={1} defaultValue={fx.AMD}
              onChange={e => { setFx(f => ({ ...f, AMD: +e.target.value })); }}
              onBlur={() => toast(BanknoteIcon, 'Rate updated', 'AMD rate set.')} />
          </div>
          <div className="form-row">
            <label className="form-label">1 USD → EUR</label>
            <input className="input" type="number" step={0.01} defaultValue={fx.EUR}
              onChange={e => { setFx(f => ({ ...f, EUR: +e.target.value })); }}
              onBlur={() => toast(EuroIcon, 'Rate updated', 'EUR rate set.')} />
          </div>
        </div>
      </div>
      <div className="ss-divider" />
      <div className="settings-section">
        <div className="ss-title">Invoice Defaults</div>
        <div className="form-grid">
          <div className="form-row"><label className="form-label">VAT Rate (%)</label><input className="input" type="number" defaultValue={20} /></div>
          <div className="form-row">
            <label className="form-label">Payment Terms</label>
            <select className="input sel"><option>Net 30 days</option><option>Net 15 days</option><option>Due on receipt</option></select>
          </div>
        </div>
        <button className="btn-solid" style={{ marginTop: 4 }} onClick={() => toast(SaveIcon, 'Saved', 'Billing config updated.')}>Save Changes</button>
      </div>
    </>
  );
}

function FirmPanel() {
  const { toast, clearSavedState } = useStore();
  const field = (label: string, value: string) => (
    <div className="form-row"><label className="form-label">{label}</label><input className="input" defaultValue={value} /></div>
  );
  return (
    <div className="settings-section">
      <div className="ss-title">Firm Profile</div>
      <div className="ss-sub">Details shown on invoices and client-facing documents.</div>
      <div className="form-grid">{field('Firm Name', 'Retrieve Legal & Tax')}{field('Website', 'retrieve.am')}</div>
      {field('Address', 'Baghramyan 41, Yerevan, Armenia')}
      <div className="form-grid">{field('Phone', '+374 41 777 332')}{field('Email', 'info@retrieve.am')}</div>
      {field('TIN / Tax ID', 'AM 1234567')}
      <div className="form-row">
        <label className="form-label">Bank Details</label>
        <textarea className="input" rows={2} defaultValue="Ameriabank OJSC · IBAN: AM12 3456 7890 1234 5678" />
      </div>
      <button className="btn-solid" style={{ marginTop: 4 }} onClick={() => toast(SaveIcon, 'Saved', 'Firm profile updated.')}>Save Changes</button>
      <div className="ss-divider" />
      <div className="settings-section">
        <div className="ss-title">Data Management</div>
        <div className="ss-sub">All changes are saved to the shared database, with a copy cached in this browser for instant loading.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 'var(--r-lg)', marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-high)' }}>Clear Local Cache</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Wipes this browser&apos;s cached copy and reloads from the database.</div>
          </div>
          <button className="dp-action-btn danger" style={{ width: 'auto', padding: '7px 16px' }} onClick={clearSavedState}>Reset</button>
        </div>
      </div>
    </div>
  );
}
