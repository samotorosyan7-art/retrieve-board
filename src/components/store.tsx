'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_FX } from '@/lib/constants';
import {
  loadAll, loadMessages, rowToActivity, rowToClient, rowToMember, rowToMessage, rowToProject, rowToTask, write, type Mutation,
} from '@/lib/db';
import { sendMatterAssignmentEmail } from '@/lib/email';
import { canDeleteMatter, stat, today } from '@/lib/helpers';
import { getSupabase } from '@/lib/supabase';
import type {
  Activity, ChatMessage, Client, Currency, Member, Project, StatusId, SyncState, Task, TimeLog,
} from '@/lib/types';
import { ArchiveIcon, CircleCheckIcon, GlobeIcon, LockIcon, MailIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── localStorage: theme (always) + a per-user data cache for instant paint, wiped on sign-out ── */
const THEME_KEY = 'retrieve_theme';
const CACHE_KEY = 'retrieve_cache_v2';
const LEGACY_KEYS = ['retrieve_pm_v1', 'retrieve_session']; // pre-auth versions — removed on load
type Snapshot = { owner: string; team: Member[]; projects: Project[]; tasks: Task[]; clients: Client[]; activity: Activity[] };

function readCache(owner: string): Snapshot | null {
  try {
    const snap = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as Snapshot | null;
    return snap?.owner === owner ? snap : null;
  } catch { return null; }
}

/** 'loading' until the session is known and (if signed in) the team is loaded.
 *  'noAccess' = signed in to Supabase but not listed in team_members. */
export type AuthStatus = 'loading' | 'signedOut' | 'noAccess' | 'signedIn';

export type ModalState =
  | { kind: 'task'; id: string | null }
  | { kind: 'matter'; client?: string }
  | { kind: 'logTime' }
  | { kind: 'client'; id: string | null; onSaved?: (id: string) => void }
  | { kind: 'member'; id: string | null };

export type ConfirmState = { title: string; msg: string; confirmLabel?: string; onConfirm: () => void };

type Toast = { id: number; icon: LucideIcon; title: string; msg: string; leaving: boolean };

function useStoreValue() {
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined); // undefined = not checked yet
  const [teamLoaded, setTeamLoaded] = useState(false);
  const [team, setTeam] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [isDark, setIsDark] = useState(true);
  const [sync, setSync] = useState<SyncState>('hidden');
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [search, setSearch] = useState('');
  const [billingCurrency, setBillingCurrency] = useState<Currency>('USD');
  const [fx, setFx] = useState<Record<Currency, number>>(DEFAULT_FX);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatUnread, setChatUnread] = useState(0);

  const currentUser = (sessionEmail && team.find(e => e.email.toLowerCase() === sessionEmail)) || null;
  const currentUserId = currentUser?.id ?? null;
  const authStatus: AuthStatus =
    sessionEmail === undefined ? 'loading'
    : sessionEmail === null ? 'signedOut'
    : !teamLoaded ? 'loading'
    : currentUser ? 'signedIn' : 'noAccess';
  const hydrated = authStatus !== 'loading';

  // Refs so async callbacks (realtime, debounces) always see fresh state.
  const state = useRef({ projects, tasks, clients, currentUser, team });
  state.current = { projects, tasks, clients, currentUser, team };
  const chatVisible = useRef(false);

  /* ── Toasts ── */
  const toastSeq = useRef(0);
  const toast = useCallback((icon: LucideIcon, title: string, msg = '') => {
    const id = ++toastSeq.current;
    setToasts(ts => [...ts, { id, icon, title, msg, leaving: false }]);
    setTimeout(() => {
      setToasts(ts => ts.map(t => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 350);
    }, 3500);
  }, []);

  /* ── Sync indicator ── */
  useEffect(() => {
    if (sync !== 'ok') return;
    const t = setTimeout(() => setSync('hidden'), 2000);
    return () => clearTimeout(t);
  }, [sync]);

  /* ── Database ── */
  // Rows with a local change still being saved. Realtime updates for them are ignored so an older
  // echo from the server can't overwrite what the user is editing (e.g. while dragging the progress slider).
  const dirty = useRef(new Map<string, number>());
  const markDirty = (key: string, d: 1 | -1) => {
    const n = (dirty.current.get(key) || 0) + d;
    if (n > 0) dirty.current.set(key, n); else dirty.current.delete(key);
  };
  const mutationKey = (m: Mutation) => {
    const table = { project: 'projects', project_delete: 'projects', task: 'tasks', task_delete: 'tasks', client: 'clients', client_delete: 'clients', member: 'team_members', member_delete: 'team_members' }[m.type as string];
    const id = 'entity' in m ? (m.entity as { id?: string }).id : 'id' in m ? m.id : undefined;
    return table && id ? `${table}:${id}` : null;
  };
  // Our own activity rows, so their realtime echo isn't added a second time.
  const ownActivity = useRef<string[]>([]);
  const reloadRef = useRef<() => void>(() => {});

  const persist = useCallback(async (m: Mutation) => {
    const key = mutationKey(m);
    if (key) markDirty(key, 1);
    // Only show the saving indicator if the write is noticeably slow.
    const slow = setTimeout(() => setSync('syncing'), 600);
    try {
      await write(m);
      setSync(s => (s === 'syncing' ? 'ok' : s === 'error' ? 'hidden' : s));
      return true;
    } catch (e) {
      console.warn('Save error', e);
      setSync('error');
      const denied = (e as { code?: string })?.code === '42501';
      if (m.type === 'project' && denied) {
        // Rejected by a permission rule (migration 003) — show why and restore the saved copy.
        toast(TriangleAlertIcon, 'Not allowed', (e as { message?: string }).message || 'You do not have permission to make that change.');
        reloadRef.current();
      } else if (m.type === 'member' || m.type === 'member_delete') toast(TriangleAlertIcon, 'Not saved', 'Only admins can change the team.');
      else if (m.type.endsWith('_delete')) toast(TriangleAlertIcon, 'Delete failed', 'The database did not remove it — it has been restored.');
      else toast(TriangleAlertIcon, 'Sync issue', 'Changes saved locally. Will retry on next action.');
      return false;
    } finally {
      clearTimeout(slow);
      // Keep the row protected briefly so the echo of this very write is absorbed quietly.
      if (key) setTimeout(() => markDirty(key, -1), 1500);
    }
  }, [toast]);

  /** Background refetch (initial load, reconnect, failed delete). Never shows a loading state. */
  const reload = useCallback(async () => {
    try {
      const data = await loadAll();
      setTeam(data.team);
      setTeamLoaded(true);
      // isPrivate / createdBy have no DB columns — keep what this browser knows.
      const prev = new Map(state.current.projects.map(p => [p.id, p]));
      setProjects(data.projects.map(p => {
        const old = prev.get(p.id);
        // Columns missing from the DB (before the migration) fall back to this browser's copy.
        return old ? { matterType: old.matterType, isPrivate: old.isPrivate, createdBy: old.createdBy, ...p } : p;
      }));
      setTasks(data.tasks);
      setClients(data.clients);
      setActivity(data.activity);
    } catch (e) {
      console.warn('DB load error — using local cache', e);
      setSync('error');
      // Don't hang on "loading" if the team list can't be read (e.g. migration 002 not run yet).
      setTeamLoaded(true);
    }
  }, []);
  reloadRef.current = reload;

  // Mount: theme, then follow the Supabase Auth session.
  useEffect(() => {
    try {
      LEGACY_KEYS.forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
      if (localStorage.getItem(THEME_KEY) === 'light') setIsDark(false);
    } catch {}
    const sb = getSupabase();
    if (!sb) { setSessionEmail(null); return; }
    sb.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email?.toLowerCase() ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email?.toLowerCase() ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // While signed in: cached data → live data → realtime. On sign-out: clear everything.
  useEffect(() => {
    if (!sessionEmail) {
      setTeam([]); setProjects([]); setTasks([]); setClients([]); setActivity([]); setChatMessages({});
      setTeamLoaded(false); setSelectedPid(null); setModal(null);
      return;
    }
    const snap = readCache(sessionEmail);
    if (snap) {
      setTeam(snap.team); setProjects(snap.projects); setTasks(snap.tasks); setClients(snap.clients); setActivity(snap.activity);
      setTeamLoaded(true);
    }
    reload();

    const sb = getSupabase();
    if (!sb) return;
    const channel = sb.channel('retrieve-live');
    for (const table of ['team_members', 'projects', 'tasks', 'clients', 'activity']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => applyRealtime(table, payload));
    }
    let connectedOnce = false;
    channel.subscribe(status => {
      // After a dropped connection, quietly catch up on anything missed.
      if (status === 'SUBSCRIBED') { if (connectedOnce) reload(); connectedOnce = true; }
    });
    return () => { sb.removeChannel(channel); };
  }, [sessionEmail, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Apply one realtime change to local state — only the affected row re-renders. */
  function applyRealtime(table: string, payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) {
    const row = payload.new as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const id = (payload.eventType === 'DELETE' ? payload.old?.id : row?.id) as string | undefined;

    if (table === 'activity') {
      if (payload.eventType !== 'INSERT') return;
      const i = ownActivity.current.indexOf(`${row.who}|${row.text}`);
      if (i > -1) { ownActivity.current.splice(i, 1); return; } // echo of our own entry
      setActivity(list => [rowToActivity(row), ...list].slice(0, 20));
      return;
    }
    if (!id || dirty.current.has(`${table}:${id}`)) return;

    const upsertOrDelete = <T extends { id: string }>(list: T[], item: T | null): T[] => {
      if (!item) return list.filter(x => x.id !== id);
      const i = list.findIndex(x => x.id === id);
      if (i === -1) return [...list, item];
      if (JSON.stringify(list[i]) === JSON.stringify(item)) return list; // nothing actually changed
      return list.map(x => (x.id === id ? item : x));
    };
    const isDelete = payload.eventType === 'DELETE';

    if (table === 'team_members') {
      setTeam(ms => upsertOrDelete(ms, isDelete ? null : rowToMember(row)));
    } else if (table === 'projects') {
      setProjects(ps => {
        const old = ps.find(x => x.id === id);
        const next = isDelete ? null : rowToProject(row);
        return upsertOrDelete(ps, next && old ? { matterType: old.matterType, isPrivate: old.isPrivate, createdBy: old.createdBy, ...next } : next);
      });
      if (isDelete) setSelectedPid(cur => (cur === id ? null : cur));
    } else if (table === 'tasks') {
      setTasks(ts => upsertOrDelete(ts, isDelete ? null : rowToTask(row)));
    } else if (table === 'clients') {
      setClients(cs => upsertOrDelete(cs, isDelete ? null : rowToClient(row)));
    }
  }

  // Keep the per-user cache fresh (only once real data for a member is loaded).
  useEffect(() => {
    if (authStatus !== 'signedIn' || !sessionEmail) return;
    try {
      const snap: Snapshot = { owner: sessionEmail, team, projects, tasks, clients, activity };
      localStorage.setItem(CACHE_KEY, JSON.stringify(snap));
    } catch {}
  }, [authStatus, sessionEmail, team, projects, tasks, activity, clients]);

  // Theme attribute.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try { localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  // Chat realtime — only while signed in.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !currentUserId) return;
    const channel = sb.channel('chat-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = rowToMessage(payload.new);
        setChatMessages(all => {
          const list = all[msg.room] || [];
          if (list.some(m => m.id === msg.id)) return all;
          // Replace our own optimistic copy instead of showing it twice.
          const optIdx = list.findIndex(m => String(m.id).startsWith('opt_') && m.who === msg.who && m.text === msg.text);
          const next = optIdx > -1 ? list.map((m, i) => (i === optIdx ? msg : m)) : [...list, msg];
          return { ...all, [msg.room]: next };
        });
        if (!chatVisible.current && msg.who !== currentUserId) setChatUnread(n => n + 1);
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [currentUserId]);

  /* ── Auth (Supabase Auth — passwords never touch this code) ── */
  /** Returns an error message, or null on success. */
  const login = async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return 'The app is not connected to the database.';
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (!error) return null;
    if (/invalid login/i.test(error.message)) return 'Incorrect email or password.';
    if (/rate limit|too many/i.test(error.message)) return 'Too many attempts. Please wait a few minutes and try again.';
    if (/not confirmed/i.test(error.message)) return 'Please accept your invitation email first.';
    return error.message;
  };
  const logout = async () => {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
    await getSupabase()?.auth.signOut();
    setSessionEmail(null);
  };
  /** Emails a link to /reset-password where the user sets a new password. */
  const sendPasswordEmail = async (email: string) => {
    const sb = getSupabase();
    if (!sb) return 'The app is not connected to the database.';
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/reset-password`,
    });
    return error ? error.message : null;
  };

  /* ── Activity ── */
  const addActivity = (who: string, text: string) => {
    setActivity(list =>
      [{ who, text, time: 'Just now' }, ...list.map(a => (a.time === 'Just now' ? { ...a, time: 'Minutes ago' } : a))].slice(0, 20),
    );
    ownActivity.current.push(`${who}|${text}`);
    persist({ type: 'activity', entity: { who, text } });
  };
  const me = () => state.current.currentUser?.id ?? '';

  /* ── Projects ── */
  const saveProject = (p: Project) => {
    setProjects(ps => (ps.some(x => x.id === p.id) ? ps.map(x => (x.id === p.id ? p : x)) : [...ps, p]));
    return persist({ type: 'project', entity: p });
  };
  /** Email people newly put on a task — only after the row is saved, since the server reads it back. */
  const notifyAssigned = (saved: Promise<boolean>, pid: string, ids: string[]) => {
    const others = ids.filter(id => id !== me());
    if (!others.length) return;
    saved.then(ok => ok && sendMatterAssignmentEmail(pid, others)).then(n => {
      if (n) toast(MailIcon, 'Assignees notified', `Email sent to ${n} ${n === 1 ? 'person' : 'people'}.`);
    });
  };
  const patchProject = (id: string, patch: Partial<Project>) => {
    const p = state.current.projects.find(x => x.id === id);
    if (!p) return null;
    const next = { ...p, ...patch };
    const saved = saveProject(next);
    if (patch.assignees) notifyAssigned(saved, id, patch.assignees.filter(a => !p.assignees.includes(a)));
    return next;
  };
  const setStatus = (id: string, status: StatusId) => {
    const p = patchProject(id, { status });
    if (!p) return;
    addActivity(me(), `moved <b>${p.title}</b> to ${stat(status).label}`);
  };
  const progressTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const setProgress = (id: string, progress: number) => {
    setProjects(ps => ps.map(p => (p.id === id ? { ...p, progress } : p)));
    // Debounce DB save — only write after the user stops dragging for 800ms.
    // The row stays protected from realtime echoes for the whole drag.
    const timers = progressTimers.current;
    if (timers.has(id)) clearTimeout(timers.get(id));
    else markDirty(`projects:${id}`, 1);
    timers.set(id, setTimeout(() => {
      timers.delete(id);
      const p = state.current.projects.find(x => x.id === id);
      if (p) persist({ type: 'project', entity: p }).finally(() => markDirty(`projects:${id}`, -1));
      else markDirty(`projects:${id}`, -1);
    }, 800));
  };
  const togglePrivacy = (id: string) => {
    const p = state.current.projects.find(x => x.id === id);
    if (!p) return;
    if (p.createdBy && p.createdBy !== state.current.currentUser?.id) {
      toast(LockIcon, 'Cannot change', 'Only the person who created this task can change its visibility.');
      return;
    }
    const priv = !p.isPrivate;
    patchProject(id, { isPrivate: priv });
    toast(priv ? LockIcon : GlobeIcon, priv ? 'Task is now private' : 'Task is now public',
      priv ? 'Only you can see this task.' : 'Visible to the whole team.');
  };
  const addTimeLog = (pid: string, log: TimeLog) => {
    const p = state.current.projects.find(x => x.id === pid);
    if (!p) return null;
    return patchProject(pid, { timeLogs: [...p.timeLogs, log] });
  };
  const setAssignees = (id: string, assignees: string[]) => {
    const user = state.current.currentUser;
    if (!user?.isAdmin) { toast(LockIcon, 'Admins only', 'Only admins can reassign a task.'); return; }
    const p = patchProject(id, { assignees });
    if (!p) return;
    const names = assignees.map(a => state.current.team.find(e => e.id === a)?.name.split(' ')[0]).filter(Boolean).join(', ');
    addActivity(user.id, `assigned <b>${p.title}</b> to ${names || 'nobody'}`);
  };
  const archiveProject = (id: string) => {
    setStatus(id, 'archive');
    toast(ArchiveIcon, 'Task archived', 'Moved to Archive.');
  };
  const deleteProject = (id: string) => {
    const p = state.current.projects.find(x => x.id === id);
    if (!p) return;
    if (!canDeleteMatter(p, state.current.currentUser)) {
      toast(LockIcon, 'Cannot delete', 'Only admins and the person who created this task can delete it.');
      return;
    }
    setConfirmState({
      title: 'Delete task?',
      msg: `"${p.title}" and its time log will be permanently removed. To-dos linked to it are kept. This cannot be undone.`,
      confirmLabel: 'Delete task',
      onConfirm: async () => {
        setProjects(ps => ps.filter(x => x.id !== id));
        setSelectedPid(cur => (cur === id ? null : cur));
        if (await persist({ type: 'project_delete', id })) {
          addActivity(me(), `deleted task <b>${p.title}</b>`);
          toast(Trash2Icon, 'Task deleted', p.title);
        } else reload();
      },
    });
  };
  const createProject = (data: Pick<Project, 'title' | 'client' | 'area' | 'status' | 'priority' | 'assignees' | 'due' | 'notes' | 'isPrivate' | 'matterType'>) => {
    const p: Project = {
      ...data, id: 'p' + Date.now(), progress: 0, created: today(), timeLogs: [], files: [], createdBy: me(),
    };
    notifyAssigned(saveProject(p), p.id, p.assignees);
    addActivity(me(), `created task <b>${p.title}</b>`);
    return p;
  };

  /* ── Tasks ── */
  const saveTask = (t: Task) => {
    setTasks(ts => (ts.some(x => x.id === t.id) ? ts.map(x => (x.id === t.id ? t : x)) : [...ts, t]));
    persist({ type: 'task', entity: t });
  };
  const toggleTask = (id: string) => {
    const t = state.current.tasks.find(x => x.id === id);
    if (!t) return;
    saveTask({ ...t, done: !t.done });
    toast(CircleCheckIcon, 'To-do updated', !t.done ? 'Marked complete.' : 'Moved back to pending.');
  };
  const toggleSubtask = (tid: string, sid: string) => {
    const t = state.current.tasks.find(x => x.id === tid);
    if (!t) return;
    saveTask({ ...t, subtasks: t.subtasks.map(s => (s.id === sid ? { ...s, done: !s.done } : s)) });
  };
  const addSubtask = (tid: string, title: string) => {
    const t = state.current.tasks.find(x => x.id === tid);
    if (!t || !title.trim()) return;
    saveTask({ ...t, subtasks: [...(t.subtasks || []), { id: 'ss' + Date.now(), title: title.trim(), done: false }] });
  };
  const deleteTask = (id: string) => {
    const t = state.current.tasks.find(x => x.id === id);
    if (!t) return;
    setConfirmState({
      title: 'Delete to-do?',
      msg: `"${t.title}" will be permanently removed.`,
      confirmLabel: 'Delete to-do',
      onConfirm: async () => {
        setTasks(ts => ts.filter(x => x.id !== id));
        if (await persist({ type: 'task_delete', id })) toast(Trash2Icon, 'To-do deleted', t.title);
        else reload();
      },
    });
  };

  /* ── Clients ── */
  const saveClient = (c: Client) => {
    setClients(cs => (cs.some(x => x.id === c.id) ? cs.map(x => (x.id === c.id ? c : x)) : [...cs, c]));
    persist({ type: 'client', entity: c });
  };
  const deleteClient = (id: string, onDeleted?: () => void) => {
    const c = state.current.clients.find(x => x.id === id);
    if (!c) return;
    const n = state.current.projects.filter(p => p.client === c.name).length;
    setConfirmState({
      title: 'Delete client?',
      msg: `"${c.name}" will be permanently removed from your client list.` +
        (n ? ` Its ${n} task${n === 1 ? '' : 's'} will stay on the board under the same client name.` : '') +
        ' This cannot be undone.',
      confirmLabel: 'Delete client',
      onConfirm: async () => {
        setClients(cs => cs.filter(x => x.id !== id));
        onDeleted?.();
        if (await persist({ type: 'client_delete', id })) toast(Trash2Icon, 'Client removed', `${c.name} deleted.`);
        else reload();
      },
    });
  };

  /* ── Team (team_members table — the database only lets admins change it) ── */
  const saveMember = async (m: Member) => {
    const prev = team;
    setTeam(ts => (ts.some(x => x.id === m.id) ? ts.map(x => (x.id === m.id ? m : x)) : [...ts, m]));
    const ok = await persist({ type: 'member', entity: m });
    if (!ok) setTeam(prev);
    return ok;
  };
  const deleteMember = (id: string) => {
    const e = team.find(x => x.id === id);
    if (!e) return;
    if (e.isAdmin) { toast(TriangleAlertIcon, 'Cannot delete', 'Cannot remove the firm admin.'); return; }
    setConfirmState({
      title: 'Remove team member?',
      msg: `Remove ${e.name} from the team? They will lose access immediately. Their tasks and time logs remain.`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setTeam(ts => ts.filter(x => x.id !== id));
        if (await persist({ type: 'member_delete', id })) toast(Trash2Icon, 'Member removed', e.name);
        else reload();
      },
    });
  };

  /* ── Chat ── */
  const loadRoom = useCallback(async (room: string) => {
    try {
      const msgs = await loadMessages(room);
      setChatMessages(all => ({ ...all, [room]: msgs }));
    } catch (e) { console.warn('Chat load error', e); }
  }, []);
  const sendMessage = (room: string, text: string) => {
    const who = state.current.currentUser?.id;
    if (!who || !text.trim()) return;
    const optimistic: ChatMessage = { id: 'opt_' + Date.now(), room, who, text, time: new Date().toISOString() };
    setChatMessages(all => ({ ...all, [room]: [...(all[room] || []), optimistic] }));
    write({ type: 'message', entity: { room, who, text } }).catch(e => console.warn('Chat send error', e));
  };
  const setChatVisible = useCallback((v: boolean) => {
    chatVisible.current = v;
    if (v) setChatUnread(0);
  }, []);

  /* ── Misc ── */
  const emp = (id: string) => team.find(e => e.id === id);
  const openPanel = (id: string) => setSelectedPid(cur => (cur === id ? null : id));
  const clearSavedState = () => {
    localStorage.removeItem(CACHE_KEY);
    toast(Trash2Icon, 'Cache cleared', 'Reloading from the database…');
    reload();
  };

  return {
    hydrated, authStatus, team, projects, tasks, clients, activity, isDark, currentUser, sync,
    selectedPid, modal, toasts, confirmState, setConfirmState, search, billingCurrency, fx, chatMessages, chatUnread,
    setSearch, setBillingCurrency, setFx, setSelectedPid, setModal,
    toggleTheme: () => setIsDark(d => !d),
    toast, login, logout, sendPasswordEmail, emp, openPanel, closePanel: () => setSelectedPid(null),
    closeModal: () => setModal(null),
    addActivity, saveProject, patchProject, setStatus, setProgress, togglePrivacy, addTimeLog, setAssignees, createProject, archiveProject, deleteProject,
    saveTask, toggleTask, toggleSubtask, addSubtask, deleteTask,
    saveClient, deleteClient, saveMember, deleteMember,
    loadRoom, sendMessage, setChatVisible, clearSavedState,
  };
}

export type Store = ReturnType<typeof useStoreValue>;
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}
