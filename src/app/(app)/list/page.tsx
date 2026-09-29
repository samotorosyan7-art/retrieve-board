'use client';

import { MatterFilterRow, useMatterFilters } from '@/components/MatterFilters';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { firstWords, fmtDate, isOD, pri, progColor, stat } from '@/lib/helpers';
import { LockIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';

export default function ListPage() {
  const { selectedPid, setModal, openPanel } = useStore();
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
        <button className="btn-solid" onClick={() => setModal({ kind: 'matter' })}><PlusIcon size={14} /> New Task</button>
      </PageHeader>
      <MatterFilterRow {...filters} withStatus />

      <div className="data-table-wrap">
        {f.length === 0 ? (
          <div className="dt-empty">No tasks match your filters.</div>
        ) : (
          <table className="data-table">
            <colgroup>
              {[21, 12, 9, 11, 7, 8, 12, 10, 10].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th>Task</th><th>Client</th><th>Type</th><th>Practice Area</th>
                <th>Team</th><th>Priority</th><th>Status</th><th>Progress</th><th>Due Date</th>
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
                    <td><AvStack ids={p.assignees} size={22} /></td>
                    <td><Tag {...pr} /></td>
                    <td><Tag {...st} /></td>
                    <td>
                      <div className="dt-prog">
                        <div className="dt-prog-bar"><div className="dt-prog-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div>
                        <span className="dt-prog-val">{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: od ? 'var(--p-high)' : 'var(--text-tertiary)' }}>
                      {od && <><TriangleAlertIcon size={11} /> </>}{fmtDate(p.due)}
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
