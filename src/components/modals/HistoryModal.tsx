'use client';

import { useEffect, useState } from 'react';
import { loadStatusHistory } from '@/lib/db';
import { fmtDate, parseDate, stat } from '@/lib/helpers';
import type { StatusChange } from '@/lib/types';
import { useStore } from '../store';
import { Av, Tag } from '../ui';
import { ModalHeader } from './ModalHost';
import { ArrowRightIcon } from 'lucide-react';

const fmtWhen = (t: string) =>
  new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "3d 4h", "5h 20m", "12m" — how long the task stayed in a status. */
function fmtSpan(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`;
  return `${Math.floor(h / 24)}d${h % 24 ? ` ${h % 24}h` : ''}`;
}

/** Histories already read in this session, so reopening one shows it at once. */
const cache = new Map<string, StatusChange[]>();
const sameHistory = (a: StatusChange[] | null, b: StatusChange[]) =>
  !!a && a.length === b.length && a.every((c, i) => c.id === b[i].id);

/** When the task was created, to the minute: new task ids are 'p' + Date.now(). Older ones only have the date. */
const createdTime = (id: string) => (/^p\d{13}$/.test(id) ? new Date(Number(id.slice(1))).toISOString() : null);

/** A task's status changes, newest first, with who moved it and how long it stayed (task_status_changes, migration 019). */
export function HistoryModal({ pid }: { pid: string }) {
  const { projects, emp } = useStore();
  const p = projects.find(x => x.id === pid);
  const [list, setList] = useState<StatusChange[] | null>(() => cache.get(pid) ?? null);
  const [failed, setFailed] = useState(false);

  // Read the history when it opens, and again only when the task's status really changes — not for other edits,
  // reconnects or the move time being confirmed by the server. The list on screen is replaced only if it differs.
  // A move saved a moment ago may not be in the database yet, so retry briefly until the latest entry matches.
  const status = p?.status;
  useEffect(() => {
    let live = true, timer: ReturnType<typeof setTimeout> | undefined;
    const load = (tries: number) => loadStatusHistory(pid)
      .then(l => {
        if (!live) return;
        cache.set(pid, l);
        setList(cur => (sameHistory(cur, l) ? cur : l));
        setFailed(false);
        if (status && l.at(-1)?.to !== status && tries > 1) timer = setTimeout(() => load(tries - 1), 1200);
      })
      .catch(e => { console.warn('Task history unavailable (has migration 019 been run?)', e); if (live) setFailed(true); });
    load(4);
    return () => { live = false; clearTimeout(timer); };
  }, [pid, status]);

  if (!p) return null;

  // The trigger's first row for a new task (no "from", same day it was created) is its creation.
  const created = parseDate(p.created);
  const first = list?.[0];
  const firstIsCreation = !!first && !first.from && !!created && new Date(first.time).toDateString() === created.toDateString();
  const createdAt = createdTime(p.id);
  const by = (who?: string) => (who ? emp(who) : undefined);

  // Each move shows the time since the previous status change, i.e. how long the task took to go from one status to
  // the next. The first entry has nothing before it to measure from (never the creation date).
  const entries = (list || []).map((c, i, all) => ({
    c,
    creation: i === 0 && firstIsCreation,
    span: i > 0 ? new Date(c.time).getTime() - new Date(all[i - 1].time).getTime() : null,
    prev: i > 0 ? all[i - 1].to : undefined,
  })).reverse();

  return (
    <>
      <ModalHeader title="Task History" sub={p.title} />
      <div className="modal-body">
        {failed ? (
          <div className="hist-empty">The history could not be loaded. Please try again later.</div>
        ) : !list ? (
          <div className="hist-empty">Loading…</div>
        ) : (
          <div className="hist-list">
            {entries.map(({ c, creation, span, prev }) => {
              const e = by(c.who);
              return (
                <div key={c.id} className="hist-item">
                  <div className="hist-dot" style={{ background: stat(c.to).col }} />
                  <div className="hist-main">
                    <div className="hist-change">
                      {creation ? <span className="hist-verb">Created in</span>
                        : c.from ? <><Tag {...stat(c.from)} /><ArrowRightIcon size={12} className="hist-arrow" /></>
                        : <span className="hist-verb">Moved to</span>}
                      <Tag {...stat(c.to)} />
                    </div>
                    <div className="hist-meta">
                      {e ? <span className="hist-who"><Av e={e} size={16} />{e.name}</span> : <span>{c.who ? 'Former member' : 'Unknown'}</span>}
                      <span>·</span><span>{fmtWhen(c.time)}</span>
                    </div>
                  </div>
                  {span !== null && prev && (
                    <div className="hist-span" title={`Time from ${stat(prev).label} to ${stat(c.to).label}`}>{fmtSpan(span)}</div>
                  )}
                </div>
              );
            })}
            {!firstIsCreation && created && (
              <div className="hist-item">
                <div className="hist-dot" style={{ background: 'var(--text-tertiary)' }} />
                <div className="hist-main">
                  <div className="hist-change"><span className="hist-verb">Task created</span></div>
                  <div className="hist-meta">
                    {by(p.createdBy) && <><span className="hist-who"><Av e={by(p.createdBy)} size={16} />{by(p.createdBy)!.name}</span><span>·</span></>}
                    <span>{createdAt ? fmtWhen(createdAt) : fmtDate(p.created)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
