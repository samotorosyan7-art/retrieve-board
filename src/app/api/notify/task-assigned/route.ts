import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { fmtDate } from '@/lib/helpers';

// Server-only: RESEND_API_KEY must never be exposed to the browser.
// RESEND_FROM must use a domain verified in Resend; onboarding@resend.dev only delivers to the Resend account owner.
const FROM = process.env.RESEND_FROM || 'Retrieve PM <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || 'https://retrieve.group';
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_J8YC4rtR3fqhkSFFG5cBJg_FRP0jmN7';

type Body = { assigneeId?: string; title?: string; matter?: string; due?: string; priority?: string; notes?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ sent: false, reason: 'disabled' });

  // Only signed-in team members may trigger emails. Queries run as the caller, so RLS applies.
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = createClient(SB_URL, SB_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.assigneeId || !b.title) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  // Recipient comes from team_members, never from the request, so this can't be used to email arbitrary addresses.
  const { data: members } = await sb.from('team_members').select('id, name, email');
  const assignee = members?.find(m => m.id === b.assigneeId);
  const sender = members?.find(m => m.email?.toLowerCase() === auth.user!.email!.toLowerCase());
  if (!assignee?.email || !sender) return NextResponse.json({ sent: false, reason: 'no recipient' });
  if (assignee.id === sender.id) return NextResponse.json({ sent: false, reason: 'self' });

  const title = b.title.slice(0, 300);
  const rows: [string, string][] = [
    ['Matter', b.matter || '—'],
    ['Due', b.due ? fmtDate(b.due) : 'No deadline'],
    ['Priority', b.priority || 'medium'],
  ];
  const notes = (b.notes || '').slice(0, 5000);
  const first = assignee.name.split(' ')[0];

  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#1a1a1a">
  <p>Hi ${esc(first)},</p>
  <p>${esc(sender.name)} assigned you a new to-do:</p>
  <h2 style="font-size:18px;margin:16px 0 8px">${esc(title)}</h2>
  <table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) =>
    `<tr><td style="padding:2px 16px 2px 0;color:#666">${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>
  ${notes ? `<p style="white-space:pre-wrap;font-size:14px;background:#f5f5f5;padding:12px;border-radius:6px">${esc(notes)}</p>` : ''}
  <p><a href="${APP_URL}" style="color:#2563eb">Open Retrieve PM →</a></p>
</div>`;
  const text = `Hi ${first},\n\n${sender.name} assigned you a new to-do: ${title}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}${notes ? `\n\n${notes}` : ''}\n\n${APP_URL}`;

  const { error } = await new Resend(key).emails.send({
    from: FROM, to: assignee.email, replyTo: auth.user.email,
    subject: `New to-do: ${title}`, html, text,
  });
  if (error) {
    console.error('Resend failed', error);
    return NextResponse.json({ sent: false, reason: 'send failed' }, { status: 502 });
  }
  return NextResponse.json({ sent: true });
}
