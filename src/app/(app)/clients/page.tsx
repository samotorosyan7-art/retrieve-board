'use client';

import { useState } from 'react';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { PageHeader, Tag } from '@/components/ui';
import { clientColor, clientInitials, firstWords, fmtShort, pri, stat } from '@/lib/helpers';
import type { Client, StatusId } from '@/lib/types';

const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)' };

export default function ClientsPage() {
  const { clients, projects, setModal } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = search.toLowerCase();
  const filtered = clients.filter(c => {
    if (q && !c.name.toLowerCase().includes(q) && !c.contact.toLowerCase().includes(q)) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    return true;
  });
  const sel = clients.find(c => c.id === selectedId) ?? clients[0];
  const types = [...new Set(clients.map(c => c.type))].sort();
  const addClient = () => setModal({ kind: 'client', id: null, onSaved: setSelectedId });

  return (
    <div className="page active" id="page-clients">
      <PageHeader title="Clients" light="& Contacts" sub={`${clients.length} client${clients.length !== 1 ? 's' : ''} · ${clients.filter(c => c.active).length} active`}>
        <button className="btn-solid" onClick={addClient}>＋ Add Client</button>
      </PageHeader>

      <div className="clients-layout">
        {/* LEFT: Client list */}
        <div className="client-list-panel">
          <div className="clp-header">
            <span className="clp-title">All Clients</span>
            <span className="clp-count">{filtered.length}</span>
          </div>
          <div className="clp-search">
            <input placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="clp-filter">
            {['', ...types].map(t => (
              <button key={t || 'all'} className={`seg-btn${typeFilter === t ? ' active' : ''}`} onClick={() => setTypeFilter(t)} style={{ fontSize: 11, padding: '4px 10px' }}>
                {t || 'All'}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No clients found</div>
            ) : filtered.map(c => {
              const n = projects.filter(p => p.client === c.name).length;
              return (
                <div key={c.id} className={`client-row${c.id === sel?.id ? ' active' : ''}`} onClick={() => setSelectedId(c.id)}>
                  <div className="cr-avatar" style={{ background: clientColor(c.name) }}>{clientInitials(c.name)}</div>
                  <div className="cr-info">
                    <div className="cr-name">{c.name}</div>
                    <div className="cr-meta">{c.contact} · {n} matter{n !== 1 ? 's' : ''}</div>
                  </div>
                  <span className="cr-badge" style={{ background: c.active ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.12)', color: c.active ? '#34D399' : '#94A3B8' }}>
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Client detail */}
        <div>
          {sel ? (
            <ClientDetail key={sel.id} c={sel} onDeleted={() => setSelectedId(null)} />
          ) : (
            <div className="client-detail-card">
              <div className="empty-clients">
                <div className="ec-icon">🏢</div>
                <div className="ec-txt">Select a client</div>
                <div className="ec-sub">Choose a client from the list, or add your first one.</div>
                <button className="btn-solid" style={{ marginTop: 16 }} onClick={addClient}>＋ Add First Client</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientDetail({ c, onDeleted }: { c: Client; onDeleted: () => void }) {
  const { projects, emp, setModal, deleteClient } = useStore();
  const { openMatter } = useNav();
  const [areaFilter, setAreaFilter] = useState('all');

  const all = projects.filter(p => p.client === c.name);
  const areaMap: Record<string, typeof all> = {};
  all.forEach(p => { (areaMap[p.area || 'Other'] ||= []).push(p); });
  const areas = Object.keys(areaMap).sort();
  const sc: Record<StatusId, number> = { intake: 0, inprogress: 0, backlog: 0, review: 0, done: 0, billing: 0, archive: 0 };
  all.forEach(p => { if (sc[p.status] !== undefined) sc[p.status]++; });
  const shown = areaFilter === 'all' ? all : areaMap[areaFilter] || [];

  const fields: [string, React.ReactNode][] = [
    ['Contact', c.contact],
    ['Email', c.email && <a href={`mailto:${c.email}`} style={{ color: 'var(--gold)' }}>{c.email}</a>],
    ['Phone', c.phone && <a href={`tel:${c.phone}`} style={{ color: 'var(--gold)' }}>{c.phone}</a>],
    ['Address', c.address],
    ['TIN', c.taxId && <span style={{ fontFamily: 'var(--font-mono)' }}>{c.taxId}</span>],
    ['Notes', c.notes],
  ];

  return (
    <div className="client-detail-card" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="cd-name" style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>{c.name}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="cd-type-badge">{c.type || 'Client'}</div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{all.length} matter{all.length !== 1 ? 's' : ''}</span>
      </div>

      {fields.filter(([, v]) => v).map(([label, v]) => (
        <div key={label} className="cd-field"><span className="cd-label">{label}</span>{typeof v === 'string' ? <span>{v}</span> : v}</div>
      ))}

      {all.length > 0 ? (
        <>
          <div style={{ margin: '14px 0 10px', padding: '10px 14px', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-md)' }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>Matter Overview</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {Object.entries(sc).filter(([, n]) => n > 0).map(([s, n]) => {
                const st = stat(s);
                return (
                  <div key={s} style={{ fontSize: 10.5, padding: '3px 10px', borderRadius: 'var(--r-full)', background: st.bg, color: st.col, fontWeight: 600, border: `1px solid ${st.col}33` }}>
                    {st.label} <strong>{n}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...labelStyle, marginBottom: 6 }}>Filter by Practice Area</div>
          <div className="cd-area-tabs" style={{ marginBottom: 10 }}>
            <button className={`cd-area-tab${areaFilter === 'all' ? ' active' : ''}`} onClick={() => setAreaFilter('all')}>
              All <span style={{ opacity: 0.65 }}>({all.length})</span>
            </button>
            {areas.map(a => (
              <button key={a} className={`cd-area-tab${areaFilter === a ? ' active' : ''}`} onClick={() => setAreaFilter(a)}>
                {firstWords(a, 2)} <span style={{ opacity: 0.65 }}>({areaMap[a].length})</span>
              </button>
            ))}
          </div>

          <div style={{ ...labelStyle, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Matters</span><span style={{ fontWeight: 400 }}>{shown.length} shown</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {shown.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '20px 0', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--r-md)' }}>
                No matters in this practice area.
              </div>
            ) : shown.map(p => {
              const st = stat(p.status), pr = pri(p.priority);
              const hrs = (p.timeLogs || []).reduce((sum, l) => sum + l.hours, 0);
              const assigneeStr = p.assignees.map(id => emp(id)?.name.split(' ')[0] ?? id).join(', ');
              return (
                <div
                  key={p.id}
                  onClick={() => openMatter(p.id)}
                  style={{ padding: '10px 12px', background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${st.col}`, borderRadius: 'var(--r-md)', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10, transition: 'all 120ms ease' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                    <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{p.area}</span>
                      {assigneeStr && <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>· {assigneeStr}</span>}
                      {hrs > 0 && <span style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{hrs}h</span>}
                    </div>
                    {p.progress > 0 && (
                      <div style={{ marginTop: 6, height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                        <div style={{ width: `${p.progress}%`, height: '100%', background: 'var(--gold)', borderRadius: 2 }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <Tag {...st} />
                    <Tag {...pr} />
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{fmtShort(p.due)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No matters on record yet.</div>
      )}

      <div className="cd-actions" style={{ paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
        <button className="btn-solid" style={{ flex: 1 }} onClick={() => setModal({ kind: 'matter', client: c.name })}>＋ New Matter</button>
        <button className="btn-outline" onClick={() => setModal({ kind: 'client', id: c.id })}>Edit</button>
        <button className="btn-outline danger" onClick={() => deleteClient(c.id, onDeleted)}>Delete</button>
      </div>
    </div>
  );
}
