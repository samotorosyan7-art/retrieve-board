import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { PRIORITIES, STATUSES } from './constants';
import { fmtDate, fmtDue, isOD } from './helpers';
import type { FirmSettings, Member, Project, StatusId } from './types';

/* A member's open tasks as a PDF (List / Kanban → Export PDF), built in the browser with pdfmake and downloaded. */

/** Statuses that count as work on a member's plate, in board order. */
export const EXPORTED_STATUSES: StatusId[] = ['intake', 'inprogress', 'backlog', 'review'];

/** Fonts in public/fonts (Noto Sans: Latin + Cyrillic; Noto Sans Armenian for Armenian text). pdfmake fetches them on first use. */
export const pdfFonts = (origin: string) => ({
  Noto: { normal: `${origin}/fonts/NotoSans-Regular.ttf`, bold: `${origin}/fonts/NotoSans-Bold.ttf`, italics: `${origin}/fonts/NotoSans-Regular.ttf`, bolditalics: `${origin}/fonts/NotoSans-Bold.ttf` },
  NotoArmenian: { normal: `${origin}/fonts/NotoSansArmenian-Regular.ttf`, bold: `${origin}/fonts/NotoSansArmenian-Bold.ttf`, italics: `${origin}/fonts/NotoSansArmenian-Regular.ttf`, bolditalics: `${origin}/fonts/NotoSansArmenian-Bold.ttf` },
});

const C = { text: '#0F172A', muted: '#64748B', faint: '#94A3B8', line: '#E2E8F0', rowLine: '#F1F5F9', panel: '#F8FAFC', overdue: '#DC2626' };

/** A PDF font draws only its own letters, so Armenian runs switch to the Armenian font. */
const ARMENIAN = /([԰-֏ﬓ-ﬗ]+)/;
const t = (s: string) => s.split(ARMENIAN).filter(Boolean).map(part => (ARMENIAN.test(part) ? { text: part, font: 'NotoArmenian' } : part));

export function tasksFileName(member: Member) {
  return `tasks-${member.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
}

/** `tasks` are already filtered to EXPORTED_STATUSES and sorted. `logoUrl` must be absolute (pdfmake fetches images listed in `images`). */
export function tasksPdf(member: Member, tasks: Project[], team: Member[], firm: FirmSettings, logoUrl: string): TDocumentDefinitions {
  const name = (id: string) => team.find(m => m.id === id)?.name ?? '';
  const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const th = (label: string, right = false): TableCell =>
    ({ text: label.toUpperCase(), style: 'th', alignment: right ? 'right' : 'left' });

  const row = (p: Project): TableCell[] => {
    const pr = PRIORITIES.find(x => x.id === p.priority);
    const others = p.assignees.filter(a => a !== member.id).map(name).filter(Boolean);
    const people: Content[] = [
      ...(others.length ? [{ text: [{ text: 'With ', color: C.faint }, ...t(others.join(', '))] }] : []),
      ...(p.supervisor ? [{ text: [{ text: 'Supervisor ', color: C.faint }, ...t(name(p.supervisor))] }] : []),
    ];
    const od = isOD(p);
    return [
      { stack: [{ text: t(p.title), bold: true }, ...(p.notes.trim() ? [{ text: t(p.notes.trim()), style: 'notes' }] : [])] },
      { text: t(p.client) },
      { text: t([p.matterType, p.area].filter(Boolean).join(' · ')) },
      pr ? { text: pr.label, bold: true, color: pr.col } : '',
      { text: `${p.progress}%`, alignment: 'right' },
      people.length ? { stack: people, fontSize: 8.5 } : { text: '—', color: C.faint },
      { stack: [
        p.due ? { text: fmtDue(p) + (od ? ' · overdue' : ''), bold: true, color: od ? C.overdue : C.text } : { text: 'No due date', color: C.faint, fontSize: 8 },
        { text: `Created ${fmtDate(p.created)}`, color: C.faint, fontSize: 8 },
      ] },
    ];
  };

  const sections: Content[] = STATUSES.filter(s => EXPORTED_STATUSES.includes(s.id)).flatMap(s => {
    const list = tasks.filter(p => p.status === s.id);
    if (!list.length) return [];
    return [
      {
        columns: [
          { canvas: [{ type: 'ellipse', x: 4, y: 7, r1: 3.5, r2: 3.5, color: s.col }], width: 12 },
          { text: [{ text: s.label, bold: true, fontSize: 11 }, { text: `   ${list.length}`, color: C.faint, fontSize: 9 }], width: '*' },
        ],
        margin: [0, 16, 0, 6],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['29%', '13%', '15%', '7%', '8%', '14%', '14%'],
          body: [
            [th('Task'), th('Client'), th('Type · Area'), th('Priority'), th('Progress', true), th('Team'), th('Due')],
            ...list.map(row),
          ],
        },
        layout: {
          fillColor: i => (i === 0 ? C.panel : null),
          hLineWidth: i => (i === 0 ? 0 : 0.6),
          hLineColor: i => (i === 1 ? C.line : C.rowLine),
          vLineWidth: () => 0,
          paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 6, paddingBottom: () => 6,
        },
      },
    ];
  });

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [34, 34, 34, 40],
    images: { logo: logoUrl },
    info: { title: `Open tasks — ${member.name} — ${asOf}`, author: firm.name },
    defaultStyle: { font: 'Noto', fontSize: 9, lineHeight: 1.2, color: C.text },
    styles: {
      th: { fontSize: 7, bold: true, color: C.faint, characterSpacing: 0.6 },
      notes: { fontSize: 8, color: C.muted, margin: [0, 2, 0, 0] },
    },
    footer: (page, pages) => ({
      columns: [
        { text: t(`${firm.name} · Open tasks · ${member.name}`), color: C.faint, fontSize: 7.5 },
        { text: `Page ${page} of ${pages}`, alignment: 'right', color: C.faint, fontSize: 7.5 },
      ],
      margin: [34, 12, 34, 0],
    }),
    content: [
      {
        table: {
          widths: ['*'],
          body: [[{
            columns: [
              { image: 'logo', fit: [26, 26], width: 26 },
              { text: t(firm.name), bold: true, fontSize: 14, margin: [8, 4, 0, 0], width: '*' },
              { stack: [
                { text: 'OPEN TASKS', fontSize: 7, bold: true, color: C.faint, characterSpacing: 1.2 },
                { text: t(member.name), fontSize: 13, bold: true, margin: [0, 2, 0, 2] },
                { text: `As of ${asOf} · ${tasks.length} task${tasks.length === 1 ? '' : 's'}`, color: C.muted },
              ], alignment: 'right', width: 'auto' },
            ],
            margin: [8, 6, 8, 6],
          }]],
        },
        layout: { fillColor: () => C.panel, hLineColor: () => C.line, vLineColor: () => C.line, hLineWidth: () => 0.6, vLineWidth: () => 0.6 },
      },
      ...sections,
    ],
  };
}
