'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_SRC } from '@/lib/constants';
import { isOpen } from '@/lib/helpers';
import { useNav } from './nav';
import { useStore } from './store';
import { Building2Icon, CalendarIcon, KeyRoundIcon, LayoutDashboardIcon, ListChecksIcon, ListIcon, LogOutIcon, MessagesSquareIcon, MoonIcon, ReceiptIcon, SettingsIcon, SquareKanbanIcon, SunIcon, TimerIcon, UsersIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = { id: string; icon: LucideIcon; label: string; badge?: number; badgeStyle?: React.CSSProperties };

export function Sidebar() {
  const { currentUser, projects, chatUnread, search, setSearch, isDark, toggleTheme, logout } = useStore();
  const { page, go } = useNav();
  const router = useRouter();
  const [avatarFailed, setAvatarFailed] = useState(false);
  if (!currentUser) return null;

  const isAdmin = !!currentUser.isAdmin;
  const isBilling = !!(currentUser.isBilling || currentUser.isAdmin);
  // Open tasks assigned to me, plus tasks waiting for my review as supervisor.
  const pendingTasks = projects.filter(p => (isOpen(p) && p.assignees.includes(currentUser.id)) || (p.status === 'review' && p.supervisor === currentUser.id)).length;
  const myTasks = { id: 'tasks', icon: ListChecksIcon, label: 'My Tasks', badge: pendingTasks };

  const link = (n: NavItem) => (
    <div key={n.id} className={`nav-link${page === n.id ? ' active' : ''}`} onClick={() => go(n.id)} data-page={n.id}>
      <span className="nl-icon"><n.icon size={15} /></span>
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
          <input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="sb-nav">
        <div className="sb-section">Overview</div>
        {!isAdmin && link(myTasks)}
        {link({ id: 'dashboard', icon: LayoutDashboardIcon, label: 'Dashboard' })}
        {isAdmin && link(myTasks)}
        <div className="sb-section">Tasks</div>
        {link({ id: 'kanban', icon: SquareKanbanIcon, label: 'Kanban Board' })}
        {link({ id: 'list', icon: ListIcon, label: 'All Tasks' })}
        {link({ id: 'calendar', icon: CalendarIcon, label: 'Calendar' })}
        {link({ id: 'clients', icon: Building2Icon, label: 'Clients' })}
        {link({ id: 'team', icon: UsersIcon, label: 'Team Workload' })}
        {isAdmin && link({ id: 'logs', icon: TimerIcon, label: 'Logs' })}
        {link({ id: 'chat', icon: MessagesSquareIcon, label: 'Team Chat', badge: chatUnread })}
        {isBilling && (
          <>
            <div className="nav-divider" />
            <div className="sb-section">Finance</div>
            {link({ id: 'billing', icon: ReceiptIcon, label: 'Billing & Invoices' })}
          </>
        )}
        {isAdmin && (
          <>
            <div className="nav-divider" />
            <div className="sb-section">Admin</div>
            {link({ id: 'settings', icon: SettingsIcon, label: 'Settings & Access' })}
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
          <button className="sb-icon-btn" onClick={toggleTheme} title="Toggle theme">{isDark ? <MoonIcon size={13} /> : <SunIcon size={13} />}</button>
          <button className="sb-icon-btn" onClick={() => router.push('/reset-password')} title="Change password"><KeyRoundIcon size={13} /></button>
          <button className="sb-icon-btn" onClick={async () => { await logout(); router.replace('/'); }} title="Sign out"><LogOutIcon size={13} /></button>
        </div>
      </div>
    </nav>
  );
}
