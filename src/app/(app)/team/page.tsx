'use client';

import { useState } from 'react';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { PageHeader, Photo, Tag } from '@/components/ui';
import { pri, stat, isOpen } from '@/lib/helpers';
import { ArrowRightIcon } from 'lucide-react';

export default function TeamPage() {
  const { team, projects, openPanel } = useStore();
  const { go } = useNav();
  const [fe, setFe] = useState('');
  const shown = fe ? team.filter(e => e.id === fe) : team;

  return (
    <div className="page active" id="page-team">
      <PageHeader title="Team" light="Workload" sub="Live view of every attorney's current tasks and capacity">
        <select className="sel" value={fe} onChange={e => setFe(e.target.value)}>
          <option value="">All members</option>
          {team.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </PageHeader>

      <div className="team-grid">
        {shown.map(e => {
          const myP = projects.filter(p => p.assignees.includes(e.id));
          const inProgress = myP.filter(isOpen);
          const done = myP.filter(p => p.status === 'done').length;
          const archived = myP.filter(p => p.status === 'archive').length;
          return (
            <div key={e.id} className="emp-card">
              <div className="ec-header">
                <div className="ec-identity">
                  <div className="ec-photo" style={{ borderColor: `${e.color}44` }}><Photo src={e.img} /></div>
                  <div><div className="ec-name">{e.name}</div><div className="ec-role">{e.role}</div></div>
                </div>
                <div className="ec-kpis">
                  <Kpi val={inProgress.length} label="In progress" color="var(--s-active)" />
                  <Kpi val={done} label="Completed" color="var(--s-done)" />
                  <Kpi val={archived} label="Archived" color="var(--text-tertiary)" />
                </div>
              </div>
              <div className="ec-body">
                <div className="ec-section-lbl">In progress</div>
                {inProgress.slice(0, 3).map(p => (
                  <div key={p.id} className="ec-matter" onClick={() => openPanel(p.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}><div className="ec-m-title">{p.title}</div><div className="ec-m-client">{p.client}</div></div>
                    <div style={{ display: 'flex', gap: 4 }}><Tag {...pri(p.priority)} /><Tag {...stat(p.status)} /></div>
                  </div>
                ))}
                {inProgress.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No tasks in progress</div>}
                <button className="btn-outline" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => go(`list?emp=${encodeURIComponent(e.id)}`)}>
                  View all tasks <ArrowRightIcon size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ val, label, color }: { val: number; label: string; color: string }) {
  return (
    <div className="ec-kpi">
      <div className="ec-kpi-val" style={{ color }}>{val}</div>
      <div className="ec-kpi-lbl">{label}</div>
    </div>
  );
}
