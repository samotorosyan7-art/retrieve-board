'use client';

import { useState } from 'react';
import { byDate } from '@/components/MatterFilters';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { firstWords, fmtDue, isOD, isOpen, pri, progColor, stat } from '@/lib/helpers';
import type { Project } from '@/lib/types';
import { PartyPopperIcon, TriangleAlertIcon } from 'lucide-react';

export default function TasksPage() {
  const { projects, currentUser, openPanel, selectedPid } = useStore();
  const [showDone, setShowDone] = useState(false);
  const byDue = byDate('due', 1, '9999-12-31');

  // Tasks assigned to me — overdue first, then by due date.
  const assigned = projects.filter(p => !!currentUser && p.assignees.includes(currentUser.id));
  const assignedOpen = assigned.filter(isOpen);
  const assignedDone = assigned.filter(p => !isOpen(p));
  const assignedShown = [...(showDone ? assignedDone : assignedOpen)].sort((a, b) => {
    if (isOD(a) !== isOD(b)) return isOD(a) ? -1 : 1;
    return byDue(a, b);
  });

  // Open tasks I'm the supervisor of, whatever their status — ones already in Supervisor Review first.
  const toReview = projects.filter(p => !!currentUser && p.supervisor === currentUser.id && isOpen(p))
    .sort((a, b) => (a.status === 'review') !== (b.status === 'review') ? (a.status === 'review' ? -1 : 1) : byDue(a, b));

  const row = (p: Project) => {
    const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
    return (
      <div key={p.id} className="urgent-row" onClick={() => openPanel(p.id)} style={p.id === selectedPid ? { background: 'var(--bg-active)' } : undefined}>
        <div className="urgent-dot" style={{ background: od ? '#F87171' : st.col }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="urgent-title">{p.title}</div>
          <div className="urgent-client">{[p.client, p.matterType, firstWords(p.area, 3)].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ width: 70 }} title={`${p.progress}%`}>
          <div className="util-track"><div className="util-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div>
        </div>
        <AvStack ids={p.assignees.slice(0, 3)} />
        <Tag {...pr} />
        <Tag {...st} />
        <div className="urgent-due" style={{ color: od ? '#F87171' : 'var(--text-tertiary)', minWidth: 64, textAlign: 'right', whiteSpace: 'nowrap' }}>{od && <><TriangleAlertIcon size={11} /> </>}{fmtDue(p, true)}</div>
      </div>
    );
  };

  return (
    <div className="page active" id="page-tasks">
      <PageHeader
        title="My" light="Tasks"
        sub={`${assignedOpen.length} open task${assignedOpen.length !== 1 ? 's' : ''} assigned to you${toReview.length ? ` · ${toReview.length} to review` : ''}`}
      />

      {toReview.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Awaiting my review ({toReview.length})</div>
          {toReview.map(row)}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Assigned to me</div>
          <div className="seg-ctrl">
            <button className={`seg-btn${!showDone ? ' active' : ''}`} onClick={() => setShowDone(false)}>Open ({assignedOpen.length})</button>
            <button className={`seg-btn${showDone ? ' active' : ''}`} onClick={() => setShowDone(true)}>Completed &amp; archived ({assignedDone.length})</button>
          </div>
        </div>
        {assignedShown.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '8px 0' }}>
            {showDone ? 'Nothing completed yet.' : <>No open tasks assigned to you <PartyPopperIcon size={13} /></>}
          </div>
        ) : assignedShown.map(row)}
      </div>
    </div>
  );
}
