'use client';

import { byDate } from '@/components/MatterFilters';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, Photo, Tag, cardTitle } from '@/components/ui';
import { canSeeMatter, firstWords, fmtAgo, fmtDue, isOD, isUrgent, pri, sanitizeActivity, stat, utilColor, isOpen } from '@/lib/helpers';
import { ArrowRightIcon, PartyPopperIcon, TriangleAlertIcon } from 'lucide-react';

export default function DashboardPage() {
  const { projects, team, activity, currentUser, emp, openPanel, lastLogins } = useStore();
  const { go } = useNav();

  // Each KPI opens All Tasks with the same filter, so the list matches the number.
  const visible = projects.filter(p => canSeeMatter(p, currentUser));
  const kpis = [
    { val: visible.length, label: 'Total Tasks', sub: 'across all areas', color: '#7C6FF7', href: 'list' },
    { val: visible.filter(p => p.status === 'inprogress').length, label: 'In Progress', sub: 'in progress now', color: '#E8A838', href: 'list?stat=inprogress' },
    { val: visible.filter(p => p.priority === 'high' && isOpen(p)).length, label: 'High Priority', sub: 'need attention', color: '#F87171', href: 'list?pri=high&stat=open' },
    { val: visible.filter(isOD).length, label: 'Overdue', sub: 'past due date', color: '#EF4444', href: 'list?stat=overdue' },
    { val: visible.filter(p => p.status === 'done').length, label: 'Completed', sub: 'all time', color: '#34D399', href: 'list?stat=done' },
  ];
  // Same filter and order as the list "View all" opens, so these are its first five rows.
  const urgent = visible.filter(isUrgent).sort(byDate('due', -1, '0000-01-01')).slice(0, 5);
  const activeFor = (id: string) => projects.filter(p => p.assignees.includes(id) && isOpen(p)).length;
  const maxM = Math.max(...team.map(e => activeFor(e.id)), 1);

  const areaCt: Record<string, number> = {};
  projects.forEach(p => { areaCt[p.area] = (areaCt[p.area] || 0) + 1; });
  const topAreas = Object.entries(areaCt).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxA = topAreas[0]?.[1] || 1;

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
      </div>

      <div className="kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card" style={{ '--kpi-color': k.color } as React.CSSProperties} onClick={() => go(k.href)}>
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
              <button className="btn-ghost" style={{ fontSize: 11.5, padding: '4px 10px' }} onClick={() => go('list?stat=urgent&sort=deadline-desc')}>View all <ArrowRightIcon size={12} /></button>
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
                  <div className="urgent-due" style={{ color: od ? '#F87171' : 'var(--text-tertiary)' }}>{od && <><TriangleAlertIcon size={11} /> </>}{fmtDue(p, true)}</div>
                </div>
              );
            }) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '8px 0' }}>All clear — no urgent tasks <PartyPopperIcon size={13} /></div>
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
                      {lastLogins && (
                        <span
                          style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginLeft: 6 }}
                          title={lastLogins[e.id] ? `Last login: ${new Date(lastLogins[e.id]).toLocaleString('en-GB')}` : 'Has not logged in yet'}
                        >
                          · {lastLogins[e.id] ? `last login ${fmtAgo(lastLogins[e.id]).replace('Just now', 'just now')}` : 'never logged in'}
                        </span>
                      )}
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
        </div>
      </div>
    </div>
  );
}
