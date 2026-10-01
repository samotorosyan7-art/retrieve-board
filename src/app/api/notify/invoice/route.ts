import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { DEFAULT_FIRM } from '@/lib/constants';
import { sendInvoiceEmail, type InvoiceLine } from '@/lib/mail-server';
import type { Currency } from '@/lib/types';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_J8YC4rtR3fqhkSFFG5cBJg_FRP0jmN7';

type Body = {
  to?: string; client?: string; invNum?: string; period?: string; currency?: string;
  includeVat?: boolean; lines?: Partial<InvoiceLine>[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Emails an invoice from Billing & Invoices to a client. Admins only. */
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
  const currency = (['USD', 'EUR', 'AMD'] as const).includes(b.currency as Currency) ? (b.currency as Currency) : null;
  if (!currency || !b.client || !b.invNum || !b.period || !Array.isArray(b.lines)) return fail('Bad request.', 400);
  const lines: InvoiceLine[] = b.lines.slice(0, 500).map(l => ({
    desc: str(l.desc, 500), matter: str(l.matter, 300), attorney: str(l.attorney, 120),
    hours: Math.max(0, Number(l.hours) || 0), rate: Math.max(0, Number(l.rate) || 0),
  })).filter(l => l.hours > 0 && l.rate > 0);
  if (!lines.length) return fail('Enter hourly rates before sending the invoice.', 400);

  const { data: fs } = await sb.from('firm_settings').select('data').eq('id', 'firm').maybeSingle();
  const firm = { ...DEFAULT_FIRM, ...(fs?.data || {}) };

  const error = await sendInvoiceEmail({
    to, client: str(b.client, 200), invNum: str(b.invNum, 60), period: str(b.period, 60), currency,
    lines, includeVat: b.includeVat !== false, firm, appUrl: APP_URL,
    replyTo: firm.billingEmail || sender.email,
  });
  if (error) return fail(error, 502);
  return NextResponse.json({ sent: true });
}
