import { Resend } from 'resend';
import { fmtDate } from './helpers';

/* Shared by the /api notify + cron routes. Server-only: RESEND_API_KEY must never reach the browser.
   RESEND_FROM must use a domain verified in Resend; onboarding@resend.dev only delivers to the Resend account owner. */
const FROM = process.env.RESEND_FROM || 'Retrieve PM <onboarding@resend.dev>';

export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type MatterRow = { id: string; title: string; client: string | null; due_date: string | null; priority: string | null; notes: string | null };

/** Email about one task (matter). Returns false if email is disabled or Resend rejected it. */
export async function sendMatterEmail(opts: {
  to: { name: string; email: string };
  intro: string;
  subject: string;
  matter: MatterRow;
  appUrl: string;
  replyTo?: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const { to, intro, subject, matter: m, appUrl, replyTo } = opts;
  const first = to.name.split(' ')[0];
  const title = m.title.slice(0, 300);
  const rows: [string, string][] = [
    ['Client', m.client || '—'],
    ['Due', m.due_date ? fmtDate(m.due_date) : 'No deadline'],
    ['Priority', m.priority || 'medium'],
  ];
  const notes = (m.notes || '').slice(0, 5000);

  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#1a1a1a">
  <p>Hi ${esc(first)},</p>
  <p>${esc(intro)}</p>
  <h2 style="font-size:18px;margin:16px 0 8px">${esc(title)}</h2>
  <table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) =>
    `<tr><td style="padding:2px 16px 2px 0;color:#666">${k}</td><td>${esc(v)}</td></tr>`).join('')}</table>
  ${notes ? `<p style="white-space:pre-wrap;font-size:14px;background:#f5f5f5;padding:12px;border-radius:6px">${esc(notes)}</p>` : ''}
  <p><a href="${appUrl}/list" style="color:#2563eb">Open Retrieve PM →</a></p>
</div>`;
  const text = `Hi ${first},\n\n${intro}\n\n${title}\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}${notes ? `\n\n${notes}` : ''}\n\n${appUrl}/list`;

  const { error } = await new Resend(key).emails.send({ from: FROM, to: to.email, replyTo, subject, html, text });
  if (error) console.error('Resend failed', error);
  return !error;
}

/** Email a sign-in link to a team member: an invitation for a new login, or a password reset for an existing one. */
export async function sendLoginEmail(opts: { to: { name: string; email: string }; link: string; isNew: boolean; invitedBy: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const { to, link, isNew, invitedBy } = opts;
  const first = to.name.split(' ')[0];
  const intro = isNew
    ? `${invitedBy} added you to Retrieve PM, the firm's task and time tracking platform. Choose a password to sign in.`
    : `${invitedBy} sent you a link to set a new password for Retrieve PM.`;
  const cta = isNew ? 'Set your password' : 'Set a new password';
  const subject = isNew ? 'You’re invited to Retrieve PM' : 'Set your Retrieve PM password';

  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;color:#1a1a1a">
  <p>Hi ${esc(first)},</p>
  <p>${esc(intro)}</p>
  <p style="margin:24px 0"><a href="${esc(link)}" style="background:#1B4F72;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">${cta} →</a></p>
  <p style="font-size:13px;color:#666">Sign in with this email address (${esc(to.email)}). The link works once and expires after a while; if it no longer works, ask an admin to send a new one.</p>
</div>`;
  const text = `Hi ${first},\n\n${intro}\n\n${cta}: ${link}\n\nSign in with this email address (${to.email}). The link works once; if it no longer works, ask an admin to send a new one.`;

  const { error } = await new Resend(key).emails.send({ from: FROM, to: to.email, subject, html, text });
  if (error) console.error('Resend failed', error);
  return !error;
}
