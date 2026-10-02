'use client';

import { useState } from 'react';
import { LOGO_SRC, PAYMENT_TERMS } from '@/lib/constants';
import { sendInvoice } from '@/lib/email';
import { today } from '@/lib/helpers';
import { invoiceHtml, invoiceMoney, invoiceTotals, type InvoiceDoc, type InvoiceLine } from '@/lib/invoice';
import type { Currency } from '@/lib/types';
import { useStore } from '../store';
import { ArrowLeftIcon, CircleCheckIcon, FileTextIcon, MailIcon, PencilIcon, PlusIcon, PrinterIcon, Trash2Icon, TriangleAlertIcon, XIcon } from 'lucide-react';

type Props = {
  /** 'time': lines from the month's time entries; 'amount': lines typed here (description + amount). */
  kind: 'time' | 'amount';
  client?: string;
  timeLines?: InvoiceLine[];
  period?: string;
  invNum: string;
  includeVat: boolean;
  setIncludeVat: (v: boolean) => void;
  onClose: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invoice options → Export PDF, or Send: recipient (saved client email or typed) → confirm. */
export function InvoiceModal({ kind, client: initialClient = '', timeLines = [], period, invNum: initialNum, includeVat, setIncludeVat, onClose }: Props) {
  const { firm, clients, billingCurrency, setBillingCurrency, toast } = useStore();
  const [step, setStep] = useState<'form' | 'recipient' | 'confirm'>('form');
  const [client, setClient] = useState(initialClient);
  const [amountLines, setAmountLines] = useState([{ desc: '', amount: '' }]);
  const [invNum, setInvNum] = useState(initialNum);
  const [issueDate, setIssueDate] = useState(today());
  const [bankId, setBankId] = useState(firm.banks[0]?.id || '');
  const [paymentTerms, setPaymentTerms] = useState(firm.paymentTerms);
  const [showAttorneys, setShowAttorneys] = useState(true);
  const [note, setNote] = useState('');
  const [to, setTo] = useState('');
  const [editingTo, setEditingTo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const record = clients.find(c => c.name.trim().toLowerCase() === client.trim().toLowerCase());
  const savedEmail = record?.email || '';
  const bank = firm.banks.find(b => b.id === bankId);
  const lines: InvoiceLine[] = kind === 'time'
    ? timeLines
    : amountLines.filter(l => l.desc.trim() || l.amount).map(l => ({ desc: l.desc.trim(), amount: parseFloat(l.amount) || 0 }));

  const doc: InvoiceDoc = {
    kind, invNum: invNum.trim(), issueDate, period, client: client.trim(),
    clientDetails: record ? [record.address, record.taxId && `TIN: ${record.taxId}`].filter(Boolean).join('\n') || undefined : undefined,
    currency: billingCurrency, lines, includeVat, showAttorneys: kind === 'time' && showAttorneys,
    paymentTerms, bankDetails: bank?.details, note: note.trim() || undefined,
  };
  const { total } = invoiceTotals(doc, firm.vatRate);
  const totalLabel = `${invoiceMoney(total, billingCurrency)} ${includeVat ? `incl. ${firm.vatRate}% VAT` : 'excl. VAT'}`;

  function problem() {
    if (!doc.client) return 'Enter the client.';
    if (!doc.invNum) return 'Enter an invoice number.';
    if (kind === 'amount' && lines.some(l => !l.desc || !(l.amount! > 0))) return 'Each line needs a description and an amount.';
    if (!lines.length || total <= 0) return kind === 'time' ? 'Enter hourly rates for the entries first.' : 'Add at least one line with an amount.';
    return '';
  }

  function exportPdf() {
    const p = problem();
    if (p) { setError(p); return; }
    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) { setError('Allow pop-ups for this site to export the PDF.'); return; }
    w.document.write(invoiceHtml(doc, firm, location.origin + LOGO_SRC));
    w.document.close();
    // Wait for the logo and fonts before printing.
    const print = () => { w.focus(); w.print(); };
    if (w.document.readyState === 'complete') setTimeout(print, 400); else w.addEventListener('load', () => setTimeout(print, 200));
    toast(PrinterIcon, 'Print dialog opened', 'Choose "Save as PDF" in the print dialog.');
  }

  function toRecipient() {
    const p = problem();
    if (p) { setError(p); return; }
    setError(''); setTo(t => t || savedEmail); setEditingTo(false); setStep('recipient');
  }
  function toConfirm() {
    if (!EMAIL_RE.test(to.trim())) { setError('Enter a valid email address.'); return; }
    setError(''); setStep('confirm');
  }
  async function send() {
    setBusy(true); setError('');
    const err = await sendInvoice({ to: to.trim(), bankId: bank?.id, doc });
    setBusy(false);
    if (err) { setError(err); return; }
    toast(CircleCheckIcon, 'Invoice sent', `${doc.invNum} emailed to ${to.trim()}.`);
    onClose();
  }

  const check = (checked: boolean, onChange: (v: boolean) => void, label: string, sub?: string) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--text-primary)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2 }} />
      <span>{label}{sub && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</span>}</span>
    </label>
  );

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal-box inv-modal" style={{ width: 680 }}>
        <div className="modal-hdr">
          <div>
            <div className="modal-title">
              {step === 'form' ? (kind === 'amount' ? 'New monthly invoice' : 'Invoice') : step === 'recipient' ? 'Send invoice' : 'Confirm sending'}
            </div>
            <div className="modal-sub">{[doc.invNum, doc.client, total > 0 && totalLabel].filter(Boolean).join(' · ') || 'Description and amount, no time entries'}</div>
          </div>
          <button className="dp-close" onClick={onClose} disabled={busy}><XIcon size={14} /></button>
        </div>

        <div className="modal-body">
          {step === 'form' && <>
            {kind === 'amount' && <>
              <div>
                <label className="form-label">Client *</label>
                <input className="input" list="invoice-clients" value={client} onChange={e => { setClient(e.target.value); setError(''); }} placeholder="Client name" autoFocus />
                <datalist id="invoice-clients">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
              </div>
              <div>
                <label className="form-label">What the client pays for *</label>
                <div className="inv-modal-lines">
                  {amountLines.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="input" style={{ flex: 1 }} placeholder="Description, e.g. Legal consultation — company registration" value={l.desc}
                        onChange={e => { setAmountLines(ls => ls.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x))); setError(''); }}
                      />
                      <input
                        className="input" type="number" min={0} step={billingCurrency === 'AMD' ? 1000 : 10} placeholder={`Amount (${billingCurrency})`}
                        style={{ width: 140, fontFamily: 'var(--font-mono)' }} value={l.amount}
                        onChange={e => { setAmountLines(ls => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x))); setError(''); }}
                      />
                      {amountLines.length > 1 && (
                        <button className="btn-ghost" title="Remove line" style={{ padding: '0 8px' }} onClick={() => setAmountLines(ls => ls.filter((_, j) => j !== i))}><Trash2Icon size={13} /></button>
                      )}
                    </div>
                  ))}
                  <button className="btn-ghost" style={{ alignSelf: 'flex-start', fontSize: 12, padding: '4px 10px' }} onClick={() => setAmountLines(ls => [...ls, { desc: '', amount: '' }])}>
                    <PlusIcon size={12} /> Add line
                  </button>
                </div>
              </div>
            </>}
            {kind === 'time' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', padding: '10px 12px' }}>
                <b style={{ color: 'var(--text-primary)' }}>{doc.client}</b> · {period} · {lines.length} time entr{lines.length === 1 ? 'y' : 'ies'} with a rate
              </div>
            )}
            <div className="inv-modal-grid">
              <div><label className="form-label">Invoice number</label><input className="input" value={invNum} onChange={e => setInvNum(e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} /></div>
              <div><label className="form-label">Issue date</label><input className="input" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value || today())} /></div>
              <div>
                <label className="form-label">Currency</label>
                <div className="seg-ctrl" title={kind === 'time' ? 'Rates you typed are in this currency — changing it relabels them, it doesn\'t convert.' : undefined}>
                  {(['AMD', 'USD', 'EUR'] as Currency[]).map(c => (
                    <button key={c} className={`seg-btn${billingCurrency === c ? ' active' : ''}`} onClick={() => setBillingCurrency(c)}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Bank account</label>
                <select className="input sel" value={bankId} onChange={e => setBankId(e.target.value)} title={bank?.details}>
                  {firm.banks.map(b => <option key={b.id} value={b.id}>{b.label || b.details.split('\n')[0] || 'Unnamed account'}</option>)}
                  <option value="">— No bank details —</option>
                </select>
              </div>
              <div>
                <label className="form-label">Payment terms</label>
                <select className="input sel" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
                  {[...new Set([firm.paymentTerms, ...PAYMENT_TERMS])].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6, paddingBottom: 2 }}>
                {check(includeVat, setIncludeVat, `Include VAT (${firm.vatRate}%)`)}
                {kind === 'time' && check(showAttorneys, setShowAttorneys, 'Show attorneys')}
              </div>
            </div>
            <div>
              <label className="form-label">Note to client (optional)</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Thank you for your business." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total due</span>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{total > 0 ? totalLabel : '—'}</span>
            </div>
          </>}

          {step === 'recipient' && (
            <div>
              <label className="form-label">Send to</label>
              {editingTo || !savedEmail ? (
                <input
                  className="input" type="email" autoFocus placeholder="client@example.com" value={to}
                  onChange={e => { setTo(e.target.value); setError(''); }} onKeyDown={e => { if (e.key === 'Enter') toConfirm(); }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', background: 'var(--bg-overlay)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{to}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Email on file for {doc.client}</div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setEditingTo(true)}><PencilIcon size={11} /> Change</button>
                </div>
              )}
              {!savedEmail && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{doc.client} has no email on file — type where to send the invoice.</div>}
            </div>
          )}

          {step === 'confirm' && (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Email invoice <b style={{ color: 'var(--text-primary)' }}>{doc.invNum}</b> for <b style={{ color: 'var(--text-primary)' }}>{totalLabel}</b> to{' '}
              <b style={{ color: 'var(--text-primary)' }}>{to.trim()}</b>? The client receives it straight away; this can&apos;t be undone.
            </div>
          )}

          {error && <div style={{ fontSize: 12, color: 'var(--p-high)', display: 'flex', gap: 6, alignItems: 'center' }}><TriangleAlertIcon size={12} /> {error}</div>}

          <div className="modal-foot">
            {step === 'form' && <>
              <button className="btn-cancel" onClick={onClose}>Cancel</button>
              <button className="btn-outline" onClick={exportPdf}><FileTextIcon size={14} /> Export PDF</button>
              <button className="btn-submit" onClick={toRecipient}><MailIcon size={14} /> Send to client…</button>
            </>}
            {step === 'recipient' && <>
              <button className="btn-cancel" onClick={() => { setStep('form'); setError(''); }}><ArrowLeftIcon size={13} /> Back</button>
              <button className="btn-submit" onClick={toConfirm} disabled={!to.trim()}>Continue</button>
            </>}
            {step === 'confirm' && <>
              <button className="btn-cancel" onClick={() => { setStep('recipient'); setError(''); }} disabled={busy}><ArrowLeftIcon size={13} /> Back</button>
              <button className="btn-submit" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Yes, send invoice'}</button>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
