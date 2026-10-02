import { DEFAULT_FIRM, FILE_TYPES } from './constants';
import { fileExt, normalizeFirm } from './helpers';
import { getSupabase } from './supabase';
import type { Activity, Attachment, ChatMessage, Client, FirmSettings, Member, Project, SentInvoice, TaskComment, TaskFile } from './types';

/* ── Row converters (DB snake_case ↔ app camelCase) ── */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/* Optional columns — added by supabase/migrations/001_matter_fields.sql (supervisor: 007, due_time: 011). Until that migration runs we
   detect their absence on load and simply don't send them (the values stay in the local cache). */
const OPTIONAL_PROJECT_COLS = ['matter_type', 'is_private', 'created_by', 'supervisor', 'due_time'] as const;
const projectCols = new Set<string>();

export function projectToRow(p: Project) {
  const optional: Row = {};
  if (projectCols.has('matter_type')) optional.matter_type = p.matterType || null;
  if (projectCols.has('is_private')) optional.is_private = !!p.isPrivate;
  if (projectCols.has('created_by')) optional.created_by = p.createdBy || null;
  if (projectCols.has('supervisor')) optional.supervisor = p.supervisor || null;
  if (projectCols.has('due_time')) optional.due_time = (p.due && p.dueTime) || null;
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
    ...('supervisor' in r ? { supervisor: r.supervisor || undefined } : {}),
    ...('due_time' in r ? { dueTime: r.due_time || undefined } : {}),
  };
}
export function clientToRow(c: Client) {
  return {
    id: c.id, name: c.name, type: c.type, contact: c.contact,
    email: c.email || '', phone: c.phone || '', address: c.address || '',
    tax_id: c.taxId || '', notes: c.notes || '',
    since: c.since || null,
  };
}
export function rowToClient(r: Row): Client {
  return {
    id: r.id, name: r.name, type: r.type, contact: r.contact,
    email: r.email || '', phone: r.phone || '', address: r.address || '',
    taxId: r.tax_id || '', notes: r.notes || '',
    since: r.since || '',
  };
}
export function rowToActivity(r: Row): Activity {
  const m = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 60000);
  const time = m < 1 ? 'Just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago';
  return { who: r.who, text: r.text, time };
}
export function rowToMember(r: Row): Member {
  return {
    id: r.id, name: r.name, init: r.init || '', role: r.role || '', color: r.color || '#7C6FF7',
    rate: Number(r.rate) || 0, img: r.img || '', email: (r.email || '').toLowerCase(),
    isAdmin: !!r.is_admin,
  };
}
export function memberToRow(m: Member) {
  return {
    id: m.id, name: m.name, init: m.init, role: m.role, color: m.color, rate: m.rate || 0, img: m.img || '',
    email: m.email.toLowerCase(), is_admin: !!m.isAdmin,
    // Billing access and Admin Assistant were removed (migration 012): billing follows admin.
    is_billing: !!m.isAdmin, is_assistant: false,
  };
}
export function rowToMessage(r: Row): ChatMessage {
  return { id: r.id, room: r.room_id, who: r.sender_id, text: r.content, time: r.created_at,
    ...(r.attachment ? { attachment: r.attachment } : {}), ...(r.deleted_at ? { deleted: true } : {}) };
}
export function rowToComment(r: Row): TaskComment {
  return { id: r.id, projectId: r.project_id, who: r.who, text: r.text, time: r.created_at };
}

export function rowToTaskFile(r: Row): TaskFile {
  return { id: r.id, projectId: r.project_id, path: r.path, name: r.name, size: r.size, mime: r.mime, who: r.who, time: r.created_at };
}

/* ── Attachments (migration 013): private "attachments" bucket ── */
const BUCKET = 'attachments';

/** Upload a file under tasks/<id>/ or chat/<room>/. Stored under a random name (storage only allows
 *  ASCII names); the original name is kept alongside. Callers check the size/type first (checkFile). */
export async function uploadAttachment(folder: string, file: File): Promise<Attachment> {
  const ext = fileExt(file.name);
  const mime = FILE_TYPES[ext];
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase()!.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (error) throw error;
  return { path, name: file.name.slice(0, 255), size: file.size, mime };
}

export async function removeAttachment(path: string) {
  const { data, error } = await getSupabase()!.storage.from(BUCKET).remove([path]);
  if (error) throw error;
  if (!data?.length) throw new Error('The file was not removed');
}

/** A short-lived link to a file. With `download`, the browser saves it under its original name. */
export async function attachmentUrl(path: string, download?: string) {
  const { data, error } = await getSupabase()!.storage.from(BUCKET)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadTaskFiles(projectId: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('task_files').select('*').eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return (data || []).map(rowToTaskFile);
}

export async function addTaskFile(projectId: string, who: string, a: Attachment) {
  const { data, error } = await getSupabase()!
    .from('task_files').insert({ project_id: projectId, who, path: a.path, name: a.name, size: a.size, mime: a.mime })
    .select('*').single();
  if (error) throw error;
  return rowToTaskFile(data);
}

export async function deleteTaskFile(id: string) {
  const { data, error } = await getSupabase()!.from('task_files').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Delete from task_files affected no rows');
}

/* ── Reads ── */
export async function loadAll() {
  const sb = getSupabase();
  if (!sb) throw new Error('No database connection');
  const [mRes, pRes, cRes, aRes] = await Promise.all([
    sb.from('team_members').select('*').order('created_at'),
    sb.from('projects').select('*').order('created_at', { ascending: false }),
    sb.from('clients').select('*').order('name'),
    sb.from('activity').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  for (const res of [mRes, pRes, cRes, aRes]) if (res.error) throw res.error;
  const sample = pRes.data?.[0];
  if (sample) for (const c of OPTIONAL_PROJECT_COLS) if (c in sample) projectCols.add(c);
  return {
    team: (mRes.data || []).map(rowToMember),
    projects: (pRes.data || []).map(rowToProject),
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

/** Invoices already emailed to clients, newest first (migration 015, admins only). */
export async function loadSentInvoices(): Promise<SentInvoice[]> {
  const { data, error } = await getSupabase()!.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, invNum: r.inv_num, client: r.client, kind: r.kind, currency: r.currency, total: Number(r.total) || 0,
    doc: r.doc, firm: normalizeFirm(r.firm), sends: r.sends || [], createdBy: r.created_by || undefined, time: r.created_at,
  }));
}

/** Delete one of your own chat messages (migration 014: the row stays as a "deleted" placeholder). */
export async function deleteMessage(id: string | number) {
  const { data, error } = await getSupabase()!.from('messages')
    .update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('The message was not deleted');
}

/** Unread messages per room for the signed-in member (migration 005). */
export async function loadChatUnread(): Promise<Record<string, number>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.rpc('chat_unread_counts');
  if (error) throw error;
  return Object.fromEntries(((data || []) as { room_id: string; unread: number }[]).map(r => [r.room_id, Number(r.unread)]));
}

/** Record that the signed-in member has read everything in a room up to now. */
export async function markChatRead(room: string) {
  const { error } = await getSupabase()!.rpc('mark_chat_read', { room });
  if (error) throw error;
}

/** Comments on one task, oldest first (migration 011). */
export async function loadComments(projectId: string) {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('task_comments').select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToComment);
}

export async function addComment(projectId: string, who: string, text: string) {
  const { data, error } = await getSupabase()!
    .from('task_comments').insert({ project_id: projectId, who, text }).select('*').single();
  if (error) throw error;
  return rowToComment(data);
}

export async function deleteComment(id: string) {
  const { data, error } = await getSupabase()!.from('task_comments').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Delete from task_comments affected no rows');
}

/** When each member last signed in (migration 011, admins only): member id → ISO time. */
export async function loadLastLogins(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const { data, error } = await sb.rpc('team_last_login');
  if (error) throw error;
  return Object.fromEntries(((data || []) as { member_id: string; last_login: string | null }[])
    .filter(r => r.last_login).map(r => [r.member_id, r.last_login!]));
}

/** Firm profile + billing config (migration 006). Missing fields fall back to DEFAULT_FIRM. */
export async function loadFirmSettings(): Promise<FirmSettings> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_FIRM;
  const { data, error } = await sb.from('firm_settings').select('data').eq('id', 'firm').maybeSingle();
  if (error) throw error;
  return normalizeFirm(data?.data);
}


export async function saveFirmSettings(firm: FirmSettings) {
  const sb = getSupabase();
  if (!sb) throw new Error('No database connection');
  const { data, error } = await sb.from('firm_settings')
    .upsert({ id: 'firm', data: firm, updated_at: new Date().toISOString() }).select('id');
  if (error) throw error;
  // Row-level security (non-admins) blocks the write silently.
  if (!data?.length) throw new Error('Firm settings were not saved');
}

/* ── Writes ── */
export type Mutation =
  | { type: 'project'; entity: Project }
  | { type: 'project_delete'; id: string }
  | { type: 'client'; entity: Client }
  | { type: 'client_delete'; id: string }
  | { type: 'member'; entity: Member }
  | { type: 'member_delete'; id: string }
  | { type: 'activity'; entity: { who: string; text: string } }
  | { type: 'message'; entity: { room: string; who: string; text: string; attachment?: Attachment } };

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
    case 'project_delete': res = await del('projects', m.id); break;
    case 'client':        res = await sb.from('clients').upsert(clientToRow(m.entity), { onConflict: 'id' }); break;
    case 'client_delete': res = await del('clients', m.id); break;
    case 'member':        res = await sb.from('team_members').upsert(memberToRow(m.entity), { onConflict: 'id' }); break;
    case 'member_delete': res = await del('team_members', m.id); break;
    case 'activity':      res = await sb.from('activity').insert({ who: m.entity.who, text: m.entity.text }); break;
    case 'message':
      res = await sb.from('messages').insert({
        room_id: m.entity.room, sender_id: m.entity.who, content: m.entity.text,
        ...(m.entity.attachment ? { attachment: m.entity.attachment } : {}),
      });
      break;
  }
  if (res.error) throw res.error;
}
