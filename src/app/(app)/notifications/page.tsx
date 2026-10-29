'use client';

import { useState } from 'react';
import { NOTIFICATION_KINDS, useStore } from '@/components/store';
import { Av, PageHeader } from '@/components/ui';
import { fmtAgo } from '@/lib/helpers';
import { CheckCheckIcon, CheckIcon, RotateCwIcon } from 'lucide-react';

/** Comments, files and notes changes on tasks assigned to me (migration 020), and comments (021) or notes (022) mentioning me.
 *  Opening one — here or from anywhere else — marks it seen; the sidebar badge counts the unseen ones. */
export default function NotificationsPage() {
  const { notifications, notificationsError, retryNotifications, unseenNotifications, markSeen, projects, emp, setSelectedPid, selectedPid } = useStore();
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  const all = notifications || [];
  const shown = onlyUnseen ? all.filter(n => !n.seen) : all;

  return (
    <div className="page active" id="page-notifications">
      <PageHeader
        title="My" light="Notifications"
        sub={notifications ? `${unseenNotifications} unseen · mentions, and new comments, files and notes on tasks assigned to you` : notificationsError ? 'Not loaded' : 'Loading…'}
      >
        <div className="seg-ctrl">
          <button className={`seg-btn${!onlyUnseen ? ' active' : ''}`} onClick={() => setOnlyUnseen(false)}>All</button>
          <button className={`seg-btn${onlyUnseen ? ' active' : ''}`} onClick={() => setOnlyUnseen(true)}>Unseen ({unseenNotifications})</button>
        </div>
        <button className="btn-outline" disabled={!unseenNotifications} onClick={() => markSeen()}><CheckCheckIcon size={14} /> Mark all as seen</button>
      </PageHeader>

      <div className="card notif-list">
        {!notifications && notificationsError ? (
          <div className="notif-empty">
            Notifications could not be loaded: <span className="notif-error">{notificationsError}</span>
            <div style={{ marginTop: 12 }}><button className="btn-outline" onClick={retryNotifications}><RotateCwIcon size={14} /> Retry</button></div>
          </div>
        ) : !notifications ? (
          <div className="notif-empty">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="notif-empty">{onlyUnseen ? 'You’re all caught up.' : 'No notifications yet. You’ll see mentions, and new comments, files and notes on your tasks, here.'}</div>
        ) : shown.map(n => {
          const p = projects.find(x => x.id === n.projectId);
          const e = emp(n.actor ?? '');
          const [Icon, what] = NOTIFICATION_KINDS[n.kind];
          return (
            <div
              key={n.id}
              className={`notif-row${n.seen ? '' : ' unseen'}${p && p.id === selectedPid ? ' selected' : ''}`}
              onClick={() => p && setSelectedPid(p.id)}
              title={p ? 'Open the task' : 'This task is no longer available'}
            >
              <div className="notif-dot" />
              <div className="notif-av">{e ? <Av e={e} size={30} /> : <Icon size={15} />}<span className="notif-kind"><Icon size={10} /></span></div>
              <div className="notif-main">
                <div className="notif-text">
                  <b>{e?.name.split(' ')[0] ?? 'Someone'}</b> {what} on <b>{p?.title ?? 'a task'}</b>
                </div>
                {n.detail && <div className={`notif-detail${n.kind === 'file' ? ' file' : ''}`}>{n.detail}</div>}
                <div className="notif-meta">{p?.client && <>{p.client} · </>}{fmtAgo(n.time)}</div>
              </div>
              {!n.seen && (
                <button className="notif-seen" title="Mark as seen" onClick={ev => { ev.stopPropagation(); markSeen([n.id]); }}>
                  <CheckIcon size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
