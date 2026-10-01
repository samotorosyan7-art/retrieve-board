import { Resend } from 'resend';
import { fmtDue } from './helpers';
import { PRIORITIES } from './constants';

/* Shared by the /api notify + cron routes. Server-only: RESEND_API_KEY must never reach the browser.
   RESEND_FROM must use a domain verified in Resend; onboarding@resend.dev only delivers to the Resend account owner. */
const FROM = process.env.RESEND_FROM || 'Retrieve Group <onboarding@resend.dev>';

/** Link straight to our /reset-password page, which confirms the token itself (supabase.auth.verifyOtp).
 *  Unlike Supabase's action_link this doesn't depend on the Redirect URLs allowlist, and email scanners
 *  that open links can't use it up because nothing happens until the page's script runs. */
export const setPasswordLink = (appUrl: string, props: { hashed_token: string; verification_type: string }) =>
  `${appUrl}/reset-password?token_hash=${encodeURIComponent(props.hashed_token)}&type=${encodeURIComponent(props.verification_type)}`;

export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type MatterRow = { id: string; title: string; client: string | null; due_date: string | null; due_time?: string | null; priority: string | null; notes: string | null };

/* ── Email layout ──
   Email clients ignore <style> blocks and modern CSS unevenly, so everything is tables + inline styles,
   600px wide, with system fonts. Colors match the app's navy/gold brand. */
const C = {
  navy: '#0A1628', navySoft: '#2D4A7A', gold: '#C8A951', page: '#F4F6F9', card: '#FFFFFF',
  text: '#0A1628', muted: '#6B87AA', line: '#E4E9F2', panel: '#F7F9FC',
};
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/** Gold call-to-action button (table-based so it renders in Outlook too). */
const button = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
  <tr><td bgcolor="${C.gold}" style="border-radius:8px">
    <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.navy};text-decoration:none;border-radius:8px">${esc(label)} &rarr;</a>
  </td></tr>
</table>`;

/** The shared frame: navy header with logo, white card, footer. `preheader` is the inbox preview line. */
function layout(opts: { appUrl: string; preheader: string; eyebrow: string; content: string; footerNote: string }) {
  const { appUrl, preheader, eyebrow, content, footerNote } = opts;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>Retrieve Group</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
      <tr><td bgcolor="${C.navy}" style="background:${C.navy};border-radius:14px 14px 0 0;padding:22px 32px;border-bottom:3px solid ${C.gold}">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:12px"><img src="${esc(appUrl)}/logo.jpg" width="40" height="40" alt="R" style="display:block;border-radius:8px;border:0"></td>
          <td style="font-family:${FONT}">
            <div style="font-size:16px;font-weight:800;letter-spacing:0.04em;color:${C.gold}">RETRIEVE</div>
            <div style="font-size:12px;color:#B7C4D9">Legal &amp; Tax &middot; Yerevan</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${C.card}" style="background:${C.card};padding:36px 32px 32px;border-radius:0 0 14px 14px;font-family:${FONT};color:${C.text}">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.gold};margin-bottom:10px">${esc(eyebrow)}</div>
        ${content}
      </td></tr>
      <tr><td align="center" style="padding:22px 24px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted}">
        ${footerNote}<br>
        <a href="${esc(appUrl)}" style="color:${C.navySoft};text-decoration:none;font-weight:600">Retrieve Group</a> &middot; the firm&rsquo;s task &amp; time tracking platform
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

const h1 = (s: string) => `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:700;color:${C.navy}">${s}</h1>`;
const para = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#33445E">${s}</p>`;

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
  const pr = PRIORITIES.find(x => x.id === m.priority) ?? PRIORITIES[1];
  const due = m.due_date ? fmtDue({ due: m.due_date, dueTime: m.due_time || undefined }) : 'No deadline';
  const notes = (m.notes || '').slice(0, 5000);
  const taskUrl = `${appUrl}/list?task=${encodeURIComponent(m.id)}`;

  const detail = (label: string, value: string) => `
    <td valign="top" style="padding:0 16px 0 0">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};margin-bottom:4px">${label}</div>
      <div style="font-size:14px;font-weight:600;color:${C.navy}">${value}</div>
    </td>`;
  const content = `
    ${h1(`Hi ${esc(first)},`)}
    ${para(esc(intro))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border:1px solid ${C.line};border-left:4px solid ${C.gold};border-radius:10px;background:${C.panel}">
      <tr><td style="padding:20px 22px">
        <div style="font-size:18px;line-height:1.4;font-weight:700;color:${C.navy};margin-bottom:4px">${esc(title)}</div>
        <div style="font-size:13px;color:${C.muted};margin-bottom:18px">${esc(m.client || 'No client')}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${detail('Due', esc(due))}
          ${detail('Priority', `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${pr.bg};color:${pr.col};font-size:12px">${esc(pr.label)}</span>`)}
        </tr></table>
        ${notes ? `<div style="margin-top:18px;padding-top:16px;border-top:1px solid ${C.line}">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};margin-bottom:6px">Notes</div>
          <div style="font-size:14px;line-height:1.6;color:#33445E;white-space:pre-wrap">${esc(notes)}</div>
        </div>` : ''}
      </td></tr>
    </table>
    ${button(taskUrl, 'Open task')}`;
  const html = layout({
    appUrl, preheader: `${title} · due ${due}`, eyebrow: 'Task update', content,
    footerNote: 'You’re receiving this because you’re on this task in Retrieve Group.',
  });
  const text = `Hi ${first},\n\n${intro}\n\n${title}\nClient: ${m.client || '—'}\nDue: ${due}\nPriority: ${pr.label}${notes ? `\n\n${notes}` : ''}\n\nOpen task: ${taskUrl}`;

  const { error } = await new Resend(key).emails.send({ from: FROM, to: to.email, replyTo, subject, html, text });
  if (error) console.error('Resend failed', error);
  return !error;
}

/** Email a sign-in link to a team member: an invitation for a new login, or a password reset for an existing one.
 *  Without invitedBy it's a reset the member asked for themselves ("Forgot password?"). */
export async function sendLoginEmail(opts: { to: { name: string; email: string }; link: string; isNew: boolean; invitedBy?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const { to, link, isNew, invitedBy } = opts;
  const appUrl = new URL(link).origin;
  const first = to.name.split(' ')[0];
  const intro = isNew
    ? `${invitedBy} added you to Retrieve Group, the firm's task and time tracking platform. Choose a password to sign in.`
    : invitedBy
      ? `${invitedBy} sent you a link to set a new password for Retrieve Group.`
      : 'Someone (hopefully you) asked to reset your Retrieve Group password. If it wasn’t you, ignore this email — your password stays the same.';
  const cta = isNew ? 'Set your password' : 'Set a new password';
  const subject = isNew ? 'You’re invited to Retrieve Group' : 'Set your Retrieve Group password';
  const expiry = `The link works once and expires after a while; if it no longer works, ${invitedBy ? 'ask an admin to send a new one' : 'use “Forgot password?” again'}.`;

  const content = `
    ${h1(isNew ? `Welcome to the team, ${esc(first)}` : `Hi ${esc(first)},`)}
    ${para(esc(intro))}
    ${button(link, cta)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-radius:10px;background:${C.panel};border:1px solid ${C.line}">
      <tr><td style="padding:16px 18px;font-size:13px;line-height:1.6;color:#33445E">
        <strong style="color:${C.navy}">Sign in with:</strong> ${esc(to.email)}<br>${esc(expiry)}
      </td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:${C.muted}">Button not working? Paste this link into your browser:<br>
      <a href="${esc(link)}" style="color:${C.navySoft};word-break:break-all">${esc(link)}</a></p>`;
  const html = layout({
    appUrl, preheader: isNew ? `${invitedBy} invited you to Retrieve Group` : 'Set a new password for Retrieve Group',
    eyebrow: isNew ? 'Invitation' : 'Password reset', content,
    footerNote: isNew ? 'You’re receiving this because an admin added you to the team.' : 'You’re receiving this because a password link was requested for your account.',
  });
  const text = `Hi ${first},\n\n${intro}\n\n${cta}: ${link}\n\nSign in with this email address (${to.email}). ${expiry}`;

  const { error } = await new Resend(key).emails.send({ from: FROM, to: to.email, subject, html, text });
  if (error) console.error('Resend failed', error);
  return !error;
}
