import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { normalizeFirm } from '@/lib/helpers';
import { invoiceTotals, type InvoiceDoc, type InvoiceLine } from '@/lib/invoice';
import { sendInvoiceEmail } from '@/lib/mail-server';
import type { Currency, FirmSettings } from '@/lib/types';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_J8YC4rtR3fqhkSFFG5cBJg_FRP0jmN7';

/** A new invoice (`doc` + `bankId`), or `invoiceId` to send a saved one (migration 015) again. */
type Body = { to?: string; bankId?: string; invoiceId?: string; doc?: Partial<InvoiceDoc> & { lines?: Partial<InvoiceLine>[] } };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const num = (v: unknown) => Math.max(0, Number(v) || 0);
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Emails an invoice from Billing & Invoices to a client. Admins only.
 *  New invoices: firm details and the bank account come from firm_settings, not from the request, and the
 *  invoice is saved to `invoices` once sent. Re-sends use the saved invoice exactly as it was first sent. */
export async function POST(req: Request) {
  const APP_URL = process.env.APP_URL || new URL(req.url).origin;

  // Queries run as the caller, so RLS applies.
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return fail('You are signed out. Sign in again and retry.', 401);
  const sb = createClient(SB_URL, SB_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user?.email) return fail('You are signed out. Sign in again and retry.', 401);
  const { data: members } = await sb.from('team_members').select('id, name, email, is_admin');
  const sender = members?.find(x => x.email?.toLowerCase() === auth.user!.email!.toLowerCase());
  if (!sender?.is_admin) return fail('Only admins can send invoices.', 403);

  const b = (await req.json().catch(() => ({}))) as Body;
  const to = str(b.to, 320).trim();
  if (!EMAIL_RE.test(to)) return fail('Enter a valid email address.', 400);
  const send = { to, at: new Date().toISOString(), by: sender.id };
  const replyFor = (firm: FirmSettings) => firm.billingEmail || sender.email;

  // ── Send a saved invoice again ──
  if (b.invoiceId) {
    const { data: inv, error: loadErr } = await sb.from('invoices').select('*').eq('id', b.invoiceId).maybeSingle();
    if (loadErr || !inv) return fail('That invoice was not found.', 404);
    const error = await sendInvoiceEmail({ to, doc: inv.doc, firm: normalizeFirm(inv.firm), appUrl: APP_URL, replyTo: replyFor(normalizeFirm(inv.firm)) });
    if (error) return fail(error, 502);
    const { error: saveErr } = await sb.from('invoices').update({ sends: [...(inv.sends || []), send] }).eq('id', inv.id);
    if (saveErr) console.error('Invoice send not recorded', saveErr);
    return NextResponse.json({ sent: true, id: inv.id, recorded: !saveErr });
  }

  const d = b.doc || {};
  const kind = d.kind === 'amount' ? 'amount' : 'time';
  const currency = (['USD', 'EUR', 'AMD'] as const).includes(d.currency as Currency) ? (d.currency as Currency) : null;
  if (!currency || !d.client || !d.invNum || !Array.isArray(d.lines)) return fail('Bad request.', 400);

  const lines: InvoiceLine[] = d.lines.slice(0, 500).map(l => (kind === 'time'
    ? { desc: str(l.desc, 1000), attorney: str(l.attorney, 120), hours: num(l.hours), rate: num(l.rate) }
    : { desc: str(l.desc, 1000), amount: num(l.amount) }))
    .filter(l => l.desc.trim() && (kind === 'time' ? l.hours! > 0 && l.rate! > 0 : l.amount! > 0));
  if (!lines.length) return fail(kind === 'time' ? 'Enter hourly rates before sending the invoice.' : 'Add at least one line with an amount.', 400);

  const { data: fs } = await sb.from('firm_settings').select('data').eq('id', 'firm').maybeSingle();
  const firm = normalizeFirm(fs?.data);
  const bank = firm.banks.find(x => x.id === b.bankId);

  const doc: InvoiceDoc = {
    kind, currency, lines,
    invNum: str(d.invNum, 60),
    issueDate: DATE_RE.test(String(d.issueDate)) ? String(d.issueDate) : new Date().toISOString().slice(0, 10),
    period: d.period ? str(d.period, 60) : undefined,
    client: str(d.client, 200),
    clientDetails: d.clientDetails ? str(d.clientDetails, 1000) : undefined,
    includeVat: d.includeVat !== false,
    showAttorneys: kind === 'time' && d.showAttorneys !== false,
    paymentTerms: str(d.paymentTerms || firm.paymentTerms, 100),
    bankDetails: bank?.details,
    note: d.note ? str(d.note, 3000) : undefined,
  };

  const error = await sendInvoiceEmail({ to, doc, firm, appUrl: APP_URL, replyTo: replyFor(firm) });
  if (error) return fail(error, 502);

  // The email went out; keep a copy for Sent Invoices. If saving fails (e.g. migration 015 not run) the send still counts.
  const { data: saved, error: saveErr } = await sb.from('invoices').insert({
    inv_num: doc.invNum, client: doc.client, kind: doc.kind, currency: doc.currency,
    total: invoiceTotals(doc, firm.vatRate).total, doc, firm, sends: [send], created_by: sender.id,
  }).select('id').single();
  if (saveErr) console.error('Invoice not saved', saveErr);
  return NextResponse.json({ sent: true, id: saved?.id, recorded: !saveErr });
}
