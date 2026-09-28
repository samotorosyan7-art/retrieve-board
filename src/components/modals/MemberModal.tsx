'use client';

import { useState } from 'react';
import type { Member } from '@/lib/types';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';

type Access = 'member' | 'assistant' | 'billing' | 'admin';

export function MemberModal({ id }: { id: string | null }) {
  const { team, saveMember, sendPasswordEmail, toast, closeModal } = useStore();
  const e = id ? team.find(x => x.id === id) : undefined;
  const [name, setName] = useState(e?.name || '');
  const [init, setInit] = useState(e?.init || '');
  const [role, setRole] = useState(e?.role || '');
  const [email, setEmail] = useState(e?.email || '');
  const [rate, setRate] = useState(String(e?.rate || 0));
  const [color, setColor] = useState(e?.color || '#7C6FF7');
  const [img, setImg] = useState(e?.img || '');
  const [access, setAccess] = useState<Access>(
    e?.isAdmin ? 'admin' : e?.isAdmin_assistant ? 'assistant' : e?.isBilling ? 'billing' : 'member',
  );
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = name.trim(), r = role.trim(), em = email.trim().toLowerCase();
    if (!n || !r || !em) { toast('⚠️', 'Required', 'Name, role and email are required.'); return; }
    if (team.some(x => x.email.toLowerCase() === em && x.id !== e?.id)) { toast('⚠️', 'Email in use', `${em} already belongs to another member.`); return; }
    const member: Member = {
      id: e?.id ?? 'u' + Date.now(),
      name: n, role: r, email: em,
      init: init.trim() || n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      rate: parseInt(rate || '0') || 0,
      color, img: img.trim(),
      isAdmin: access === 'admin',
      isBilling: access === 'billing' || access === 'admin',
      isAdmin_assistant: access === 'assistant',
    };
    setBusy(true);
    const ok = await saveMember(member);
    setBusy(false);
    if (!ok) return;
    if (e) toast('✅', 'Member updated', n);
    else toast('✅', 'Member added', `Now invite ${em} from Supabase → Authentication → Users → Invite user.`);
    closeModal();
  }

  async function sendLink() {
    if (!e) return;
    const err = await sendPasswordEmail(e.email);
    if (err) toast('⚠️', 'Email not sent', err);
    else toast('📧', 'Email sent', `${e.name.split(' ')[0]} will receive a link to set a new password.`);
  }

  return (
    <>
      <ModalHeader
        title={e ? 'Edit Team Member' : 'Add Team Member'}
        sub={e ? 'Update details, role and access level' : 'Add a new member to the firm'}
      />
      <div className="modal-body">
        <div className="form-grid">
          <div><label className="form-label">Full Name *</label><input className="input" value={name} onChange={x => setName(x.target.value)} placeholder="e.g. Mariam Dovlatyan" /></div>
          <div><label className="form-label">Initials</label><input className="input" value={init} onChange={x => setInit(x.target.value)} placeholder="e.g. SS" maxLength={3} /></div>
        </div>
        <div className="form-grid">
          <div><label className="form-label">Role / Title *</label><input className="input" value={role} onChange={x => setRole(x.target.value)} placeholder="e.g. Associate Attorney" /></div>
          <div>
            <label className="form-label">Work Email * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(their login)</span></label>
            <input className="input" type="email" value={email} onChange={x => setEmail(x.target.value)} placeholder="name@retrieve.am" />
          </div>
        </div>
        <div className="form-grid">
          <div><label className="form-label">Hourly Rate (USD)</label><input className="input" type="number" value={rate} onChange={x => setRate(x.target.value)} placeholder="150" /></div>
          <div>
            <label className="form-label">Accent Color</label>
            <input className="input" type="color" value={color} onChange={x => setColor(x.target.value)} style={{ height: 40, padding: '4px 8px', cursor: 'pointer' }} />
          </div>
        </div>
        <div><label className="form-label">Photo URL (optional)</label><input className="input" value={img} onChange={x => setImg(x.target.value)} placeholder="https://…" /></div>
        <div className="form-grid">
          <div>
            <label className="form-label">Access Level</label>
            <select className="input sel" value={access} onChange={x => setAccess(x.target.value as Access)}>
              <option value="member">Member (standard)</option>
              <option value="assistant">Admin Assistant</option>
              <option value="billing">Billing access</option>
              <option value="admin">Full Admin</option>
            </select>
          </div>
          <div>
            <label className="form-label">Password</label>
            {e ? (
              <button type="button" className="btn-outline" style={{ width: '100%' }} onClick={sendLink}>📧 Send password email</button>
            ) : (
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', lineHeight: 1.5, paddingTop: 6 }}>
                After saving, invite this email from Supabase → Authentication so they can set a password.
              </div>
            )}
          </div>
        </div>
        <ModalFooter label={busy ? 'Saving…' : e ? 'Save Changes' : 'Add Member'} onSubmit={submit} />
      </div>
    </>
  );
}
