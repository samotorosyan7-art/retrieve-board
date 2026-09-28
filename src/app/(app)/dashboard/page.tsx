'use client';

import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, Photo, Tag, cardTitle } from '@/components/ui';
import { canSeeMatter, firstWords, fmtShort, isOD, isTaskOD, pri, sanitizeActivity, stat, utilColor, isOpen } from '@/lib/helpers';

export default function DashboardPage() {
  const { projects, tasks, team, activity, currentUser, emp, setModal, openPanel, toggleTask } = useStore();
  const { go } = useNav();

  const kpis = [
    { val: projects.length, label: 'Total Matters', sub: 'across all areas', color: '#7C6FF7' },
    { val: projects.filter(p => p.status === 'inprogress').length, label: 'In Progress', sub: 'in progress now', color: '#E8A838' },
    { val: projects.filter(p => p.priority === 'high' && isOpen(p)).length, label: 'High Priority', sub: 'need attention', color: '#F87171' },
    { val: projects.filter(isOD).length, label: 'Overdue', sub: 'past due date', color: '#EF4444' },
    { val: projects.filter(p => p.status === 'done').length, label: 'Completed', sub: 'all time', color: '#34D399' },
  ];
  const urgent = projects.filter(p => (isOD(p) || p.priority === 'high') && canSeeMatter(p, currentUser)).slice(0, 5);
  const activeFor = (id: string) => projects.filter(p => p.assignees.includes(id) && isOpen(p)).length;
  const maxM = Math.max(...team.map(e => activeFor(e.id)), 1);

  const areaCt: Record<string, number> = {};
  projects.forEach(p => { areaCt[p.area] = (areaCt[p.area] || 0) + 1; });
  const topAreas = Object.entries(areaCt).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxA = topAreas[0]?.[1] || 1;

  const pendTasks = tasks.filter(t => !t.done).length;
  const myTasks = tasks.filter(t => t.who === currentUser?.id && !t.done).slice(0, 4);

  return (
    <div className="page active" id="page-dashboard">
      <div className="page-hdr">
        <div className="page-hdr-left">
          <div className="page-title">
            Good morning, <em style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>{currentUser?.name.split(' ')[0]}</em>
          </div>
          <div className="page-sub">
            Here&apos;s what needs your attention today — {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <button className="btn-solid" onClick={() => setModal({ kind: 'matter' })}>＋ New Matter</button>
      </div>

      <div className="kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card" style={{ '--kpi-color': k.color } as React.CSSProperties} onClick={() => go('list')}>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-body">
        <div className="dash-col-wide">
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={cardTitle}>Urgent &amp; Overdue</div>
              <button className="btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={() => go('list')}>View all →</button>
            </div>
            {urgent.length ? urgent.map(p => {
              const st = stat(p.status), pr = pri(p.priority), od = isOD(p);
              return (
                <div key={p.id} className="urgent-row" onClick={() => openPanel(p.id)}>
                  <div className="urgent-dot" style={{ background: od ? '#F87171' : st.col }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="urgent-title">{p.title}</div>
                    <div className="urgent-client">{p.client} · {firstWords(p.area, 2)}</div>
                  </div>
                  <AvStack ids={p.assignees.slice(0, 2)} />
                  <Tag {...pr} />
                  <div className="urgent-due" style={{ color: od ? '#F87171' : 'var(--text-tertiary)' }}>{od ? '⚠ ' : ''}{fmtShort(p.due)}</div>
                </div>
              );
            }) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '8px 0' }}>All clear — no urgent matters 🎉</div>
            )}
          </div>

          <div className="card">
            <div style={{ ...cardTitle, marginBottom: 14 }}>Practice Areas</div>
            {topAreas.map(([area, count]) => (
              <div key={area} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{firstWords(area, 3)}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{count}</span>
                </div>
                <div className="util-track"><div className="util-fill" style={{ width: `${Math.round((count / maxA) * 100)}%`, background: 'var(--s-intake)' }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-col-wide">
          <div className="card">
            <div style={{ ...cardTitle, marginBottom: 14 }}>Team Utilisation</div>
            {team.map(e => {
              const active = activeFor(e.id);
              const pct = Math.round((active / maxM) * 100);
              const col = utilColor(pct);
              return (
                <div key={e.id} className="util-bar">
                  <div className="util-hdr">
                    <div className="util-emp">
                      <div className="util-empav"><Photo src={e.img} /></div>
                      <span className="util-name">{e.name.split(' ')[0]}</span>
                    </div>
                    <span className="util-hrs" style={{ color: col }}>{active} active</span>
                  </div>
                  <div className="util-track"><div className="util-fill" style={{ width: `${pct}%`, background: col }} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dash-col-narrow">
          <div className="card">
            <div style={{ ...cardTitle, marginBottom: 12 }}>Recent Activity</div>
            {activity.map((a, i) => {
              const e = emp(a.who);
              return (
                <div key={i} className="feed-item">
                  <div className="feed-av"><Photo src={e?.img} /></div>
                  <div className="feed-content">
                    <div className="feed-text">
                      <span className="bold">{e?.name.split(' ')[0] || ''}</span>{' '}
                      <span dangerouslySetInnerHTML={{ __html: sanitizeActivity(a.text) }} />
                    </div>
                    <div className="feed-time">{a.time}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={cardTitle}>My Tasks</div>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{pendTasks} pending</span>
            </div>
            {myTasks.length ? myTasks.map(t => {
              const p = projects.find(x => x.id === t.pid);
              return (
                <div key={t.id} className="task-item" style={{ marginBottom: 5 }}>
                  <div className="task-chk pend" onClick={() => toggleTask(t.id)} />
                  <div className="task-body">
                    <div className="task-title">{t.title}</div>
                    <div className="task-meta">
                      <span className="task-matter">{p?.title || ''}</span>
                      <span className={`task-due${isTaskOD(t) ? ' overdue' : ''}`}>· {fmtShort(t.due)}</span>
                    </div>
                  </div>
                </div>
              );
            }) : <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No pending tasks 🎉</div>}
            <button className="btn-ghost" style={{ width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => go('tasks')}>View all tasks →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
