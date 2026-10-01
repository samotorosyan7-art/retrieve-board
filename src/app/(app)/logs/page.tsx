'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/store';
import { Av, PageHeader } from '@/components/ui';
import { canSeeMatter, fmtDate, homePath, today } from '@/lib/helpers';
import type { Project, TimeLog } from '@/lib/types';
import { LockIcon, XIcon } from 'lucide-react';

type Row = TimeLog & { p: Project; key: string };
type Filters = { from: string; to: string; who: string; client: string; q: string };
const EMPTY: Filters = { from: '', to: '', who: '', client: '', q: '' };

const iso = (d: Date) => d.toISOString().split('T')[0];
const PRESETS: [string, () => Partial<Filters>][] = [
  ['Today', () => ({ from: today(), to: today() })],
  ['Last 7 days', () => ({ from: iso(new Date(Date.now() - 6 * 86_400_000)), to: today() })],
  ['This month', () => { const d = new Date(); return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), to: today() }; }],
  ['All time', () => ({ from: '', to: '' })],
];

/** Open the native calendar on a click anywhere in the field, not just on the small icon. */
const openPicker = (e: React.MouseEvent<HTMLInputElement>) => {
  try { e.currentTarget.showPicker(); } catch {}
};

export default function LogsPage() {
  const { projects, team, emp, currentUser, openPanel, search, toast } = useStore();
  const router = useRouter();
  const [f, setF] = useState<Filters>(EMPTY);

  useEffect(() => {
    if (!currentUser?.isAdmin) {
      toast(LockIcon, 'Access denied', 'Time logs are admin-only.');
      router.replace(homePath(currentUser));
    }
  }, [currentUser, router, toast]);
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(x => ({ ...x, [k]: e.target.value }));

  const visible = projects.filter(p => canSeeMatter(p, currentUser));
  const all: Row[] = visible.flatMap(p => (p.timeLogs || []).map((l, i) => ({ ...l, p, key: `${p.id}:${i}` })));
  const q = (f.q || search).toLowerCase();
  const rows = all
    .filter(r =>
      (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to)
      && (!f.who || r.who === f.who) && (!f.client || r.p.client === f.client)
      && (!q || r.desc.toLowerCase().includes(q) || r.p.title.toLowerCase().includes(q) || r.p.client.toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || a.p.title.localeCompare(b.p.title));

  const hours = (list: Row[]) => Math.round(list.reduce((s, r) => s + r.hours, 0) * 10) / 10;
  const total = hours(rows);
  const byMember = team
    .map(e => ({ e, h: hours(rows.filter(r => r.who === e.id)) }))
    .filter(x => x.h > 0)
    .sort((a, b) => b.h - a.h);
  const clientNames = [...new Set(visible.map(p => p.client).filter(Boolean))].sort();

  if (!currentUser?.isAdmin) return null;

  return (
    <div className="page active" id="page-logs">
      <PageHeader title="Time" light="Logs" sub={`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · ${total}h logged`} />

      <div className="filter-row">
        <div className="seg-ctrl">
          {PRESETS.map(([label, range]) => {
            const r = range();
            const on = f.from === (r.from ?? '') && f.to === (r.to ?? '');
            return <button key={label} className={`seg-btn${on ? ' active' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setF(x => ({ ...x, ...r }))}>{label}</button>;
          })}
        </div>
        <div className="logs-range">
          <input className="sel" type="date" value={f.from} max={f.to || undefined} onChange={set('from')} onClick={openPicker} aria-label="From date" />
          <span>→</span>
          <input className="sel" type="date" value={f.to} min={f.from || undefined} onChange={set('to')} onClick={openPicker} aria-label="To date" />
        </div>
        <select className="sel" value={f.who} onChange={set('who')}>
          <option value="">All members</option>
          {team.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select className="sel" value={f.client} onChange={set('client')}>
          <option value="">All clients</option>
          {clientNames.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="sel" placeholder="Search task or description…" value={f.q} onChange={set('q')} style={{ width: 220, cursor: 'text' }} />
        <button className="btn-ghost" onClick={() => setF(EMPTY)} style={{ fontSize: 12, padding: '6px 12px' }}><XIcon size={12} /> Clear</button>
      </div>

      {byMember.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, flexShrink: 0 }}>
          {byMember.map(({ e, h }) => (
            <button
              key={e.id} className={`seg-btn${f.who === e.id ? ' active' : ''}`}
              onClick={() => setF(x => ({ ...x, who: x.who === e.id ? '' : e.id }))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-full)', padding: '3px 10px 3px 3px' }}
            >
              <Av e={e} size={20} /> {e.name.split(' ')[0]} <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{h}h</span>
            </button>
          ))}
        </div>
      )}

      <div className="data-table-wrap">
        {rows.length === 0 ? (
          <div className="dt-empty">{all.length ? 'No time entries match your filters.' : 'No time has been logged yet.'}</div>
        ) : (
          <table className="data-table">
            <colgroup>
              {[11, 16, 33, 25, 15].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
            </colgroup>
            <thead>
              <tr><th>Date</th><th>Member</th><th>Description</th><th>Task</th><th style={{ textAlign: 'right' }}>Hours</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const e = emp(r.who);
                return (
                  <tr key={r.key} onClick={() => openPanel(r.p.id)}>
                    <td style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{fmtDate(r.date)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                        <Av e={e} size={22} />{e?.name || r.who}
                      </div>
                    </td>
                    <td><div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.desc}</div></td>
                    <td>
                      <div className="dt-title">{r.p.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.p.client}</div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.hours}h</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>Total</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{total}h</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
