'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { PageHeader } from '@/components/ui';
import { LOGO_SRC } from '@/lib/constants';
import { fmtBill } from '@/lib/helpers';
import type { Currency } from '@/lib/types';
import { CopyIcon, FileTextIcon, LockIcon, MailIcon, PencilIcon, PrinterIcon, Share2Icon, TriangleAlertIcon } from 'lucide-react';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Entry = { who: string; hours: number; desc: string; matter: string; empName: string };

export default function BillingPage() {
  const { currentUser, projects, emp, billingCurrency, setBillingCurrency, fx, firm, toast } = useStore();
  const router = useRouter();
  const allowed = !!(currentUser?.isBilling || currentUser?.isAdmin);
  const [month, setMonth] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);

  useEffect(() => {
    if (!allowed) {
      toast(LockIcon, 'Access denied', 'Billing is restricted to Managing Partner and Senior Partner.');
      router.replace('/dashboard');
    }
  }, [allowed, router, toast]);

  // Clients with time logged this month → their entries
  const clients = useMemo(() => {
    const map: Record<string, Entry[]> = {};
    projects.forEach(p => {
      (p.timeLogs || []).filter(l => l.month === month).forEach(l => {
        (map[p.client] ||= []).push({ ...l, matter: p.title, empName: emp(l.who)?.name || '' });
      });
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [projects, month, emp]);

  if (!allowed) return null;

  const active = clients.find(([name]) => name === selected) ?? clients[0];
  const hoursOf = (entries: Entry[]) => entries.reduce((s, e) => s + e.hours, 0);
  const monthHours = clients.reduce((s, [, e]) => s + hoursOf(e), 0);

  return (
    <div className="page active" id="page-billing">
      <PageHeader title="Billing &" light="Invoices" sub="Monthly billing reports based on logged time entries · Admin only">
        <div className="seg-ctrl">
          {(['USD', 'EUR', 'AMD'] as Currency[]).map(c => (
            <button key={c} className={`seg-btn${billingCurrency === c ? ' active' : ''}`} onClick={() => setBillingCurrency(c)}>
              {{ USD: '$', EUR: '€', AMD: '֏' }[c]} {c}
            </button>
          ))}
        </div>
        <select className="sel" value={month} onChange={e => { setMonth(+e.target.value); setSelected(null); }}>
          <option value={3}>March 2026</option>
          <option value={2}>February 2026</option>
          <option value={1}>January 2026</option>
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
                {invoiceTotal > 0 ? `${active[0]}: ${fmtBill(invoiceTotal, billingCurrency, fx)} incl. ${firm.vatRate}% VAT` : 'Enter rates to calculate'}
              </div>
            )}
          </div>
        </div>
        <div className="billing-main-panel">
          {active
            ? <Invoice key={`${active[0]}-${month}`} client={active[0]} entries={active[1]} month={month} onTotal={setInvoiceTotal} />
            : <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Select a client.</div>}
        </div>
      </div>
    </div>
  );
}

function Invoice({ client, entries, month, onTotal }: { client: string; entries: Entry[]; month: number; onTotal: (v: number) => void }) {
  const { billingCurrency, fx, firm, toast } = useStore();
  const [rates, setRates] = useState<Record<number, string>>({});
  const invNum = useMemo(() => `INV-${String(month).padStart(2, '0')}-2026-${Math.floor(Math.random() * 900 + 100)}`, [month]);
  const ref = useRef<HTMLDivElement>(null);
  const fmt = (v: number) => (v > 0 ? fmtBill(v, billingCurrency, fx) : '—');

  const amounts = entries.map((e, i) => e.hours * (parseFloat(rates[i]) || 0));
  const sub = amounts.reduce((s, a) => s + a, 0);
  const tax = sub * (firm.vatRate / 100), total = sub + tax;

  useEffect(() => { onTotal(total); }, [total, onTotal]);

  function printInvoice() {
    const el = ref.current;
    if (!el) { toast(TriangleAlertIcon, 'No invoice', 'Select a client first.'); return; }
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.inv-actions, .inv-hint').forEach(n => n.remove());
    const live = el.querySelectorAll('input');
    clone.querySelectorAll('input').forEach((inp, i) => {
      const span = document.createElement('span');
      span.textContent = live[i]?.value ? fmtBill(parseFloat(live[i].value), billingCurrency, fx) : '—';
      inp.replaceWith(span);
    });
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
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>Type each attorney&apos;s rate in the Rate column — totals update instantly. Export PDF when ready.</div>
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
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>{MONTHS[month]} 2026</div>
          <div style={{ fontSize: 10.5, color: 'var(--s-billing)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{billingCurrency}</div>
        </div>
      </div>
      <div className="inv-client-block">
        <div><div className="icb-to">Billed to</div><div className="icb-name">{client}</div></div>
        <div className="icb-date">{MONTHS[month]} 2026<br />Due {firm.paymentTerms}</div>
      </div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14 }}>
        <table className="inv-tbl">
          <thead>
            <tr><th>Description</th><th>Attorney</th><th>Hours</th><th>Rate ({billingCurrency}/hr)</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{e.matter}</div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{e.empName.split(' ').map((w, j) => (j === 0 ? w : w[0] + '.')).join(' ')}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{e.hours}h</td>
                <td>
                  <input
                    type="number" className="input inv-rate-input" placeholder="e.g. 200" min={0} step={10}
                    style={{ width: 110, padding: '5px 8px', fontSize: 12, fontFamily: 'var(--font-mono)' }}
                    value={rates[i] ?? ''} onChange={ev => setRates(r => ({ ...r, [i]: ev.target.value }))}
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
          <div className="inv-tot-row"><span className="inv-tot-label">RA VAT ({firm.vatRate}%)</span><span className="inv-tot-val">{fmt(tax)}</span></div>
          <div className="inv-tot-row final"><span className="inv-tot-label">Total Due ({billingCurrency})</span><span className="inv-tot-val">{fmt(total)}</span></div>
        </div>
      </div>
      <div className="inv-actions">
        <button className="btn-solid" onClick={() => toast(MailIcon, 'Invoice sent', `Billing report emailed to ${client}.`)}><MailIcon size={14} /> Send to Client</button>
        <button className="btn-outline" onClick={printInvoice}><FileTextIcon size={14} /> Export PDF</button>
        <button className="btn-outline" onClick={() => toast(CopyIcon, 'Copied', 'Invoice link copied.')}><Share2Icon size={14} /> Share</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.7 }}>
        Payment terms: {firm.paymentTerms}.{firm.bank && <> Bank transfer: {firm.bank}.</>}{firm.billingEmail && <> Questions: {firm.billingEmail}</>}
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
