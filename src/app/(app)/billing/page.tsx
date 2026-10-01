'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { PageHeader } from '@/components/ui';
import { LOGO_SRC } from '@/lib/constants';
import { sendInvoice } from '@/lib/email';
import { fmtCurrency, homePath, today } from '@/lib/helpers';
import type { Currency } from '@/lib/types';
import { CircleCheckIcon, CopyIcon, FileTextIcon, LockIcon, MailIcon, PencilIcon, PrinterIcon, Share2Icon, TriangleAlertIcon, XIcon } from 'lucide-react';

/** 'YYYY-MM' → 'October 2026'. */
const periodLabel = (period: string) => `${MONTHS[+period.slice(5, 7)]} ${period.slice(0, 4)}`;
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A billable time entry. Every one is listed; only those with `included` are charged on the invoice. */
type Entry = { key: string; pid: string; index: number; who: string; hours: number; desc: string; matter: string; empName: string; included: boolean };

export default function BillingPage() {
  const { currentUser, projects, emp, billingCurrency, setBillingCurrency, firm, toast } = useStore();
  const router = useRouter();
  const allowed = !!currentUser?.isAdmin;
  // Billing period as 'YYYY-MM', matched against each entry's date. Starts on the current month.
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  // Whether VAT is added to invoice totals (applies to every client's invoice, PDF and email).
  const [includeVat, setIncludeVat] = useState(true);

  useEffect(() => {
    if (!allowed) {
      toast(LockIcon, 'Access denied', 'Billing & Invoices is for admins only.');
      router.replace(homePath(currentUser));
    }
  }, [allowed, router, toast]);

  // Every month from January 2026 through the current one (or the latest billable entry, if later), plus any
  // earlier month that has billable time — newest first.
  const periods = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => (p.timeLogs || []).forEach(l => { if (l.billable !== false && l.date) set.add(l.date.slice(0, 7)); }));
    const last = [today().slice(0, 7), ...set].sort().at(-1)!;
    for (let y = 2026, m = 1; `${y}-${String(m).padStart(2, '0')}` <= last; m === 12 ? (y++, m = 1) : m++) {
      set.add(`${y}-${String(m).padStart(2, '0')}`);
    }
    return [...set].sort().reverse();
  }, [projects]);

  // Clients with billable time logged in the period → their entries
  const clients = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    projects.forEach(p => {
      (p.timeLogs || []).forEach((l, index) => {
        if (!l.date?.startsWith(period) || l.billable === false) return;
        (map[p.client] ||= []).push({
          ...l, key: `${p.id}:${index}`, pid: p.id, index, matter: p.title, empName: emp(l.who)?.name || '', included: l.inInvoice !== false,
        });
      });
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects, period, emp]);

  if (!allowed) return null;

  const active = clients.find(([name]) => name === selected) ?? clients[0];
  const round = (h: number) => Math.round(h * 100) / 100; // avoid 0.1 + 0.2 = 0.30000000000000004
  const hoursOf = (entries: Entry[]) => round(entries.reduce((s, e) => s + (e.included ? e.hours : 0), 0));
  const monthHours = round(clients.reduce((s, [, e]) => s + hoursOf(e), 0));

  return (
    <div className="page active" id="page-billing">
      <PageHeader title="Billing &" light="Invoices" sub="Monthly billing reports based on logged time entries · Admin only">
        <div className="seg-ctrl">
          {(['AMD', 'USD', 'EUR'] as Currency[]).map(c => (
            <button key={c} className={`seg-btn${billingCurrency === c ? ' active' : ''}`} onClick={() => setBillingCurrency(c)}>
              {{ USD: '$', EUR: '€', AMD: '֏' }[c]} {c}
            </button>
          ))}
        </div>
        <div className="seg-ctrl" title="Add VAT to invoice totals">
          <button className={`seg-btn${includeVat ? ' active' : ''}`} onClick={() => setIncludeVat(true)}>Incl. VAT</button>
          <button className={`seg-btn${!includeVat ? ' active' : ''}`} onClick={() => setIncludeVat(false)}>Excl. VAT</button>
        </div>
        <select className="sel" value={period} onChange={e => { setPeriod(e.target.value); setSelected(null); }}>
          {periods.map(m => <option key={m} value={m}>{periodLabel(m)}</option>)}
        </select>
      </PageHeader>

      <div className="billing-layout">
        <div className="billing-sidebar-panel">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Clients ({clients.length})
          </div>
          {clients.length ? clients.map(([name, entries]) => {
            const hrs = hoursOf(entries);
            return (
              <div key={name} className={`bill-client-row${active?.[0] === name ? ' active' : ''}`} onClick={() => setSelected(name)}>
                <div className="bc-dot" style={{ background: hrs > 20 ? '#F87171' : hrs > 10 ? '#FB923C' : '#34D399' }} />
                <span className="bc-name">{name}</span>
                <span className="bc-amount">{hrs}h</span>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: 8 }}>No billable entries.</div>}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>Month total</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>{monthHours}h logged</div>
            {active && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {invoiceTotal > 0 ? `${active[0]}: ${fmtCurrency(invoiceTotal, billingCurrency)} ${includeVat ? `incl. ${firm.vatRate}% VAT` : 'excl. VAT'}` : 'Enter rates to calculate'}
              </div>
            )}
          </div>
        </div>
        <div className="billing-main-panel">
          {active
            ? <Invoice key={`${active[0]}-${period}`} client={active[0]} entries={active[1]} period={period} includeVat={includeVat} onTotal={setInvoiceTotal} />
            : <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Select a client.</div>}
        </div>
      </div>
    </div>
  );
}

function Invoice({ client, entries, period, includeVat, onTotal }: { client: string; entries: Entry[]; period: string; includeVat: boolean; onTotal: (v: number) => void }) {
  const { currentUser, setLogInInvoice, billingCurrency, firm, clients, toast } = useStore();
  const [sending, setSending] = useState(false);
  const isAdmin = !!currentUser?.isAdmin;
  const [rates, setRates] = useState<Record<string, string>>({});
  const invNum = useMemo(() => `INV-${period.slice(5, 7)}-${period.slice(0, 4)}-${Math.floor(Math.random() * 900 + 100)}`, [period]);
  const ref = useRef<HTMLDivElement>(null);
  // Rates are typed in the selected currency, so amounts are in it too. Switching currency only relabels them — no conversion.
  const fmt = (v: number) => (v > 0 ? fmtCurrency(v, billingCurrency) : '—');

  const amounts = entries.map(e => (e.included ? e.hours * (parseFloat(rates[e.key]) || 0) : 0));
  const sub = amounts.reduce((s, a) => s + a, 0);
  const tax = includeVat ? sub * (firm.vatRate / 100) : 0, total = sub + tax;

  useEffect(() => { onTotal(total); }, [total, onTotal]);

  function printInvoice() {
    const el = ref.current;
    if (!el) { toast(TriangleAlertIcon, 'No invoice', 'Select a client first.'); return; }
    const clone = el.cloneNode(true) as HTMLElement;
    const live = el.querySelectorAll<HTMLInputElement>('input.inv-rate-input');
    clone.querySelectorAll('input.inv-rate-input').forEach((inp, i) => {
      const span = document.createElement('span');
      span.textContent = live[i]?.value ? fmtCurrency(parseFloat(live[i].value), billingCurrency) : '—';
      inp.replaceWith(span);
    });
    // Entries left off the invoice and the on/off column are for the screen only.
    clone.querySelectorAll('.inv-actions, .inv-hint, .inv-excluded, .inv-pick').forEach(n => n.remove());
    clone.querySelectorAll('img').forEach(img => { img.src = location.origin + LOGO_SRC; });

    const w = window.open('', '_blank', 'width=800,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice — ${client.replace(/</g, '&lt;')}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${PRINT_CSS}</style></head><body>${clone.outerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
    toast(PrinterIcon, 'Print dialog opened', 'Use "Save as PDF" in the print dialog.');
  }

  return (
    <div className="inv-wrap" ref={ref}>
      <div className="inv-hint" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <PencilIcon size={16} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enter hourly rates to calculate invoice</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>Type each attorney&apos;s rate in the Rate column — totals update instantly.{isAdmin && ' Untick an entry to leave it off the invoice.'} Export PDF when ready.</div>
        </div>
      </div>
      <div className="inv-hdr">
        <div className="inv-from">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain', marginBottom: 10, display: 'block' }} />
          <div className="inv-firm">{firm.name}</div>
          <div className="inv-detail">{firm.address}<br />{[firm.email, firm.phone].filter(Boolean).join(' · ')}{firm.tin && <><br />TIN: {firm.tin}</>}</div>
        </div>
        <div className="inv-to-block">
          <div className="inv-label">Invoice</div>
          <div className="inv-num">{invNum}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>{periodLabel(period)}</div>
          <div style={{ fontSize: 10.5, color: 'var(--s-billing)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{billingCurrency}</div>
        </div>
      </div>
      <div className="inv-client-block">
        <div><div className="icb-to">Billed to</div><div className="icb-name">{client}</div></div>
        <div className="icb-date">{periodLabel(period)}<br />Due {firm.paymentTerms}</div>
      </div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14 }}>
        <table className="inv-tbl">
          <thead>
            <tr><th className="inv-pick" style={{ width: 28 }} title="On invoice" /><th>Description</th><th>Attorney</th><th>Hours</th><th>Rate ({billingCurrency}/hr)</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.key} className={e.included ? undefined : 'inv-excluded'} style={e.included ? undefined : { opacity: 0.45 }}>
                <td className="inv-pick">
                  <input
                    type="checkbox" checked={e.included} disabled={!isAdmin}
                    title={isAdmin ? (e.included ? 'On invoice — untick to leave it off' : 'Not on invoice — tick to add it') : 'Only admins choose what goes on the invoice'}
                    onChange={ev => setLogInInvoice(e.pid, e.index, ev.target.checked)}
                  />
                </td>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{e.matter}</div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{e.empName.split(' ').map((w, j) => (j === 0 ? w : w[0] + '.')).join(' ')}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{e.hours}h</td>
                <td>
                  <input
                    type="number" className="input inv-rate-input" placeholder={billingCurrency === 'AMD' ? 'e.g. 50000' : 'e.g. 200'} min={0} step={billingCurrency === 'AMD' ? 1000 : 10}
                    style={{ width: 110, padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    disabled={!e.included} value={rates[e.key] ?? ''} onChange={ev => setRates(r => ({ ...r, [e.key]: ev.target.value }))}
                  />
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(amounts[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="inv-totals">
        <div className="inv-totals-block">
          <div className="inv-tot-row"><span className="inv-tot-label">Subtotal</span><span className="inv-tot-val">{fmt(sub)}</span></div>
          {includeVat && <div className="inv-tot-row"><span className="inv-tot-label">RA VAT ({firm.vatRate}%)</span><span className="inv-tot-val">{fmt(tax)}</span></div>}
          <div className="inv-tot-row final"><span className="inv-tot-label">Total Due ({billingCurrency}){!includeVat && ' · excl. VAT'}</span><span className="inv-tot-val">{fmt(total)}</span></div>
        </div>
      </div>
      <div className="inv-actions">
        <button
          className="btn-solid"
          onClick={() => total > 0 ? setSending(true) : toast(TriangleAlertIcon, 'Nothing to send', 'Enter hourly rates for the entries on the invoice first.')}
        >
          <MailIcon size={14} /> Send to Client
        </button>
        <button className="btn-outline" onClick={printInvoice}><FileTextIcon size={14} /> Export PDF</button>
        <button className="btn-outline" onClick={() => toast(CopyIcon, 'Copied', 'Invoice link copied.')}><Share2Icon size={14} /> Share</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.7 }}>
        Payment terms: {firm.paymentTerms}.{firm.bank && <> Bank transfer: {firm.bank}.</>}{firm.billingEmail && <> Questions: {firm.billingEmail}</>}
      </div>
      {sending && (
        <SendInvoiceDialog
          client={client} invNum={invNum} totalLabel={`${fmtCurrency(total, billingCurrency)}${includeVat ? ` incl. ${firm.vatRate}% VAT` : ' excl. VAT'}`}
          savedEmail={clients.find(c => c.name === client)?.email || ''}
          onClose={() => setSending(false)}
          onSend={to => sendInvoice({
            to, client, invNum, period: periodLabel(period), currency: billingCurrency, includeVat,
            lines: entries.filter(e => e.included && parseFloat(rates[e.key]) > 0).map(e => ({
              desc: e.desc, matter: e.matter, attorney: e.empName, hours: e.hours, rate: parseFloat(rates[e.key]),
            })),
          })}
        />
      )}
    </div>
  );
}

/** Send to Client, confirmed twice: 1) choose the address (the client's saved email, or type one), 2) confirm the send. */
function SendInvoiceDialog({ client, invNum, totalLabel, savedEmail, onClose, onSend }: {
  client: string; invNum: string; totalLabel: string; savedEmail: string;
  onClose: () => void; onSend: (to: string) => Promise<string | null>;
}) {
  const { toast } = useStore();
  const [step, setStep] = useState<'recipient' | 'confirm'>('recipient');
  const [to, setTo] = useState(savedEmail);
  const [editing, setEditing] = useState(!savedEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  function next() {
    if (!valid) { setError('Enter a valid email address.'); return; }
    setError(''); setStep('confirm');
  }
  async function send() {
    setBusy(true); setError('');
    const err = await onSend(to.trim());
    setBusy(false);
    if (err) { setError(err); return; }
    toast(CircleCheckIcon, 'Invoice sent', `${invNum} emailed to ${to.trim()}.`);
    onClose();
  }

  return (
    <div className="modal-backdrop open" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-hdr">
          <div>
            <div className="modal-title">{step === 'recipient' ? 'Send invoice' : 'Confirm sending'}</div>
            <div className="modal-sub">{invNum} · {client} · {totalLabel}</div>
          </div>
          <button className="dp-close" onClick={onClose} disabled={busy}><XIcon size={14} /></button>
        </div>
        <div className="modal-body">
          {step === 'recipient' ? (
            <div>
              <label className="form-label">Send to</label>
              {editing ? (
                <input
                  className="input" type="email" autoFocus placeholder="client@example.com" value={to}
                  onChange={e => { setTo(e.target.value); setError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') next(); }}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)', background: 'var(--bg-overlay)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{to}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Email on file for {client}</div>
                  </div>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setEditing(true)}><PencilIcon size={11} /> Change</button>
                </div>
              )}
              {!savedEmail && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>{client} has no email on file — type where to send the invoice.</div>}
            </div>
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              Email invoice <b style={{ color: 'var(--text-primary)' }}>{invNum}</b> for <b style={{ color: 'var(--text-primary)' }}>{totalLabel}</b> to{' '}
              <b style={{ color: 'var(--text-primary)' }}>{to.trim()}</b>? The client receives it straight away; this can&apos;t be undone.
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: 'var(--p-high)', display: 'flex', gap: 6, alignItems: 'center' }}><TriangleAlertIcon size={12} /> {error}</div>}
          <div className="modal-foot">
            {step === 'recipient'
              ? <><button className="btn-cancel" onClick={onClose}>Cancel</button><button className="btn-submit" onClick={next} disabled={!to.trim()}>Continue</button></>
              : <><button className="btn-cancel" onClick={() => { setStep('recipient'); setError(''); }} disabled={busy}>Back</button>
                  <button className="btn-submit" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Yes, send invoice'}</button></>}
          </div>
        </div>
      </div>
    </div>
  );
}

const PRINT_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: #0F172A; background: #fff; padding: 40px; }
.inv-wrap { max-width: 640px; margin: 0 auto; }
.inv-hdr { display: flex; justify-content: space-between; align-items: flex-start; padding: 20px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 14px; }
.inv-firm { font-size: 17px; font-weight: 800; letter-spacing: -0.03em; }
.inv-detail { font-size: 10px; color: #64748B; line-height: 1.8; margin-top: 4px; }
.inv-label { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #94A3B8; }
.inv-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748B; margin-top: 2px; }
.inv-client-block { padding: 12px 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
.icb-to { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 3px; }
.icb-name { font-size: 14px; font-weight: 700; }
.icb-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748B; text-align: right; }
table { width: 100%; border-collapse: collapse; }
th { padding: 8px 12px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; text-align: left; }
td { padding: 9px 12px; font-size: 11px; border-bottom: 1px solid #F1F5F9; color: #0F172A !important; }
tr:last-child td { border-bottom: none; }
.inv-totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
.inv-totals-block { width: 260px; }
.inv-tot-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 11px; border-bottom: 1px solid #F1F5F9; }
.inv-tot-row.final { border-bottom: none; padding-top: 10px; font-weight: 700; font-size: 13px; }
.inv-tot-val { font-family: 'JetBrains Mono', monospace; font-weight: 600; }
@media print { body { padding: 20px; } }
`;
