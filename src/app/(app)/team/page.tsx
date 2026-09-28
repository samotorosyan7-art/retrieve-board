'use client';

import { useState } from 'react';
import { useStore } from '@/components/store';
import { PageHeader, Photo, Tag } from '@/components/ui';
import { pri, stat, utilColor, isOpen } from '@/lib/helpers';

export default function TeamPage() {
  const { team, projects, tasks, openPanel } = useStore();
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
          const active = myP.filter(p => p.status === 'inprogress').length;
          const done = myP.filter(p => p.status === 'done').length;
          const hp = myP.filter(p => p.priority === 'high' && isOpen(p)).length;
          const myTasks = tasks.filter(t => t.who === e.id && !t.done).length;
          const inProgress = myP.filter(p => isOpen(p));
          const util = Math.min(Math.round((inProgress.length / Math.max(projects.length / team.length, 1)) * 100), 100);
          return (
            <div key={e.id} className="emp-card">
              <div className="ec-header">
                <div className="ec-identity">
                  <div className="ec-photo" style={{ borderColor: `${e.color}44` }}><Photo src={e.img} /></div>
                  <div><div className="ec-name">{e.name}</div><div className="ec-role">{e.role}</div></div>
                </div>
                <div className="ec-kpis">
                  <Kpi val={active} label="Active" color="var(--s-active)" />
                  <Kpi val={done} label="Done" color="var(--s-done)" />
                  <Kpi val={hp} label="High" color="var(--p-high)" />
                  <Kpi val={myTasks} label="To-dos" color="var(--s-review)" />
                </div>
              </div>
              <div className="ec-body">
                <div className="ec-section-lbl">Active tasks</div>
                {inProgress.slice(0, 3).map(p => (
                  <div key={p.id} className="ec-matter" onClick={() => openPanel(p.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}><div className="ec-m-title">{p.title}</div><div className="ec-m-client">{p.client}</div></div>
                    <div style={{ display: 'flex', gap: 4 }}><Tag {...pri(p.priority)} /><Tag {...stat(p.status)} /></div>
                  </div>
                ))}
                {inProgress.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No active tasks</div>}
                {inProgress.length > 3 && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>+{inProgress.length - 3} more</div>}
                <div className="ec-util" style={{ marginTop: 12 }}>
                  <div className="ec-util-lbl">Utilisation ({util}%)</div>
                  <div className="ec-util-bar"><div className="ec-util-fill" style={{ width: `${util}%`, background: utilColor(util) }} /></div>
                </div>
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
