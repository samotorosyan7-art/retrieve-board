'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { InvoiceModal } from '@/components/modals/InvoiceModal';
import { PageHeader } from '@/components/ui';
import { LOGO_SRC } from '@/lib/constants';
import { fmtCurrency, homePath, today } from '@/lib/helpers';
import { FileTextIcon, LockIcon, MailIcon, PencilIcon, ReceiptIcon, TriangleAlertIcon } from 'lucide-react';

/** Suggested number for a new invoice in a period — editable in the invoice window. */
const newInvNum = (period: string) => `INV-${period.slice(5, 7)}-${period.slice(0, 4)}-${Math.floor(Math.random() * 900 + 100)}`;

/** 'YYYY-MM' → 'October 2026'. */
const periodLabel = (period: string) => `${MONTHS[+period.slice(5, 7)]} ${period.slice(0, 4)}`;
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A billable time entry. Every one is listed; only those with `included` are charged on the invoice. */
type Entry = { key: string; pid: string; index: number; who: string; hours: number; desc: string; matter: string; empName: string; included: boolean };

export default function BillingPage() {
  const { currentUser, projects, emp, billingCurrency, firm, toast } = useStore();
  const router = useRouter();
  const allowed = !!currentUser?.isAdmin;
  // Billing period as 'YYYY-MM', matched against each entry's date. Starts on the current month.
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  // Whether VAT is added to invoice totals — set in the invoice window, also used for the on-screen totals.
  const [includeVat, setIncludeVat] = useState(true);
  const [amountInvoice, setAmountInvoice] = useState(false);

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
        <select className="sel" value={period} onChange={e => { setPeriod(e.target.value); setSelected(null); }}>
          {periods.map(m => <option key={m} value={m}>{periodLabel(m)}</option>)}
        </select>
        <button className="btn-solid" onClick={() => setAmountInvoice(true)} title="Invoice a fixed amount with a description — no time entries">
          <ReceiptIcon size={14} /> New monthly invoice
        </button>
      </PageHeader>
      {amountInvoice && (
        <InvoiceModal kind="amount" invNum={newInvNum(today().slice(0, 7))} includeVat={includeVat} setIncludeVat={setIncludeVat} onClose={() => setAmountInvoice(false)} />
      )}

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
            ? <Invoice key={`${active[0]}-${period}`} client={active[0]} entries={active[1]} period={period} includeVat={includeVat} setIncludeVat={setIncludeVat} onTotal={setInvoiceTotal} />
            : <div style={{ color: 'var(--text-tertiary)', padding: 20 }}>Select a client.</div>}
        </div>
      </div>
    </div>
  );
}

function Invoice({ client, entries, period, includeVat, setIncludeVat, onTotal }: {
  client: string; entries: Entry[]; period: string; includeVat: boolean; setIncludeVat: (v: boolean) => void; onTotal: (v: number) => void;
}) {
  const { currentUser, setLogInInvoice, billingCurrency, firm, toast } = useStore();
  const [open, setOpen] = useState(false);
  const isAdmin = !!currentUser?.isAdmin;
  const [rates, setRates] = useState<Record<string, string>>({});
  const invNum = useMemo(() => newInvNum(period), [period]);
  // Rates are typed in the selected currency, so amounts are in it too. Switching currency only relabels them — no conversion.
  const fmt = (v: number) => (v > 0 ? fmtCurrency(v, billingCurrency) : '—');

  const amounts = entries.map(e => (e.included ? e.hours * (parseFloat(rates[e.key]) || 0) : 0));
  const sub = amounts.reduce((s, a) => s + a, 0);
  const tax = includeVat ? sub * (firm.vatRate / 100) : 0, total = sub + tax;

  useEffect(() => { onTotal(total); }, [total, onTotal]);

  // What goes on the PDF / email: included entries with a rate — the log description only, not the task name.
  const lines = entries.filter(e => e.included && parseFloat(rates[e.key]) > 0)
    .map(e => ({ desc: e.desc, attorney: e.empName, hours: e.hours, rate: parseFloat(rates[e.key]) }));
  const openInvoice = () => (total > 0 ? setOpen(true) : toast(TriangleAlertIcon, 'Enter rates first', 'Type hourly rates for the entries on the invoice.'));

  return (
    <div className="inv-wrap">
      <div className="inv-hint" style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <PencilIcon size={16} />
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enter hourly rates to calculate invoice</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>Type each attorney&apos;s rate in the Rate column — totals update instantly.{isAdmin && ' Untick an entry to leave it off the invoice.'} Then export the PDF or send it — you choose the bank account and options there.</div>
        </div>
      </div>
      <div className="inv-hdr">
        <div className="inv-from">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="" style={{ height: 42, width: 'auto', objectFit: 'contain', marginBottom: 10, display: 'block' }} />
          <div className="inv-firm">{firm.name}</div>
          <div className="inv-detail">
            {firm.legalName && firm.legalName !== firm.name && <>{firm.legalName}<br /></>}
            {firm.address}<br />{[firm.email, firm.phone].filter(Boolean).join(' · ')}{firm.tin && <><br />TIN: {firm.tin}</>}
          </div>
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
            <tr><th style={{ width: 28 }} title="On invoice" /><th>Description</th><th>Attorney</th><th>Hours</th><th>Rate ({billingCurrency}/hr)</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.key} style={e.included ? undefined : { opacity: 0.45 }}>
                <td>
                  <input
                    type="checkbox" checked={e.included} disabled={!isAdmin}
                    title={isAdmin ? (e.included ? 'On invoice — untick to leave it off' : 'Not on invoice — tick to add it') : 'Only admins choose what goes on the invoice'}
                    onChange={ev => setLogInInvoice(e.pid, e.index, ev.target.checked)}
                  />
                </td>
                <td>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.desc}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }} title="Shown here only — not on the PDF or email">{e.matter}</div>
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>{e.empName.split(' ').map((w, j) => (j === 0 ? w : w[0] + '.')).join(' ')}</td>
                <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{e.hours}h</td>
                <td>
                  <input
                    type="number" className="input" placeholder={billingCurrency === 'AMD' ? 'e.g. 50000' : 'e.g. 200'} min={0} step={billingCurrency === 'AMD' ? 1000 : 10}
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
          {includeVat && <div className="inv-tot-row"><span className="inv-tot-label">VAT ({firm.vatRate}%)</span><span className="inv-tot-val">{fmt(tax)}</span></div>}
          <div className="inv-tot-row final"><span className="inv-tot-label">Total Due ({billingCurrency}){!includeVat && ' · excl. VAT'}</span><span className="inv-tot-val">{fmt(total)}</span></div>
        </div>
      </div>
      <div className="inv-actions">
        <button className="btn-solid" onClick={openInvoice}><MailIcon size={14} /> Send to Client</button>
        <button className="btn-outline" onClick={openInvoice}><FileTextIcon size={14} /> Export PDF</button>
      </div>
      {open && (
        <InvoiceModal
          kind="time" client={client} timeLines={lines} period={periodLabel(period)} invNum={invNum}
          includeVat={includeVat} setIncludeVat={setIncludeVat} onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
