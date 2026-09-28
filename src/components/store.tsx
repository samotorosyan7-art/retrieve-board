'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { SEED_CREDENTIALS, SESSION_KEY } from '@/lib/auth';
import {
  DEFAULT_FX, SEED_ACTIVITY, SEED_CLIENTS, SEED_PROJECTS, SEED_TASKS, SEED_TEAM,
} from '@/lib/constants';
import { loadAll, loadMessages, rowToActivity, rowToClient, rowToMessage, rowToProject, rowToTask, write, type Mutation } from '@/lib/db';
import { stat, today } from '@/lib/helpers';
import { getSupabase } from '@/lib/supabase';
import type {
  Activity, ChatMessage, Client, Credential, Currency, Member, Project, StatusId, SyncState, Task, TimeLog,
} from '@/lib/types';

/* ── localStorage cache (instant paint + offline fallback) ── */
const STORE_KEY = 'retrieve_pm_v1';
type Snapshot = { projects?: Project[]; TASKS?: Task[]; ACTIVITY?: Activity[]; CLIENTS?: Client[]; isDark?: boolean };

function readSnapshot(): Snapshot | null {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}

export type ModalState =
  | { kind: 'task'; id: string | null }
  | { kind: 'matter'; client?: string }
  | { kind: 'logTime' }
  | { kind: 'client'; id: string | null; onSaved?: (id: string) => void }
  | { kind: 'member'; id: string | null };

export type ConfirmState = { title: string; msg: string; confirmLabel?: string; onConfirm: () => void };

type Toast = { id: number; icon: string; title: string; msg: string; leaving: boolean };

function useStoreValue() {
  const [hydrated, setHydrated] = useState(false);
  const [team, setTeam] = useState<Member[]>(SEED_TEAM);
  const [creds, setCreds] = useState<Record<string, Credential>>(SEED_CREDENTIALS);
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>(SEED_TASKS);
  const [clients, setClients] = useState<Client[]>(SEED_CLIENTS);
  const [activity, setActivity] = useState<Activity[]>(SEED_ACTIVITY);
  const [isDark, setIsDark] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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

  const currentUser = team.find(e => e.id === currentUserId) ?? null;

  // Refs so async callbacks (realtime, debounces) always see fresh state.
  const state = useRef({ projects, tasks, clients, currentUser });
  state.current = { projects, tasks, clients, currentUser };
  const chatVisible = useRef(false);

  /* ── Toasts ── */
  const toastSeq = useRef(0);
  const toast = useCallback((icon: string, title: string, msg = '') => {
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
    const table = { project: 'projects', project_delete: 'projects', task: 'tasks', task_delete: 'tasks', client: 'clients', client_delete: 'clients' }[m.type as string];
    const id = 'entity' in m ? (m.entity as { id?: string }).id : 'id' in m ? m.id : undefined;
    return table && id ? `${table}:${id}` : null;
  };
  // Our own activity rows, so their realtime echo isn't added a second time.
  const ownActivity = useRef<string[]>([]);

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
      if (m.type.endsWith('_delete')) toast('⚠️', 'Delete failed', 'The database did not remove it — it has been restored.');
      else toast('⚠️', 'Sync issue', 'Changes saved locally. Will retry on next action.');
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
    }
  }, []);

  // Mount: local cache → session restore → live data → realtime.
  useEffect(() => {
    const snap = readSnapshot();
    if (snap) {
      if (snap.projects) setProjects(snap.projects.map(p => ({ ...p, status: (p.status as string) === 'active' ? 'inprogress' : p.status })));
      if (snap.TASKS) setTasks(snap.TASKS);
      if (snap.ACTIVITY) setActivity(snap.ACTIVITY);
      if (snap.CLIENTS) setClients(snap.CLIENTS);
      if (typeof snap.isDark === 'boolean') setIsDark(snap.isDark);
    }
    try {
      const role = sessionStorage.getItem(SESSION_KEY);
      if (role && SEED_CREDENTIALS[role]) setCurrentUserId(SEED_CREDENTIALS[role].teamId);
    } catch {}
    setHydrated(true);
    reload();

    const sb = getSupabase();
    if (!sb) return;
    const channel = sb.channel('retrieve-live');
    for (const table of ['projects', 'tasks', 'clients', 'activity']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, payload => applyRealtime(table, payload));
    }
    let connectedOnce = false;
    channel.subscribe(status => {
      // After a dropped connection, quietly catch up on anything missed.
      if (status === 'SUBSCRIBED') { if (connectedOnce) reload(); connectedOnce = true; }
    });
    return () => { sb.removeChannel(channel); };
  }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

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

    if (table === 'projects') {
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

  // Keep cache fresh.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        projects, TASKS: tasks, ACTIVITY: activity, CLIENTS: clients, isDark, savedAt: new Date().toISOString(),
      }));
    } catch {}
  }, [hydrated, projects, tasks, activity, clients, isDark]);

  // Theme attribute.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
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

  /* ── Auth ── */
  const login = (role: string) => {
    const cred = creds[role];
    if (!cred || !team.some(e => e.id === cred.teamId)) return false;
    setCurrentUserId(cred.teamId);
    try { sessionStorage.setItem(SESSION_KEY, role); } catch {}
    return true;
  };
  const logout = () => {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setCurrentUserId(null);
    setSelectedPid(null);
    setModal(null);
  };

  /* ── Activity ── */
  const addActivity = (who: string, text: string) => {
    setActivity(list =>
      [{ who, text, time: 'Just now' }, ...list.map(a => (a.time === 'Just now' ? { ...a, time: 'Minutes ago' } : a))].slice(0, 20),
    );
    ownActivity.current.push(`${who}|${text}`);
    persist({ type: 'activity', entity: { who, text } });
  };
  const me = () => state.current.currentUser?.id || 'fh';

  /* ── Projects ── */
  const saveProject = (p: Project) => {
    setProjects(ps => (ps.some(x => x.id === p.id) ? ps.map(x => (x.id === p.id ? p : x)) : [...ps, p]));
    persist({ type: 'project', entity: p });
  };
  const patchProject = (id: string, patch: Partial<Project>) => {
    const p = state.current.projects.find(x => x.id === id);
    if (!p) return null;
    const next = { ...p, ...patch };
    saveProject(next);
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
      toast('🔒', 'Cannot change', 'Only the person who created this matter can change its visibility.');
      return;
    }
    const priv = !p.isPrivate;
    patchProject(id, { isPrivate: priv });
    toast(priv ? '🔒' : '🌐', priv ? 'Matter is now private' : 'Matter is now public',
      priv ? 'Only you can see this matter.' : 'Visible to the whole team.');
  };
  const addTimeLog = (pid: string, log: TimeLog) => {
    const p = state.current.projects.find(x => x.id === pid);
    if (!p) return null;
    return patchProject(pid, { timeLogs: [...p.timeLogs, log] });
  };
  const archiveProject = (id: string) => {
    setStatus(id, 'archive');
    toast('🗄', 'Matter archived', 'Moved to Archive.');
  };
  const deleteProject = (id: string) => {
    const p = state.current.projects.find(x => x.id === id);
    if (!p) return;
    setConfirmState({
      title: 'Delete matter?',
      msg: `"${p.title}" and its time log will be permanently removed. Tasks linked to it are kept. This cannot be undone.`,
      confirmLabel: 'Delete matter',
      onConfirm: async () => {
        setProjects(ps => ps.filter(x => x.id !== id));
        setSelectedPid(cur => (cur === id ? null : cur));
        if (await persist({ type: 'project_delete', id })) {
          addActivity(me(), `deleted matter <b>${p.title}</b>`);
          toast('🗑️', 'Matter deleted', p.title);
        } else reload();
      },
    });
  };
  const createProject = (data: Pick<Project, 'title' | 'client' | 'area' | 'status' | 'priority' | 'assignees' | 'due' | 'notes' | 'isPrivate' | 'matterType'>) => {
    const p: Project = {
      ...data, id: 'p' + Date.now(), progress: 0, created: today(), timeLogs: [], files: [], createdBy: me(),
    };
    saveProject(p);
    addActivity(me(), `created matter <b>${p.title}</b>`);
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
    toast('✅', 'Task updated', !t.done ? 'Marked complete.' : 'Moved back to pending.');
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
      title: 'Delete task?',
      msg: `"${t.title}" will be permanently removed.`,
      confirmLabel: 'Delete task',
      onConfirm: async () => {
        setTasks(ts => ts.filter(x => x.id !== id));
        if (await persist({ type: 'task_delete', id })) toast('🗑', 'Task deleted', t.title);
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
        (n ? ` Its ${n} matter${n === 1 ? '' : 's'} will stay on the board under the same client name.` : '') +
        ' This cannot be undone.',
      confirmLabel: 'Delete client',
      onConfirm: async () => {
        setClients(cs => cs.filter(x => x.id !== id));
        onDeleted?.();
        if (await persist({ type: 'client_delete', id })) toast('🗑️', 'Client removed', `${c.name} deleted.`);
        else reload();
      },
    });
  };

  /* ── Team (in-memory, like the original — there is no team table) ── */
  const saveMember = (m: Member, cred?: { emailHash: string; passHash: string }) => {
    setTeam(ts => (ts.some(x => x.id === m.id) ? ts.map(x => (x.id === m.id ? m : x)) : [...ts, m]));
    if (cred) {
      setCreds(cs => {
        const key = Object.keys(cs).find(k => cs[k].teamId === m.id) ?? m.id;
        return { ...cs, [key]: { teamId: m.id, ...cred } };
      });
    }
  };
  const deleteMember = (id: string) => {
    const e = team.find(x => x.id === id);
    if (!e) return;
    if (e.isAdmin) { toast('⚠️', 'Cannot delete', 'Cannot remove the firm admin.'); return; }
    setConfirmState({
      title: 'Remove team member?',
      msg: `Remove ${e.name} from the team? Their tasks and time logs will remain.`,
      confirmLabel: 'Remove',
      onConfirm: () => {
        setTeam(ts => ts.filter(x => x.id !== id));
        setCreds(cs => Object.fromEntries(Object.entries(cs).filter(([, c]) => c.teamId !== id)));
        toast('🗑️', 'Member removed', e.name);
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
    localStorage.removeItem(STORE_KEY);
    toast('🗑️', 'State cleared', 'Refreshing to defaults…');
    setTimeout(() => location.reload(), 1200);
  };

  return {
    hydrated, team, creds, projects, tasks, clients, activity, isDark, currentUser, sync,
    selectedPid, modal, toasts, confirmState, setConfirmState, search, billingCurrency, fx, chatMessages, chatUnread,
    setSearch, setBillingCurrency, setFx, setSelectedPid, setModal,
    toggleTheme: () => setIsDark(d => !d),
    toast, login, logout, emp, openPanel, closePanel: () => setSelectedPid(null),
    closeModal: () => setModal(null),
    addActivity, saveProject, patchProject, setStatus, setProgress, togglePrivacy, addTimeLog, createProject, archiveProject, deleteProject,
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
