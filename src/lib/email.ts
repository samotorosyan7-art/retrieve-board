import { fmtDate } from './helpers';
import type { Member, Project, Task } from './types';

/* Task-assignment emails via EmailJS. Disabled unless the NEXT_PUBLIC_EMAILJS_* env vars are set. */
const SERVICE = process.env.NEXT_PUBLIC_EMAILJS_SERVICE;
const TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE;
const KEY = process.env.NEXT_PUBLIC_EMAILJS_KEY;

type EmailJS = { init: (k: string) => void; send: (s: string, t: string, p: Record<string, string>) => Promise<unknown> };

async function loadEmailJS(): Promise<EmailJS> {
  const w = window as unknown as { emailjs?: EmailJS };
  if (w.emailjs) return w.emailjs;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  w.emailjs!.init(KEY!);
  return w.emailjs!;
}

/** Returns true if an email was sent. Fails silently — the task is saved either way. */
export async function sendTaskAssignmentEmail(task: Task, assignee: Member | undefined, from: Member | null, matter: Project | undefined) {
  if (!SERVICE || !TEMPLATE || !KEY) return false;
  if (task.who === from?.id || !assignee?.email) return false;
  try {
    const emailjs = await loadEmailJS();
    await emailjs.send(SERVICE, TEMPLATE, {
      to_email: assignee.email,
      to_name: assignee.name.split(' ')[0],
      from_name: from?.name || 'Retrieve PM',
      task_title: task.title,
      matter_name: matter?.title || '—',
      due_date: task.due ? fmtDate(task.due) : 'No deadline',
      priority: task.priority || 'medium',
      notes: task.notes || '',
      platform_url: 'https://retrieve.group',
    });
    return true;
  } catch (e) {
    console.warn('Email notification failed', e);
    return false;
  }
}
