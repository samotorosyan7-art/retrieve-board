'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { PageHeader } from '@/components/ui';
import { LOGO_SRC } from '@/lib/constants';
import { loadSentInvoices } from '@/lib/db';
import { sendInvoice } from '@/lib/email';
import { fmtDate, homePath } from '@/lib/helpers';
import { invoiceHtml, invoiceMoney } from '@/lib/invoice';
import type { SentInvoice } from '@/lib/types';
import { ArrowLeftIcon, CircleCheckIcon, EyeIcon, FileTextIcon, LockIcon, PencilIcon, SendIcon, TriangleAlertIcon, XIcon } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Every invoice emailed to a client, with its send history; view, print or send again. Admins only. */
export default function SentInvoicesPage() {
  const { currentUser, emp, toast } = useStore();
  const router = useRouter();
  const allowed = !!currentUser?.isAdmin;
  const [list, setList] = useState<SentInvoice[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [resend, setResend] = useState<SentInvoice | null>(null);

  useEffect(() => {
    if (!allowed) { toast(LockIcon, 'Access denied', 'Sent Invoices is for admins only.'); router.replace(homePath(currentUser)); }
  }, [allowed, currentUser, router, toast]);

  const reload = useCallback(() => {
    loadSentInvoices().then(l => { setList(l); setError(''); }).catch(e => {
      console.warn('Sent invoices unavailable (has migration 015 been run?)', e);
      setError('Could not load sent invoices. Has migration 015 been run?');
      setList([]);
    });
  }, []);
  useEffect(() => { if (allowed) reload(); }, [allowed, reload]);

  if (!allowed) return null;

  const needle = q.trim().toLowerCase();
  const shown = (list || []).filter(i => !needle || [i.invNum, i.client, ...i.sends.map(s => s.to)].some(v => v.toLowerCase().includes(needle)));

  function open(inv: SentInvoice, print: boolean) {
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { toast(TriangleAlertIcon, 'Pop-up blocked', 'Allow pop-ups for this site to open the invoice.'); return; }
    w.document.write(invoiceHtml(inv.doc, inv.firm, location.origin + LOGO_SRC));
    w.document.close();
    if (print) {
      const go = () => { w.focus(); w.print(); };
      if (w.document.readyState === 'complete') setTimeout(go, 400); else w.addEventListener('load', () => setTimeout(go, 200));
    }
  }

  return (
    <div className="page active" id="page-invoices">
      <PageHeader title="Sent" light="Invoices" sub={list ? `${list.length} invoice${list.length !== 1 ? 's' : ''} sent to clients · Admin only` : 'Loading…'}>
        <input className="input" style={{ width: 240 }} placeholder="Search number, client or email…" value={q} onChange={e => setQ(e.target.value)} />
      </PageHeader>

      {error && <div style={{ fontSize: 12.5, color: 'var(--p-high)', marginBottom: 12, display: 'flex', gap: 6, alignItems: 'center' }}><TriangleAlertIcon size={13} /> {error}</div>}

      <div className="data-table-wrap">
        {list === null ? (
          <div className="dt-empty">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="dt-empty">{list.length ? 'No invoices match your search.' : 'No invoices sent yet. Invoices you send from Billing & Invoices appear here.'}</div>
        ) : (
          <table className="data-table">
            <colgroup>{[15, 17, 14, 11, 21, 22].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Issued</th><th>Sent</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {shown.map(inv => {
                const last = inv.sends[inv.sends.length - 1];
                return (
                  <tr key={inv.id}>
                    <td>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.invNum}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{inv.kind === 'amount' ? 'Monthly invoice' : inv.doc.period || 'Time invoice'}</div>
                    </td>
                    <td><div className="dt-title" title={inv.client}>{inv.client}</div></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {invoiceMoney(inv.total, inv.currency)}
                      <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-tertiary)' }}>{inv.doc.includeVat ? 'incl. VAT' : 'excl. VAT'}</div>
                    </td>
                    <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{fmtDate(inv.doc.issueDate)}</td>
                    <td>
                      {last && <>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={last.to}>{last.to}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}
                          title={inv.sends.map(s => `${fmtWhen(s.at)} → ${s.to} (${emp(s.by)?.name || 'former member'})`).join('\n')}>
                          {fmtWhen(last.at)} · {emp(last.by)?.name.split(' ')[0] || '—'}{inv.sends.length > 1 && ` · sent ${inv.sends.length}×`}
                        </div>
                      </>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', whiteSpace: 'nowrap' }}>
                        <button className="btn-ghost" title="View invoice" style={{ padding: '4px 8px' }} onClick={() => open(inv, false)}><EyeIcon size={13} /></button>
                        <button className="btn-ghost" title="Export PDF" style={{ padding: '4px 8px' }} onClick={() => open(inv, true)}><FileTextIcon size={13} /></button>
                        <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setResend(inv)}><SendIcon size={12} /> Send again</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {resend && <ResendModal inv={resend} onClose={() => setResend(null)} onSent={reload} />}
    </div>
  );
}

/** Send a saved invoice again: recipient (last address, or another) → confirm. The invoice itself is unchanged. */
function ResendModal({ inv, onClose, onSent }: { inv: SentInvoice; onClose: () => void; onSent: () => void }) {
  const { clients, toast } = useStore();
  const last = inv.sends[inv.sends.length - 1]?.to || clients.find(c => c.name === inv.client)?.email || '';
  const [step, setStep] = useState<'recipient' | 'confirm'>('recipient');
  const [to, setTo] = useState(last);
  const [editing, setEditing] = useState(!last);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = invoiceMoney(inv.total, inv.currency);

  function next() {
    if (!EMAIL_RE.test(to.trim())) { setError('Enter a valid email address.'); return; }
    setError(''); setStep('confirm');
  }
  async function send() {
    setBusy(true); setError('');
    const err = await sendInvoice({ to: to.trim(), invoiceId: inv.id });
    setBusy(false);
    if (err) { setError(err); return; }
    toast(CircleCheckIcon, 'Invoice sent again', `${inv.invNum} emailed to ${to.trim()}.`);
    onSent();
    onClose();
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal-box" style={{ width: 460 }}>
        <div className="modal-hdr">
          <div>
            <div className="modal-title">{step === 'recipient' ? 'Send invoice again' : 'Confirm sending'}</div>
            <div className="modal-sub">{inv.invNum} · {inv.client} · {total}</div>
          </div>
          <button className="dp-close" onClick={onClose} disabled={busy}><XIcon size={14} /></button>
        </div>
        <div className="modal-body">
          {step === 'recipient' ? (
            <div>
              <label className="form-label">Send to</label>
              {editing ? (
                <input className="input" type="email" autoFocus placeholder="client@example.com" value={to}
                  onChange={e => { setTo(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') next(); }} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', background: 'var(--bg-overlay)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{to}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{inv.sends.length ? 'Where it was last sent' : `Email on file for ${inv.client}`}</div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setEditing(true)}><PencilIcon size={11} /> Change</button>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                The invoice is sent exactly as before — same lines, totals, bank account and firm details.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Email invoice <b style={{ color: 'var(--text-primary)' }}>{inv.invNum}</b> for <b style={{ color: 'var(--text-primary)' }}>{total}</b> to{' '}
              <b style={{ color: 'var(--text-primary)' }}>{to.trim()}</b> again? The client receives it straight away.
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: 'var(--p-high)', display: 'flex', gap: 6, alignItems: 'center' }}><TriangleAlertIcon size={12} /> {error}</div>}
          <div className="modal-foot">
            {step === 'recipient'
              ? <><button className="btn-cancel" onClick={onClose}>Cancel</button><button className="btn-submit" onClick={next} disabled={!to.trim()}>Continue</button></>
              : <><button className="btn-cancel" onClick={() => { setStep('recipient'); setError(''); }} disabled={busy}><ArrowLeftIcon size={13} /> Back</button>
                  <button className="btn-submit" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Yes, send again'}</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}
