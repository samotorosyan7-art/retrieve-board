'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/components/store';
import { Av, AvStack, PageHeader, Tag } from '@/components/ui';
import { loadCompletions } from '@/lib/db';
import { canSeeMatter, parseDate, stat, today } from '@/lib/helpers';
import type { StatusChange } from '@/lib/types';
import { XIcon } from 'lucide-react';

type Filters = { from: string; to: string; who: string };

const iso = (d: Date) => d.toISOString().split('T')[0];
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)); };
const PRESETS: [string, () => Pick<Filters, 'from' | 'to'>][] = [
  ['Today', () => ({ from: today(), to: today() })],
  ['Last 7 days', () => ({ from: iso(new Date(Date.now() - 6 * 86_400_000)), to: today() })],
  ['This month', () => ({ from: monthStart(), to: today() })],
  ['All time', () => ({ from: '', to: '' })],
];

const fmtWhen = (t: string) =>
  new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Tasks moved to Completed in a date range, per member (task_status_changes, migration 019).
 *  Members see their own; admins see anyone's. */
export default function ReportPage() {
  const { projects, team, emp, currentUser, openPanel, search } = useStore();
  const isAdmin = !!currentUser?.isAdmin;
  const [f, setF] = useState<Filters>(() => ({ from: monthStart(), to: today(), who: '' }));
  const [changes, setChanges] = useState<StatusChange[] | null>(null);
  const [failed, setFailed] = useState(false);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  // Re-read when the range changes, and when a task is completed or reopened anywhere.
  const doneKey = projects.filter(p => p.status === 'done').map(p => p.id).join();
  useEffect(() => {
    let live = true;
    const end = parseDate(f.to);
    end?.setDate(end.getDate() + 1); // the "to" day is included
    loadCompletions(parseDate(f.from), end)
      .then(list => { if (live) { setChanges(list); setFailed(false); } })
      .catch(e => { console.warn('Report unavailable (has migration 019 been run?)', e); if (live) setFailed(true); });
    return () => { live = false; };
  }, [f.from, f.to, doneKey]);

  const who = isAdmin ? f.who : currentUser?.id ?? '';
  const q = search.toLowerCase();
  const byId = new Map(projects.filter(p => canSeeMatter(p, currentUser, team)).map(p => [p.id, p]));
  const inRange = (changes || []).flatMap(c => {
    const p = byId.get(c.projectId);
    return p ? [{ ...c, p }] : [];
  });
  const rows = inRange.filter(r =>
    (!who || r.p.assignees.includes(who))
    && (!q || r.p.title.toLowerCase().includes(q) || r.p.client.toLowerCase().includes(q)));
  const byMember = isAdmin
    ? team.map(e => ({ e, n: inRange.filter(r => r.p.assignees.includes(e.id)).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n)
    : [];
  const member = emp(who);

  return (
    <div className="page active" id="page-report">
      <PageHeader
        title="Completion" light="Report"
        sub={`${rows.length} task${rows.length !== 1 ? 's' : ''} moved to Completed${member ? ` · ${member.name}` : ''}`}
      />

      <div className="filter-row">
        <div className="seg-ctrl">
          {PRESETS.map(([label, range]) => {
            const r = range();
            const on = f.from === r.from && f.to === r.to;
            return <button key={label} className={`seg-btn${on ? ' active' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setF(x => ({ ...x, ...r }))}>{label}</button>;
          })}
        </div>
        <div className="logs-range">
          <input className="sel" type="date" value={f.from} max={f.to || undefined} onChange={set('from')} aria-label="From date" />
          <span>→</span>
          <input className="sel" type="date" value={f.to} min={f.from || undefined} onChange={set('to')} aria-label="To date" />
        </div>
        {isAdmin ? (
          <select className="sel" value={f.who} onChange={set('who')} aria-label="Member">
            <option value="">All members</option>
            {team.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        ) : (
          <select className="sel" value={who} disabled aria-label="Member"><option value={who}>{currentUser?.name}</option></select>
        )}
        <button className="btn-ghost" onClick={() => setF(x => ({ ...x, from: monthStart(), to: today(), who: '' }))} style={{ fontSize: 12, padding: '6px 12px' }}><XIcon size={12} /> Reset</button>
      </div>

      {byMember.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, flexShrink: 0 }}>
          {byMember.map(({ e, n }) => (
            <button
              key={e.id} className={`seg-btn${f.who === e.id ? ' active' : ''}`}
              onClick={() => setF(x => ({ ...x, who: x.who === e.id ? '' : e.id }))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-full)', padding: '3px 10px 3px 3px' }}
            >
              <Av e={e} size={20} /> {e.name.split(' ')[0]} <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="data-table-wrap">
        {failed ? (
          <div className="dt-empty">The report could not be loaded. Please try again later.</div>
        ) : !changes ? (
          <div className="dt-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="dt-empty">No tasks were moved to Completed in this period.</div>
        ) : (
          <table className="data-table">
            <colgroup>
              {[17, 31, 18, 16, 18].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr><th>Completed on</th><th>Task</th><th>Assignees</th><th>Moved by</th><th>Status now</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const by = r.who ? emp(r.who) : undefined;
                return (
                  <tr key={r.id} onClick={() => openPanel(r.p.id)}>
                    <td style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{fmtWhen(r.time)}</td>
                    <td>
                      <div className="dt-title">{r.p.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.p.client}</div>
                    </td>
                    <td><AvStack ids={r.p.assignees} size={22} withInitials /></td>
                    <td>
                      {by ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}><Av e={by} size={22} />{by.name}</div>
                        : <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td><Tag {...stat(r.p.status)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
