'use client';

import { MatterFilterRow, useMatterFilters } from '@/components/MatterFilters';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { STATUSES } from '@/lib/constants';
import { firstWords, fmtShort, isOD, pri, progColor, stat } from '@/lib/helpers';
import type { StatusId } from '@/lib/types';
import { GlobeIcon, LockIcon, MoveIcon, TriangleAlertIcon } from 'lucide-react';

export default function KanbanPage() {
  const { currentUser, selectedPid, openPanel, setStatus, togglePrivacy, toast } = useStore();
  const filters = useMatterFilters();
  const f = filters.list;

  /* Mouse drag & drop: drag a card into any column to change its status; a plain click opens it.
     Drop target = whichever column the pointer is horizontally over (no need to hit the cards).
     The board auto-scrolls near its edges; Esc cancels. */
  function onBoardMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.m-card[data-pid]');
    if (!card || target.closest('button, input, select, a')) return;
    e.preventDefault();

    const board = e.currentTarget;
    const pid = card.dataset.pid!;
    const startCol = card.closest('.k-col');
    const sx = e.clientX, sy = e.clientY;
    let px = sx, py = sy;
    let dragging = false;
    let ghost: HTMLElement | null = null;
    let overCol: HTMLElement | null = null;
    let raf = 0;

    const colAt = (x: number, y: number) => {
      const br = board.getBoundingClientRect();
      if (y < br.top - 40 || y > Math.max(br.bottom, window.innerHeight) ) return null;
      return [...board.querySelectorAll<HTMLElement>('.k-col')].find(c => {
        const r = c.getBoundingClientRect();
        return x >= r.left - 6 && x <= r.right + 6;
      }) ?? null;
    };
    const highlight = () => {
      const col = colAt(px, py);
      const next = col && col !== startCol ? col : null;
      if (next !== overCol) {
        overCol?.classList.remove('drag-over');
        next?.classList.add('drag-over');
        overCol = next;
      }
    };
    // Auto-scroll the board sideways (and the page vertically) while dragging near an edge.
    const tick = () => {
      const br = board.getBoundingClientRect(), edge = 80, speed = 18;
      if (px < br.left + edge) board.scrollLeft -= speed * (1 - Math.max(px - br.left, 0) / edge);
      else if (px > br.right - edge) board.scrollLeft += speed * (1 - Math.max(br.right - px, 0) / edge);
      if (py < 70) window.scrollBy(0, -speed);
      else if (py > window.innerHeight - 50) window.scrollBy(0, speed);
      highlight();
      raf = requestAnimationFrame(tick);
    };

    function onMove(ev: MouseEvent) {
      px = ev.clientX; py = ev.clientY;
      const dx = px - sx, dy = py - sy;
      if (!dragging && Math.sqrt(dx * dx + dy * dy) < 6) return;
      if (!dragging) {
        dragging = true;
        const r = card!.getBoundingClientRect();
        ghost = card!.cloneNode(true) as HTMLElement;
        Object.assign(ghost.style, {
          position: 'fixed', width: r.width + 'px', left: r.left + 'px', top: r.top + 'px', margin: '0',
          pointerEvents: 'none', zIndex: '9999', opacity: '0.93',
          transform: 'rotate(1.5deg) scale(1.02)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          transition: 'none', cursor: 'grabbing',
        });
        document.body.appendChild(ghost);
        document.body.style.cursor = 'grabbing';
        card!.style.opacity = '0.3';
        raf = requestAnimationFrame(tick);
      }
      ghost!.style.left = px - 110 + 'px';
      ghost!.style.top = py - 40 + 'px';
      highlight();
    }

    function cleanup() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      overCol?.classList.remove('drag-over');
      ghost?.remove();
      document.body.style.cursor = '';
      card!.style.opacity = '';
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') { overCol?.classList.remove('drag-over'); overCol = null; dragging = true; onUp(); }
    }
    function onUp() {
      const drop = overCol;
      const wasDrag = dragging;
      cleanup();
      if (wasDrag && drop) {
        const ns = drop.dataset.status as StatusId;
        const p = f.find(x => x.id === pid);
        if (p && ns && p.status !== ns) {
          if (setStatus(pid, ns)) toast(MoveIcon, 'Moved', `"${p.title}" → ${stat(ns).label}`);
        }
      } else if (!wasDrag) {
        openPanel(pid);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKey);
  }

  return (
    <div className="page active" id="page-kanban">
      <PageHeader title="Kanban" light="Board" sub={`${f.length} task${f.length !== 1 ? 's' : ''} shown · drag a card to another column to move it`} />
      <MatterFilterRow {...filters} />

      <div className="kanban" onMouseDown={onBoardMouseDown}>
        {STATUSES.map(col => {
          const cards = f.filter(p => p.status === col.id);
          return (
            <div key={col.id} className="k-col" data-status={col.id}>
              <div className="k-col-hdr">
                <div className="k-col-info">
                  <div className="k-col-dot" style={{ background: col.col }} />
                  <span className="k-col-name" style={{ color: col.col }}>{col.label}</span>
                </div>
                <span className="k-col-count">{cards.length}</span>
              </div>
              <div className="k-cards">
                {cards.map(p => {
                  const pr = pri(p.priority), od = isOD(p);
                  const isOwner = !p.createdBy || p.createdBy === currentUser?.id;
                  return (
                    <div
                      key={p.id}
                      className={`m-card${p.id === selectedPid ? ' selected' : ''}${od ? ' overdue' : ''}`}
                      style={{ '--card-accent': col.col } as React.CSSProperties}
                      data-pid={p.id}
                    >
                      {p.isPrivate && <div className="mc-private-badge"><LockIcon size={10} /> Private</div>}
                      <div className="mc-top">
                        <div className="mc-title">{p.title}</div>
                        <Tag {...pr} />
                      </div>
                      <div className="mc-client">{p.client}</div>
                      <div className="mc-pbar"><div className="pbar"><div className="pbar-fill" style={{ width: `${p.progress}%`, background: progColor(p.progress) }} /></div></div>
                      <div className="mc-foot">
                        <AvStack ids={p.assignees.slice(0, 3)} />
                        <div className={`mc-due${od ? ' overdue' : ''}`}>{od && <><TriangleAlertIcon size={11} /> </>}{fmtShort(p.due)}</div>
                      </div>
                      <div className="mc-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{p.matterType ? `${p.matterType} · ` : ''}{firstWords(p.area, 3)}</span>
                        {isOwner && (
                          <button
                            className="mc-priv-btn"
                            title={p.isPrivate ? 'Make public' : 'Make private'}
                            onClick={e => { e.stopPropagation(); togglePrivacy(p.id); }}
                            style={{
                              fontSize: 11, padding: '1px 5px', borderRadius: 'var(--r-sm)', background: 'none', border: 'none',
                              cursor: 'pointer', color: p.isPrivate ? '#7C6FF7' : 'var(--text-tertiary)', opacity: 0.7,
                            }}
                          >
                            {p.isPrivate ? <LockIcon size={12} /> : <GlobeIcon size={12} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && <div className="k-empty">No tasks</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
