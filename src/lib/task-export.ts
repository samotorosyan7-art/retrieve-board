import { PRIORITIES, STATUSES } from './constants';
import { escapeHtml as esc, fmtDate, fmtDue, isOD } from './helpers';
import type { FirmSettings, Member, Project, StatusId } from './types';

/* A member's open tasks as a printable page (List / Kanban → Export PDF), opened in a new tab; the user prints it from there. */

/** Statuses that count as work on a member's plate, in board order. */
export const EXPORTED_STATUSES: StatusId[] = ['intake', 'inprogress', 'backlog', 'review'];

const C = { text: '#0F172A', muted: '#64748B', faint: '#94A3B8', line: '#E2E8F0', panel: '#F8FAFC' };
const FONT = `'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const MONO = `'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace`;

/** `tasks` are already filtered to EXPORTED_STATUSES and sorted. `logoUrl` must be absolute (the page opens in a new window). */
export function tasksHtml(member: Member, tasks: Project[], team: Member[], firm: FirmSettings, logoUrl: string) {
  const name = (id: string) => team.find(m => m.id === id)?.name ?? '';
  const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const section = (s: (typeof STATUSES)[number]) => {
    const list = tasks.filter(p => p.status === s.id);
    if (!list.length) return '';
    return `
<h2><span class="dot" style="background:${s.col}"></span>${esc(s.label)}<span class="count">${list.length}</span></h2>
<table>
  <colgroup><col style="width:29%"><col style="width:13%"><col style="width:15%"><col style="width:7%"><col style="width:8%"><col style="width:14%"><col style="width:14%"></colgroup>
  <thead><tr><th>Task</th><th>Client</th><th>Type · Area</th><th>Priority</th><th class="r">Progress</th><th>Team</th><th>Due</th></tr></thead>
  <tbody>${list.map(p => {
    const pr = PRIORITIES.find(x => x.id === p.priority);
    const others = p.assignees.filter(a => a !== member.id).map(name).filter(Boolean);
    const people = [
      others.length ? `<div><span class="k">With</span> ${esc(others.join(', '))}</div>` : '',
      p.supervisor ? `<div><span class="k">Supervisor</span> ${esc(name(p.supervisor))}</div>` : '',
    ].join('');
    return `<tr>
      <td><div class="title">${esc(p.title)}</div>${p.notes.trim() ? `<div class="notes">${esc(p.notes.trim())}</div>` : ''}</td>
      <td>${esc(p.client)}</td>
      <td>${esc([p.matterType, p.area].filter(Boolean).join(' · '))}</td>
      <td>${pr ? `<span style="color:${pr.col};font-weight:700">${esc(pr.label)}</span>` : ''}</td>
      <td class="r mono">${p.progress}%</td>
      <td class="small">${people || '<span class="k">—</span>'}</td>
      <td class="mono">${p.due ? `<span${isOD(p) ? ' class="od"' : ''}>${esc(fmtDue(p))}${isOD(p) ? ' · overdue' : ''}</span>` : '<span class="k">No due date</span>'}<div class="k">Created ${esc(fmtDate(p.created))}</div></td>
    </tr>`;
  }).join('')}</tbody>
</table>`;
  };

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Open tasks — ${esc(member.name)} — ${esc(asOf)}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  @page{size:A4 landscape;margin:12mm}
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:#fff;color:${C.text};font-family:${FONT};font-size:11px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media print{body{padding:0}}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding:16px 18px;background:${C.panel};border:1px solid ${C.line};border-radius:10px}
  .brand{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;letter-spacing:-0.02em}
  .brand img{height:32px;width:auto}
  .meta{text-align:right;color:${C.muted}}
  .meta .label{font-size:9.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.faint}}
  .meta .who{font-size:15px;font-weight:700;color:${C.text};margin:2px 0}
  h2{display:flex;align-items:center;gap:8px;margin:20px 0 8px;font-size:12.5px;font-weight:700;break-after:avoid}
  .dot{width:9px;height:9px;border-radius:50%}
  .count{font-family:${MONO};font-size:10.5px;font-weight:500;color:${C.faint}}
  table{width:100%;border-collapse:collapse;table-layout:fixed}
  th{padding:7px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.faint};background:${C.panel};border-bottom:1px solid ${C.line}}
  td{padding:8px;vertical-align:top;border-bottom:1px solid #F1F5F9;overflow-wrap:anywhere}
  tr{break-inside:avoid}
  .r{text-align:right}
  .mono{font-family:${MONO};font-size:10.5px}
  .small{font-size:10.5px}
  .title{font-weight:700}
  .notes{margin-top:3px;color:${C.muted};font-size:10.5px;white-space:pre-wrap}
  .k{color:${C.faint};font-size:10px;font-family:${FONT}}
  .od{color:#DC2626;font-weight:700}
  .empty{margin-top:24px;color:${C.muted}}
</style></head>
<body>
  <div class="hdr">
    <div class="brand"><img src="${esc(logoUrl)}" alt="">${esc(firm.name)}</div>
    <div class="meta">
      <div class="label">Open tasks</div>
      <div class="who">${esc(member.name)}</div>
      <div>As of ${esc(asOf)} · ${tasks.length} task${tasks.length === 1 ? '' : 's'}</div>
    </div>
  </div>
  ${tasks.length ? STATUSES.filter(s => EXPORTED_STATUSES.includes(s.id)).map(section).join('') : '<div class="empty">No open tasks.</div>'}
</body></html>`;
}
