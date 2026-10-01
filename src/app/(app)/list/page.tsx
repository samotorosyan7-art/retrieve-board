'use client';

import { MatterFilterRow, useMatterFilters } from '@/components/MatterFilters';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { firstWords, fmtDue, isOD, pri, progColor, stat } from '@/lib/helpers';
import { LockIcon, TriangleAlertIcon } from 'lucide-react';

export default function ListPage() {
  const { selectedPid, openPanel } = useStore();
  const { go } = useNav();
  const filters = useMatterFilters();
  const f = filters.list;

  return (
    <div className="page active" id="page-list">
      <PageHeader title="All" light="Tasks" sub={`${f.length} task${f.length !== 1 ? 's' : ''}`}>
        <div className="seg-ctrl">
          <button className="seg-btn active">List</button>
          <button className="seg-btn" onClick={() => go('kanban')}>Kanban</button>
        </div>
      </PageHeader>
      <MatterFilterRow {...filters} withStatus />

      <div className="data-table-wrap">
        {f.length === 0 ? (
          <div className="dt-empty">No tasks match your filters.</div>
        ) : (
          <table className="data-table">
            <colgroup>
              {[19, 12, 9, 11, 10, 8, 11, 10, 10].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th>Task</th><th>Client</th><th>Type</th><th>Practice Area</th>
                <th>Assignee</th><th>Priority</th><th>Status</th><th>Progress</th><th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {f.map(p => {
                const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
                return (
                  <tr key={p.id} className={p.id === selectedPid ? 'selected' : ''} onClick={() => openPanel(p.id)}>
                    <td><div className="dt-title">{p.title}{p.isPrivate && <span className="dt-private-badge"><LockIcon size={10} /> Private</span>}</div></td>
                    <td><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.client}</div></td>
                    <td><div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{p.matterType || '—'}</div></td>
                    <td><div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{firstWords(p.area, 3)}</div></td>
                    <td><AvStack ids={p.assignees} size={22} withInitials /></td>
                    <td><Tag {...pr} /></td>
                    <td><Tag {...st} /></td>
                    <td>
                      <div className="dt-prog">
                        <div className="dt-prog-bar"><div className="dt-prog-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div>
                        <span className="dt-prog-val">{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: od ? 'var(--p-high)' : 'var(--text-tertiary)' }}>
                      {od && <><TriangleAlertIcon size={11} /> </>}{fmtDue(p)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
