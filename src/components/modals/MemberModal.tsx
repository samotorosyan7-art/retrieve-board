'use client';

import { useState } from 'react';
import { sha256hex } from '@/lib/auth';
import type { Member } from '@/lib/types';
import { useStore } from '../store';
import { ModalFooter, ModalHeader } from './ModalHost';

type Access = 'member' | 'assistant' | 'billing' | 'admin';

export function MemberModal({ id }: { id: string | null }) {
  const { team, creds, saveMember, toast, closeModal } = useStore();
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
  const [pass, setPass] = useState('');

  async function submit() {
    const n = name.trim(), r = role.trim(), em = email.trim().toLowerCase();
    if (!n || !r || !em) { toast('⚠️', 'Required', 'Name, role and email are required.'); return; }
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
    const cred = pass ? { emailHash: await sha256hex(em), passHash: await sha256hex(pass) } : undefined;
    saveMember(member, cred);

    if (e) {
      const hadLogin = Object.values(creds).some(c => c.teamId === e.id);
      toast('✅', 'Member updated', !pass ? n : hadLogin ? `${n} — password updated.` : `${n} — password set, they can now log in.`);
    } else if (pass) {
      toast('✅', 'Member added', `${n} added and can now log in.`);
    } else {
      toast('⚠️', 'Member added — no password set', `${n} added but cannot log in yet. Edit them to set a password.`);
    }
    closeModal();
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
          <div><label className="form-label">Work Email *</label><input className="input" type="email" value={email} onChange={x => setEmail(x.target.value)} placeholder="name@retrieve.am" /></div>
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
            <label className="form-label">New Password (leave blank to keep)</label>
            <input className="input" type="password" value={pass} onChange={x => setPass(x.target.value)} placeholder="NewPassword2026!" />
          </div>
        </div>
        <ModalFooter label={e ? 'Save Changes' : 'Add Member'} onSubmit={submit} />
      </div>
    </>
  );
}
