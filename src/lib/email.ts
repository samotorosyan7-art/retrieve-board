import { getSupabase } from './supabase';

/* Emails sent server-side via Resend: task assignments (/api/notify/matter-assigned) and member invitations (/api/notify/member-invite). */

/** Tell people they were put on a task (matter). Returns how many emails went out. */
export async function sendMatterAssignmentEmail(projectId: string, assigneeIds: string[]) {
  if (!assigneeIds.length) return 0;
  try {
    const { data } = await getSupabase()!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 0;
    const res = await fetch('/api/notify/matter-assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, assigneeIds }),
    });
    const json = await res.json().catch(() => ({}));
    return typeof json.sent === 'number' ? json.sent : 0;
  } catch (e) {
    console.warn('Email notification failed', e);
    return 0;
  }
}

/** Email a team member a link to set their password (an invitation if they have no login yet). Admins only. Returns an error message, or null on success. */
export async function sendMemberInvite(memberId: string): Promise<string | null> {
  try {
    const { data } = await getSupabase()!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return 'You are signed out. Sign in again and retry.';
    const res = await fetch('/api/notify/member-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) return null;
    const json = await res.json().catch(() => ({}));
    return typeof json.error === 'string' ? json.error : `Request failed (${res.status}).`;
  } catch (e) {
    console.warn('Invite failed', e);
    return 'Could not reach the server.';
  }
}
