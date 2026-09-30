import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendLoginEmail } from '@/lib/mail-server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_J8YC4rtR3fqhkSFFG5cBJg_FRP0jmN7';

type Body = { memberId?: string };

/**
 * Emails a team member a link to /reset-password where they choose a password.
 * New people get an invitation (this creates their Supabase Auth login); people who already have one get a reset link.
 * Admins only. Links are generated here and sent through Resend, so Supabase's own email limits don't apply.
 * Needs SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY, both server-only.
 */
export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Invitations are not set up on the server (SUPABASE_SERVICE_ROLE_KEY / RESEND_API_KEY).' }, { status: 503 });
  }
  const APP_URL = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '');

  // The caller must be a signed-in admin. These queries run as the caller, so RLS applies.
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = createClient(SB_URL, SB_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.memberId) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  // The recipient is read from the database, never taken from the request, so this only emails real team members.
  const { data: members } = await sb.from('team_members').select('id, name, email, is_admin');
  const sender = members?.find(x => x.email?.toLowerCase() === auth.user!.email!.toLowerCase());
  if (!sender?.is_admin) return NextResponse.json({ error: 'Only admins can invite members.' }, { status: 403 });
  const to = members?.find(x => x.id === b.memberId);
  if (!to?.email) return NextResponse.json({ error: 'Member not found.' }, { status: 404 });

  const admin = createClient(SB_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = to.email.toLowerCase();
  const redirectTo = `${APP_URL}/reset-password`;
  let isNew = true;
  let res = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
  if (res.error?.code === 'email_exists' || res.error?.code === 'user_already_exists' || res.error?.status === 422) {
    isNew = false;
    res = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
  }
  if (res.error || !res.data.properties?.action_link) {
    console.error('generateLink failed', res.error);
    return NextResponse.json({ error: res.error?.message || 'Could not create a sign-in link.' }, { status: 500 });
  }

  const ok = await sendLoginEmail({ to, link: res.data.properties.action_link, isNew, invitedBy: sender.name });
  if (!ok) return NextResponse.json({ error: 'The email service rejected the message.' }, { status: 502 });
  return NextResponse.json({ sent: true, isNew });
}
