import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendMatterEmail } from '@/lib/mail-server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';

/** YYYY-MM-DD in the firm's timezone, `days` from today. */
const ymd = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yerevan' }).format(new Date(Date.now() + days * 86_400_000));

/**
 * Daily (vercel.json cron): email every assignee of an open task that's due within the next 48 hours.
 * Each due date is reminded once — projects.due_reminder_sent (migration 004) records it.
 * Needs CRON_SECRET (Vercel sends it as a Bearer token) and SUPABASE_SERVICE_ROLE_KEY, both server-only.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.RESEND_API_KEY) return NextResponse.json({ sent: 0, reason: 'disabled' });
  const APP_URL = process.env.APP_URL || new URL(req.url).origin;

  // Service role bypasses RLS — this route only reads tasks/members and stamps due_reminder_sent.
  const sb = createClient(SB_URL, serviceKey, { auth: { persistSession: false } });
  const [{ data: matters, error }, { data: members }] = await Promise.all([
    sb.from('projects').select('*')
      .not('status', 'in', '(done,archive)')
      .gte('due_date', ymd(0)).lte('due_date', ymd(2)),
    sb.from('team_members').select('id, name, email, is_admin'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const m of matters || []) {
    if (m.due_reminder_sent === m.due_date) continue;
    const onTask = new Set<string>(m.assignees || []);
    const recipients = (members || []).filter(x => onTask.has(x.id) && x.email
      && (!m.is_private || x.is_admin || x.id === m.created_by));
    const when = m.due_date === ymd(0) ? 'today' : m.due_date === ymd(1) ? 'tomorrow' : 'in 2 days';
    for (const to of recipients) {
      if (await sendMatterEmail({
        to, matter: m, appUrl: APP_URL,
        intro: `Reminder: this task is due ${when}.`,
        subject: `Due ${when}: ${String(m.title).slice(0, 200)}`,
      })) sent++;
    }
    await sb.from('projects').update({ due_reminder_sent: m.due_date }).eq('id', m.id);
  }
  return NextResponse.json({ sent, tasks: matters?.length ?? 0 });
}
