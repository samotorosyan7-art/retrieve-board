'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { InvoiceModal } from '@/components/modals/InvoiceModal';
import { PageHeader } from '@/components/ui';
import { LOGO_SRC } from '@/lib/constants';
import { fmtCurrency, homePath, today } from '@/lib/helpers';
import { roundHours, timeCharges, type InvoiceLine } from '@/lib/invoice';
import type { Currency } from '@/lib/types';
import { FileTextIcon, LockIcon, MailIcon, PencilIcon, ReceiptIcon, TriangleAlertIcon } from 'lucide-react';

/** Suggested number for a new invoice in a period — editable in the invoice window. */
const newInvNum = (period: string) => `INV-${period.slice(5, 7)}-${period.slice(0, 4)}-${Math.floor(Math.random() * 900 + 100)}`;

/** 'YYYY-MM' → 'October 2026'. */
const periodLabel = (period: string) => `${MONTHS[+period.slice(5, 7)]} ${period.slice(0, 4)}`;
const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A billable time entry. Every one is listed; only those with `included` are charged on the invoice. */
type Entry = { key: string; pid: string; index: number; who: string; hours: number; desc: string; matter: string; empName: string; included: boolean };

export default function BillingPage() {
  const { currentUser, projects, emp, firm, toast } = useStore();
  const router = useRouter();
  const allowed = !!currentUser?.isAdmin;
  // Billing period as 'YYYY-MM', matched against each entry's date. Starts on the current month.
  const [period, setPeriod] = useState(() => today().slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [invoiceTotal, setInvoiceTotal] = useState<{ amount: number; currency: Currency } | null>(null);
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
  const hoursOf = (entries: Entry[]) => roundHours(entries.reduce((s, e) => s + (e.included ? e.hours : 0), 0));
  const monthHours = roundHours(clients.reduce((s, [, e]) => s + hoursOf(e), 0));

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
                {invoiceTotal && invoiceTotal.amount > 0
                  ? `${active[0]}: ${fmtCurrency(invoiceTotal.amount, invoiceTotal.currency)} ${includeVat ? `incl. ${firm.vatRate}% VAT` : 'excl. VAT'}`
                  : 'Set billing terms on the client to calculate'}
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
  client: string; entries: Entry[]; period: string; includeVat: boolean; setIncludeVat: (v: boolean) => void;
  onTotal: (v: { amount: number; currency: Currency } | null) => void;
}) {
  const { currentUser, clients, clientBilling, setLogInInvoice, setModal, firm, toast } = useStore();
  const [open, setOpen] = useState(false);
  const isAdmin = !!currentUser?.isAdmin;
  const invNum = useMemo(() => newInvNum(period), [period]);
  // Rate, regular hours and monthly fee are set per client on the Clients page (migration 024).
  const record = clients.find(c => c.name.trim().toLowerCase() === client.trim().toLowerCase());
  const terms = record ? clientBilling[record.id] : undefined;
  const currency = terms?.currency ?? 'AMD';
  const fmt = (v: number) => (v > 0 ? fmtCurrency(v, currency) : '—');

  // What goes on the PDF / email: included entries, one row each with its task.
  const lines: InvoiceLine[] = entries.filter(e => e.included).map(e => ({ desc: e.desc, task: e.matter, attorney: e.empName, hours: e.hours }));
  const hours = roundHours(lines.reduce((s, l) => s + (l.hours || 0), 0));
  const { charges, sub } = terms ? timeCharges(terms, hours, fmt) : { charges: [], sub: 0 };
  const tax = includeVat ? sub * (firm.vatRate / 100) : 0, total = sub + tax;

  useEffect(() => { onTotal(terms ? { amount: total, currency } : null); }, [total, currency, terms, onTotal]);

  const openInvoice = () => (!terms
    ? toast(TriangleAlertIcon, 'No billing terms', `Set ${client}'s hourly rate, regular hours and monthly fee on the Clients page first.`)
    : total > 0 ? setOpen(true) : toast(TriangleAlertIcon, 'Nothing to charge', 'No entries on the invoice add up to an amount.'));

  return (
    <div className="inv-wrap">
      <div className="inv-hint" style={{ background: terms ? 'rgba(56,189,248,0.08)' : 'rgba(251,146,60,0.08)', border: `1px solid ${terms ? 'rgba(56,189,248,0.2)' : 'rgba(251,146,60,0.25)'}`, borderRadius: 'var(--r-lg)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        {terms ? <PencilIcon size={16} /> : <TriangleAlertIcon size={16} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>
            {terms
              ? [terms.monthlyFee > 0 && `${fmtCurrency(terms.monthlyFee, currency)}/month`, terms.regularHours > 0 && `${terms.regularHours}h included`, terms.hourlyRate > 0 && `${fmtCurrency(terms.hourlyRate, currency)}/hr${terms.monthlyFee > 0 || terms.regularHours > 0 ? ' above that' : ''}`].filter(Boolean).join(' · ') || 'Billing terms are all zero'
              : `No billing terms for ${client}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
            {terms
              ? <>Billing terms come from the client.{isAdmin && ' Untick an entry to leave it off the invoice.'} Then export the PDF or send it — you choose the bank account and options there.</>
              : record ? 'Set the hourly rate, regular hours and monthly fee for this client to calculate the invoice.' : `"${client}" isn't in your client list — add it on the Clients page to set billing terms.`}
          </div>
        </div>
        {record && (
          <button className="btn-outline" style={{ fontSize: 11.5, padding: '5px 10px', whiteSpace: 'nowrap' }} onClick={() => setModal({ kind: 'client', id: record.id })}>
            <PencilIcon size={12} /> {terms ? 'Edit terms' : 'Set terms'}
          </button>
        )}
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
          <div style={{ fontSize: 10.5, color: 'var(--s-billing)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{currency}</div>
        </div>
      </div>
      <div className="inv-client-block">
        <div><div className="icb-to">Billed to</div><div className="icb-name">{client}</div></div>
        <div className="icb-date">{periodLabel(period)}<br />Due {firm.paymentTerms}</div>
      </div>
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: 14 }}>
        <table className="inv-tbl">
          <thead>
            <tr><th style={{ width: 28 }} title="On invoice" /><th>Task</th><th>Description</th><th>Attorney</th><th style={{ textAlign: 'right' }}>Hours</th></tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.key} style={e.included ? undefined : { opacity: 0.45 }}>
                <td>
                  <input
                    type="checkbox" checked={e.included} disabled={!isAdmin}
                    title={isAdmin ? (e.included ? 'On invoice — untick to leave it off' : 'Not on invoice — tick to add it') : 'Only admins choose what goes on the invoice'}
                    onChange={ev => setLogInInvoice(e.pid, e.index, ev.target.checked)}
                  />
                </td>
                <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{e.matter}</td>
                <td style={{ fontSize: 12, color: 'var(--text-primary)' }}>{e.desc}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{e.empName.split(' ').map((w, j) => (j === 0 ? w : w[0] + '.')).join(' ')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{e.hours}h</td>
              </tr>
            ))}
            <tr>
              <td />
              <td colSpan={3} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                Total hours{terms && terms.regularHours > 0 && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> · {terms.regularHours}h regular{hours > terms.regularHours ? `, ${roundHours(hours - terms.regularHours)}h additional` : `, ${roundHours(terms.regularHours - hours)}h unused`}</span>}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{hours}h</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="inv-totals">
        <div className="inv-totals-block" style={{ width: 340 }}>
          {charges.map(c => <div key={c.label} className="inv-tot-row"><span className="inv-tot-label">{c.label}</span><span className="inv-tot-val">{fmt(c.amount)}</span></div>)}
          <div className="inv-tot-row"><span className="inv-tot-label">Subtotal</span><span className="inv-tot-val">{fmt(sub)}</span></div>
          {includeVat && <div className="inv-tot-row"><span className="inv-tot-label">VAT ({firm.vatRate}%)</span><span className="inv-tot-val">{fmt(tax)}</span></div>}
          <div className="inv-tot-row final"><span className="inv-tot-label">Total Due ({currency}){!includeVat && ' · excl. VAT'}</span><span className="inv-tot-val">{fmt(total)}</span></div>
        </div>
      </div>
      <div className="inv-actions">
        <button className="btn-solid" onClick={openInvoice}><MailIcon size={14} /> Send to Client</button>
        <button className="btn-outline" onClick={openInvoice}><FileTextIcon size={14} /> Export PDF</button>
      </div>
      {open && terms && (
        <InvoiceModal
          kind="time" client={client} timeLines={lines} terms={terms} currency={currency} period={periodLabel(period)} invNum={invNum}
          includeVat={includeVat} setIncludeVat={setIncludeVat} onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
