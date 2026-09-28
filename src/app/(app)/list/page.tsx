'use client';

import { MatterFilterRow, useMatterFilters } from '@/components/MatterFilters';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { firstWords, fmtDate, isOD, pri, progColor, stat } from '@/lib/helpers';

export default function ListPage() {
  const { selectedPid, setModal, openPanel } = useStore();
  const { go } = useNav();
  const filters = useMatterFilters();
  const f = filters.list;

  return (
    <div className="page active" id="page-list">
      <PageHeader title="All" light="Matters" sub={`${f.length} matters`}>
        <div className="seg-ctrl">
          <button className="seg-btn active">List</button>
          <button className="seg-btn" onClick={() => go('kanban')}>Kanban</button>
        </div>
        <button className="btn-solid" onClick={() => setModal({ kind: 'matter' })}>＋ New Matter</button>
      </PageHeader>
      <MatterFilterRow {...filters} withStatus />

      <div className="data-table-wrap">
        {f.length === 0 ? (
          <div className="dt-empty">No matters match your filters.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Matter</th><th>Client</th><th>Type</th><th>Practice Area</th>
                <th>Team</th><th>Priority</th><th>Status</th><th>Progress</th><th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {f.map(p => {
                const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
                return (
                  <tr key={p.id} className={p.id === selectedPid ? 'selected' : ''} onClick={() => openPanel(p.id)}>
                    <td><div className="dt-title">{p.title}{p.isPrivate && <span className="dt-private-badge">🔒 Private</span>}</div></td>
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
                      {od ? '⚠ ' : ''}{fmtDate(p.due)}
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
