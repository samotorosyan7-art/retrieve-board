import { getSupabase } from './supabase';

/* Task-assignment emails via Resend, sent server-side by /api/notify/matter-assigned. Disabled unless RESEND_API_KEY is set. */

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
