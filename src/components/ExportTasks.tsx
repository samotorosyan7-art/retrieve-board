'use client';

import { useEffect, useRef, useState } from 'react';
import { LOGO_SRC, STATUSES } from '@/lib/constants';
import { canSeeMatter } from '@/lib/helpers';
import { EXPORTED_STATUSES, pdfFonts, tasksFileName, tasksPdf } from '@/lib/task-export';
import { byDate } from './MatterFilters';
import { useStore } from './store';
import { Av } from './ui';
import { FileTextIcon, InfoIcon, LoaderCircleIcon, TriangleAlertIcon } from 'lucide-react';

/** List / Kanban header: download a member's open tasks (Intake → Supervisor Review) as a PDF.
 *  Members export their own straight away; admins click, then pick the member from a list. */
export function ExportTasksButton() {
  const { projects, team, currentUser, emp, firm, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const exportPdf = async (who: string) => {
    setOpen(false);
    const member = emp(who);
    const tasks = tasksOf(who);
    if (!member) return;
    if (!tasks.length) {
      toast(InfoIcon, 'Nothing to export', `${member.name} has no tasks in ${STATUSES.filter(s => EXPORTED_STATUSES.includes(s.id)).map(s => s.label).join(', ')}.`);
      return;
    }
    // pdfmake (~1 MB) and the fonts load only when someone exports.
    setBusy(true);
    try {
      const pdfMake = (await import('pdfmake/build/pdfmake')).default;
      pdfMake.setFonts(pdfFonts(location.origin));
      await pdfMake.createPdf(tasksPdf(member, tasks, team, firm, location.origin + LOGO_SRC)).download(tasksFileName(member));
    } catch (e) {
      console.warn('PDF export failed', e);
      toast(TriangleAlertIcon, 'Export failed', 'The PDF could not be created. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-tasks" ref={wrap}>
      <button
        className="btn-outline"
        onClick={() => (currentUser.isAdmin ? setOpen(o => !o) : exportPdf(currentUser.id))}
        disabled={busy}
        title="Download a PDF of tasks in Intake, In Progress, Client Input / Backlog and Supervisor Review"
        aria-haspopup={currentUser.isAdmin ? 'menu' : undefined}
        aria-expanded={currentUser.isAdmin ? open : undefined}
      >
        {busy ? <LoaderCircleIcon size={14} className="spin" /> : <FileTextIcon size={14} />} {busy ? 'Exporting…' : 'Export PDF'}
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
