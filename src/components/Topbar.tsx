'use client';

import { PAGE_LABELS } from '@/lib/constants';
import { useNav } from './nav';
import { useStore } from './store';
import { BellIcon, PlusIcon, SendIcon, TimerIcon } from 'lucide-react';

export function Topbar() {
  const { currentUser, setModal, toast } = useStore();
  const { page } = useNav();
  const canCreate = !!(currentUser?.isAdmin || currentUser?.isAdmin_assistant);
  const showLogTime = ['kanban', 'list', 'team'].includes(page);

  return (
    <div className="topbar">
      <div className="tb-breadcrumb">
        <span>Retrieve</span><span className="tb-sep">/</span>
        <span className="tb-page">{PAGE_LABELS[page] || page}</span>
      </div>
      <div className="topbar-actions">
        {showLogTime && <button className="btn-outline" onClick={() => setModal({ kind: 'logTime' })}><TimerIcon size={14} /> Log Time</button>}
        {canCreate && <button className="btn-solid" onClick={() => setModal({ kind: 'matter' })}><PlusIcon size={14} /> New Task</button>}
        <button className="icon-btn" onClick={() => toast(SendIcon, 'Notifications sent', 'Task alerts dispatched to team.')}>
          <BellIcon size={16} /><div className="notif-pip" />
        </button>
      </div>
    </div>
  );
}
