import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendLoginEmail, setPasswordLink } from '@/lib/mail-server';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvtipqzcupegawhufzsw.supabase.co';

// One email per address per minute (per server instance) — stops the button being used to spam someone.
const COOLDOWN_MS = 60_000;
const lastSent = new Map<string, number>();

/**
 * "Forgot password?" on the sign-in page. Emails a link to /reset-password through Resend, so Supabase's
 * built-in email limits don't apply. Only team members get an email, and the answer is the same either way,
 * so the form can't be used to find out who has an account.
 * Needs SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY, both server-only.
 */
export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Password reset emails are not set up on the server.' }, { status: 503 });
  }
  const APP_URL = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '');

  const b = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@') || email.length > 320) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });

  const now = Date.now();
  if (now - (lastSent.get(email) || 0) < COOLDOWN_MS) return NextResponse.json({ sent: true });
  lastSent.set(email, now);

  const admin = createClient(SB_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Case-insensitive exact match (\ % _ escaped so they aren't wildcards); then only the stored address is used.
  const { data: rows } = await admin.from('team_members').select('name, email').ilike('email', email.replace(/[\\%_]/g, c => '\\' + c));
  const member = rows?.find(r => r.email?.toLowerCase() === email);
  if (!member) return NextResponse.json({ sent: true });

  const redirectTo = `${APP_URL}/reset-password`;
  let res = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } });
  // On the team list but never invited: create their login now.
  if (res.error) res = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } });
  if (res.error || !res.data.properties?.hashed_token) {
    console.error('generateLink failed', res.error);
    return NextResponse.json({ error: 'Could not create a reset link. Try again later.' }, { status: 500 });
  }

  const ok = await sendLoginEmail({ to: { name: member.name || email, email: member.email }, link: setPasswordLink(APP_URL, res.data.properties), isNew: false });
  if (!ok) return NextResponse.json({ error: 'The email service rejected the message. Try again later.' }, { status: 502 });
  return NextResponse.json({ sent: true });
}
