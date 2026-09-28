'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_SRC } from '@/lib/constants';
import { useNav } from './nav';
import { useStore } from './store';

type NavItem = { id: string; icon: string; label: string; badge?: number; badgeStyle?: React.CSSProperties };

export function Sidebar() {
  const { currentUser, clients, tasks, chatUnread, search, setSearch, isDark, toggleTheme, logout } = useStore();
  const { page, go } = useNav();
  const router = useRouter();
  const [avatarFailed, setAvatarFailed] = useState(false);
  if (!currentUser) return null;

  const isAdmin = !!currentUser.isAdmin;
  const isBilling = !!(currentUser.isBilling || currentUser.isAdmin);
  const pendingTasks = tasks.filter(t => t.who === currentUser.id && !t.done).length;

  const link = (n: NavItem) => (
    <div key={n.id} className={`nav-link${page === n.id ? ' active' : ''}`} onClick={() => go(n.id)} data-page={n.id}>
      <span className="nl-icon">{n.icon}</span>
      <span className="nl-label">{n.label}</span>
      {!!n.badge && <span className="nl-badge" style={n.badgeStyle}>{n.badge}</span>}
    </div>
  );

  return (
    <nav className="sidebar">
      <div className="sb-top">
        <div className="sb-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="sb-logo-img" src={LOGO_SRC} alt="R" />
          <div><div className="sb-firm">Retrieve</div><div className="sb-city">Legal &amp; Tax · Yerevan</div></div>
        </div>
        <div className="sb-search">
          <input placeholder="Search matters…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="sb-nav">
        <div className="sb-section">Overview</div>
        {link({ id: 'dashboard', icon: '◉', label: 'Dashboard' })}
        <div className="sb-section">Matters</div>
        {link({ id: 'kanban', icon: '⊞', label: 'Kanban Board' })}
        {link({ id: 'list', icon: '≡', label: 'All Matters' })}
        {link({ id: 'calendar', icon: '📅', label: 'Calendar' })}
        {link({ id: 'clients', icon: '🏢', label: 'Clients', badge: clients.length, badgeStyle: { background: 'var(--s-done)' } })}
        {link({ id: 'team', icon: '👥', label: 'Team Workload' })}
        {link({ id: 'tasks', icon: '✓', label: 'My Tasks', badge: pendingTasks })}
        {link({ id: 'chat', icon: '💬', label: 'Team Chat', badge: chatUnread })}
        {isBilling && (
          <>
            <div className="nav-divider" />
            <div className="sb-section">Finance</div>
            {link({ id: 'billing', icon: '₾', label: 'Billing & Invoices' })}
          </>
        )}
        {isAdmin && (
          <>
            <div className="nav-divider" />
            <div className="sb-section">Admin</div>
            {link({ id: 'settings', icon: '⚙', label: 'Settings & Access' })}
          </>
        )}
      </div>
      <div className="sb-user">
        <div className="sb-user-av">
          {currentUser.img && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUser.img} alt="" style={{ display: 'block' }} onError={() => setAvatarFailed(true)} />
          ) : (
            <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', background: currentUser.color || 'var(--bg-overlay)' }}>
              {currentUser.init}
            </div>
          )}
        </div>
        <div><div className="sb-user-name">{currentUser.name}</div><div className="sb-user-role">{currentUser.role}</div></div>
        <div className="sb-actions">
          <button className="sb-icon-btn" onClick={toggleTheme} title="Toggle theme">{isDark ? '🌙' : '☀️'}</button>
          <button className="sb-icon-btn" onClick={() => router.push('/reset-password')} title="Change password">🔑</button>
          <button className="sb-icon-btn" onClick={async () => { await logout(); router.replace('/'); }} title="Sign out">⏻</button>
        </div>
      </div>
    </nav>
  );
}
