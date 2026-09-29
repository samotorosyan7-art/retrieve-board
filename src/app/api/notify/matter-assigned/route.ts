import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendMatterEmail } from '@/lib/mail-server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_J8YC4rtR3fqhkSFFG5cBJg_FRP0jmN7';

type Body = { projectId?: string; assigneeIds?: string[] };

/** Emails people who were just put on a task. Sent by the browser after it saves the task. */
export async function POST(req: Request) {
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ sent: 0, reason: 'disabled' });
  const APP_URL = process.env.APP_URL || new URL(req.url).origin;

  // Only signed-in team members may trigger emails. Queries run as the caller, so RLS applies.
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = createClient(SB_URL, SB_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.projectId || !Array.isArray(b.assigneeIds)) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  // Task and recipients are read from the database, never taken from the request,
  // so this can only email people who really are on a task the caller can see.
  const { data: m } = await sb.from('projects').select('*').eq('id', b.projectId).maybeSingle();
  if (!m) return NextResponse.json({ sent: 0, reason: 'not found' });
  const { data: members } = await sb.from('team_members').select('id, name, email, is_admin');
  const sender = members?.find(x => x.email?.toLowerCase() === auth.user!.email!.toLowerCase());
  if (!sender) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const onTask = new Set<string>(m.assignees || []);
  const recipients = (members || []).filter(x =>
    b.assigneeIds!.includes(x.id) && onTask.has(x.id) && x.id !== sender.id && x.email
    // Don't reveal a private task to someone who can't open it.
    && (!m.is_private || x.is_admin || x.id === m.created_by));

  let sent = 0;
  for (const to of recipients) {
    const ok = await sendMatterEmail({
      to, matter: m, appUrl: APP_URL, replyTo: auth.user.email,
      intro: `${sender.name} assigned you a task:`,
      subject: `New task: ${String(m.title).slice(0, 200)}`,
    });
    if (ok) sent++;
  }
  return NextResponse.json({ sent });
}
