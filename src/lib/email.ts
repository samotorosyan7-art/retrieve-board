import { getSupabase } from './supabase';
import type { Member, Project, Task } from './types';

/* Task-assignment emails via Resend, sent server-side by /api/notify/task-assigned. Disabled unless RESEND_API_KEY is set. */

/** Returns true if an email was sent. Fails silently — the task is saved either way. */
export async function sendTaskAssignmentEmail(task: Task, assignee: Member | undefined, from: Member | null, matter: Project | undefined) {
  if (task.who === from?.id || !assignee?.email) return false;
  try {
    const { data } = await getSupabase()!.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const res = await fetch('/api/notify/task-assigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        assigneeId: assignee.id,
        title: task.title,
        matter: matter?.title,
        due: task.due,
        priority: task.priority,
        notes: task.notes,
      }),
    });
    const json = await res.json().catch(() => ({}));
    return !!json.sent;
  } catch (e) {
    console.warn('Email notification failed', e);
    return false;
  }
}

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
