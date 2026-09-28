import { getSupabase } from './supabase';
import type { Activity, ChatMessage, Client, Project, Task } from './types';

/* ── Row converters (DB snake_case ↔ app camelCase) ── */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/* Optional columns — added by supabase/migrations/001_matter_fields.sql. Until that migration runs we
   detect their absence on load and simply don't send them (the values stay in the local cache). */
const OPTIONAL_PROJECT_COLS = ['matter_type', 'is_private', 'created_by'] as const;
const projectCols = new Set<string>();

export function projectToRow(p: Project) {
  const optional: Row = {};
  if (projectCols.has('matter_type')) optional.matter_type = p.matterType || null;
  if (projectCols.has('is_private')) optional.is_private = !!p.isPrivate;
  if (projectCols.has('created_by')) optional.created_by = p.createdBy || null;
  return {
    ...optional,
    id: p.id, title: p.title, client: p.client, area: p.area,
    status: p.status, priority: p.priority, progress: p.progress || 0,
    assignees: p.assignees || [], due_date: p.due || null,
    notes: p.notes || '', files: p.files || [], time_logs: p.timeLogs || [],
    created_at: p.created ? p.created + 'T00:00:00Z' : new Date().toISOString(),
  };
}
export function rowToProject(r: Row): Project {
  return {
    id: r.id, title: r.title, client: r.client, area: r.area,
    status: r.status === 'active' ? 'inprogress' : r.status,
    priority: r.priority, progress: r.progress || 0,
    assignees: r.assignees || [], due: r.due_date || '',
    notes: r.notes || '', files: r.files || [], timeLogs: r.time_logs || [],
    created: r.created_at ? r.created_at.split('T')[0] : '',
    ...('matter_type' in r ? { matterType: r.matter_type || '' } : {}),
    ...('is_private' in r ? { isPrivate: !!r.is_private } : {}),
    ...('created_by' in r ? { createdBy: r.created_by || undefined } : {}),
  };
}
export function taskToRow(t: Task) {
  return {
    id: t.id, project_id: t.pid || null, title: t.title,
    assigned_to: t.who, done: !!t.done,
    due_date: t.due || null, time_slot: t.time || null,
    priority: t.priority || 'medium', est_hours: t.estHours || 0,
    notes: t.notes || '', subtasks: t.subtasks || [],
  };
}
export function rowToTask(r: Row): Task {
  return {
    id: r.id, pid: r.project_id || '', title: r.title,
    who: r.assigned_to, done: !!r.done,
    due: r.due_date || '', time: r.time_slot || '',
    priority: r.priority || 'medium', estHours: r.est_hours || 0,
    notes: r.notes || '', subtasks: r.subtasks || [],
  };
}
export function clientToRow(c: Client) {
  return {
    id: c.id, name: c.name, type: c.type, contact: c.contact,
    email: c.email || '', phone: c.phone || '', address: c.address || '',
    tax_id: c.taxId || '', notes: c.notes || '',
    since: c.since || null, active: c.active !== false,
  };
}
export function rowToClient(r: Row): Client {
  return {
    id: r.id, name: r.name, type: r.type, contact: r.contact,
    email: r.email || '', phone: r.phone || '', address: r.address || '',
    taxId: r.tax_id || '', notes: r.notes || '',
    since: r.since || '', active: r.active !== false,
  };
}
export function rowToActivity(r: Row): Activity {
  const m = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60000);
  const time = m < 1 ? 'Just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago';
  return { who: r.who, text: r.text, time };
}
export function rowToMessage(r: Row): ChatMessage {
  return { id: r.id, room: r.room_id, who: r.sender_id, text: r.content, time: r.created_at };
}

/* ── Reads ── */
export async function loadAll() {
  const sb = getSupabase();
  if (!sb) throw new Error('No database connection');
  const [pRes, tRes, cRes, aRes] = await Promise.all([
    sb.from('projects').select('*').order('created_at', { ascending: false }),
    sb.from('tasks').select('*').order('due_date'),
    sb.from('clients').select('*').order('name'),
    sb.from('activity').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  for (const res of [pRes, tRes, cRes, aRes]) if (res.error) throw res.error;
  const sample = pRes.data?.[0];
  if (sample) for (const c of OPTIONAL_PROJECT_COLS) if (c in sample) projectCols.add(c);
  return {
    projects: (pRes.data || []).map(rowToProject),
    tasks: (tRes.data || []).map(rowToTask),
    clients: (cRes.data || []).map(rowToClient),
    activity: (aRes.data || []).map(rowToActivity),
  };
}

export async function loadMessages(roomId: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('messages').select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data || []).map(rowToMessage);
}

/* ── Writes ── */
export type Mutation =
  | { type: 'project'; entity: Project }
  | { type: 'project_delete'; id: string }
  | { type: 'task'; entity: Task }
  | { type: 'task_delete'; id: string }
  | { type: 'client'; entity: Client }
  | { type: 'client_delete'; id: string }
  | { type: 'activity'; entity: { who: string; text: string } }
  | { type: 'message'; entity: { room: string; who: string; text: string } };

export async function write(m: Mutation) {
  const sb = getSupabase();
  if (!sb) throw new Error('No database connection');
  let res;
  // Deletes return the removed rows so we can tell a silent no-op (e.g. a row-level-security block) from success.
  const del = async (table: string, id: string) => {
    const r = await sb.from(table).delete().eq('id', id).select('id');
    if (!r.error && !r.data?.length) throw new Error(`Delete from ${table} affected no rows`);
    return r;
  };
  switch (m.type) {
    case 'project':       res = await sb.from('projects').upsert(projectToRow(m.entity), { onConflict: 'id' }); break;
    case 'task':          res = await sb.from('tasks').upsert(taskToRow(m.entity), { onConflict: 'id' }); break;
    case 'project_delete': res = await del('projects', m.id); break;
    case 'task_delete':   res = await del('tasks', m.id); break;
    case 'client':        res = await sb.from('clients').upsert(clientToRow(m.entity), { onConflict: 'id' }); break;
    case 'client_delete': res = await del('clients', m.id); break;
    case 'activity':      res = await sb.from('activity').insert({ who: m.entity.who, text: m.entity.text }); break;
    case 'message':
      res = await sb.from('messages').insert({ room_id: m.entity.room, sender_id: m.entity.who, content: m.entity.text });
      break;
  }
  if (res.error) throw res.error;
}
