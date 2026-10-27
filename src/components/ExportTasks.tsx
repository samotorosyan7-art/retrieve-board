'use client';

import { useEffect, useRef, useState } from 'react';
import { LOGO_SRC, STATUSES } from '@/lib/constants';
import { canSeeMatter } from '@/lib/helpers';
import { EXPORTED_STATUSES, tasksHtml } from '@/lib/task-export';
import { byDate } from './MatterFilters';
import { useStore } from './store';
import { Av } from './ui';
import { FileTextIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';

/** List / Kanban header: a member's open tasks (Intake → Supervisor Review) as a printable page, opened in a new tab.
 *  Members export their own straight away; admins click, then pick the member from a list. */
export function ExportTasksButton() {
  const { projects, team, currentUser, emp, firm, toast } = useStore();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // The member list closes on a click outside it or on Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!currentUser) return null;

  const tasksOf = (who: string) => {
    const byDue = byDate('due', 1, '9999-12-31');
    return projects
      .filter(p => p.assignees.includes(who) && EXPORTED_STATUSES.includes(p.status) && canSeeMatter(p, currentUser, team))
      .sort((a, b) => EXPORTED_STATUSES.indexOf(a.status) - EXPORTED_STATUSES.indexOf(b.status) || byDue(a, b));
  };

  const exportPdf = (who: string) => {
    setOpen(false);
    const member = emp(who);
    const tasks = tasksOf(who);
    if (!member) return;
    if (!tasks.length) {
      toast(InfoIcon, 'Nothing to export', `${member.name} has no tasks in ${STATUSES.filter(s => EXPORTED_STATUSES.includes(s.id)).map(s => s.label).join(', ')}.`);
      return;
    }
    // Opens in a new tab, ready to print — the user prints or saves it as PDF from there (⌘P / Ctrl+P).
    const w = window.open('', '_blank');
    if (!w) { toast(TriangleAlertIcon, 'Pop-up blocked', 'Allow pop-ups for this site to export the tasks.'); return; }
    w.document.write(tasksHtml(member, tasks, team, firm, location.origin + LOGO_SRC));
    w.document.close();
  };

  return (
    <div className="export-tasks" ref={wrap}>
      <button
        className="btn-outline"
        onClick={() => (currentUser.isAdmin ? setOpen(o => !o) : exportPdf(currentUser.id))}
        title="Opens a printable page of tasks in Intake, In Progress, Client Input / Backlog and Supervisor Review"
        aria-haspopup={currentUser.isAdmin ? 'menu' : undefined}
        aria-expanded={currentUser.isAdmin ? open : undefined}
      >
        <FileTextIcon size={14} /> Export PDF
      </button>
      {open && (
        <div className="export-menu" role="menu">
          <div className="export-menu-title">Export tasks of…</div>
          {team.map(e => {
            const n = tasksOf(e.id).length;
            return (
              <button key={e.id} className={`export-menu-item${n ? '' : ' empty'}`} role="menuitem" onClick={() => exportPdf(e.id)}>
                <Av e={e} size={20} />
                <span className="export-menu-name">{e.name}</span>
                <span className="export-menu-count">{n}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
