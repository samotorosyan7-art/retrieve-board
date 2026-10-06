'use client';

import { useState } from 'react';
import { useNav } from '@/components/nav';
import { useStore } from '@/components/store';
import { AvStack, PageHeader, Tag } from '@/components/ui';
import { canSeeMatter, clientColor, clientInitials, firstWords, fmtDate, fmtDue, isOpen, pri, stat } from '@/lib/helpers';
import type { Client } from '@/lib/types';
import { Building2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';

export default function ClientsPage() {
  const { clients, projects, team, currentUser, setModal } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const q = search.toLowerCase();
  const filtered = clients.filter(c => {
    if (q && !c.name.toLowerCase().includes(q) && !c.contact.toLowerCase().includes(q)) return false;
    if (typeFilter && c.type !== typeFilter) return false;
    return true;
  });
  const sel = clients.find(c => c.id === selectedId) ?? filtered[0];
  const types = [...new Set(clients.map(c => c.type))].sort();
  const addClient = () => setModal({ kind: 'client', id: null, onSaved: setSelectedId });

  return (
    <div className="page active" id="page-clients">
      <PageHeader title="Clients" light="& Contacts" sub={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}>
        <button className="btn-solid" onClick={addClient}><PlusIcon size={14} /> Add Client</button>
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
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No clients found</div>
            ) : filtered.map(c => {
              const n = projects.filter(p => p.client === c.name && canSeeMatter(p, currentUser, team)).length;
              return (
                <div key={c.id} className={`client-row${c.id === sel?.id ? ' active' : ''}`} onClick={() => setSelectedId(c.id)}>
                  <div className="cr-avatar" style={{ background: clientColor(c.name) }}>{clientInitials(c.name)}</div>
                  <div className="cr-info">
                    <div className="cr-name">{c.name}</div>
                    <div className="cr-meta">{c.contact} · {n} task{n !== 1 ? 's' : ''}</div>
                  </div>
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
                <div className="ec-icon"><Building2Icon size={36} /></div>
                <div className="ec-txt">Select a client</div>
                <div className="ec-sub">Choose a client from the list, or add your first one.</div>
                <button className="btn-solid" style={{ marginTop: 16 }} onClick={addClient}><PlusIcon size={14} /> Add First Client</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClientDetail({ c, onDeleted }: { c: Client; onDeleted: () => void }) {
  const { projects, team, currentUser, setModal, deleteClient } = useStore();
  const { openMatter } = useNav();
  const [areaFilter, setAreaFilter] = useState('all');

  const all = projects.filter(p => p.client === c.name && canSeeMatter(p, currentUser, team));
  const areaMap: Record<string, typeof all> = {};
  all.forEach(p => { (areaMap[p.area || 'Other'] ||= []).push(p); });
  const areas = Object.keys(areaMap).sort();
  const shown = areaFilter === 'all' ? all : areaMap[areaFilter] || [];
  const hours = all.reduce((sum, p) => sum + (p.timeLogs || []).reduce((h, l) => h + l.hours, 0), 0);
  const col = clientColor(c.name);

  const stats: [string, number | string][] = [
    ['Tasks', all.length],
    ['Open', all.filter(isOpen).length],
    ['Completed', all.filter(p => p.status === 'done').length],
    ['Hours logged', Math.round(hours * 10) / 10],
  ];
  const contact: [string, React.ReactNode][] = [
    ['Contact person', c.contact],
    ['Email', c.email && <a href={`mailto:${c.email}`}>{c.email}</a>],
    ['Phone', c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>],
    ['Tax ID / TIN', c.taxId && <span style={{ fontFamily: 'var(--font-mono)' }}>{c.taxId}</span>],
    ['Address', c.address],
    ['Client since', c.since ? fmtDate(c.since) : ''],
  ];

  return (
    <div className="client-detail-card">
      <div className="cdc-header">
        <div className="cdc-top">
          <div className="cdc-avatar" style={{ background: col }}>{clientInitials(c.name)}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="cdc-name">{c.name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="cdc-type" style={{ background: `${col}22`, color: col }}>{c.type || 'Client'}</span>
            </div>
          </div>
          <div className="cdc-actions">
            <button className="btn-solid" onClick={() => setModal({ kind: 'matter', client: c.name })}><PlusIcon size={14} /> New Task</button>
            <button className="btn-outline" onClick={() => setModal({ kind: 'client', id: c.id })}><PencilIcon size={14} /> Edit</button>
            <button className="btn-outline" style={{ color: 'var(--p-high)' }} onClick={() => deleteClient(c.id, onDeleted)} title="Delete client"><Trash2Icon size={14} /></button>
          </div>
        </div>
        <div className="cdc-stats">
          {stats.map(([label, val]) => (
            <div key={label} className="cdc-stat"><div className="cdc-stat-val">{val}</div><div className="cdc-stat-lbl">{label}</div></div>
          ))}
        </div>
      </div>

      <div className="cdc-body">
        <div>
          <div className="cdc-section-label">Contact details</div>
          <div className="contact-grid">
            {contact.map(([label, v]) => (
              <div key={label} className="contact-item">
                <div className="ci-label">{label}</div>
                <div className="ci-value">{v || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}</div>
              </div>
            ))}
          </div>
        </div>

        {c.notes && (
          <div>
            <div className="cdc-section-label">Notes</div>
            <div className="tc-notes" style={{ marginBottom: 0 }}>{c.notes}</div>
          </div>
        )}

        <div>
          <div className="cdc-section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Tasks</span>{all.length > 0 && <span style={{ fontWeight: 400 }}>{shown.length} shown</span>}
          </div>
          {all.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', padding: '24px 0', textAlign: 'center', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--r-lg)' }}>
              No tasks for this client yet.
            </div>
          ) : (
            <>
              {areas.length > 1 && (
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
              )}
              {shown.map(p => {
                const st = stat(p.status), pr = pri(p.priority);
                const hrs = (p.timeLogs || []).reduce((sum, l) => sum + l.hours, 0);
                return (
                  <div key={p.id} className="client-matter-row" style={{ borderLeft: `3px solid ${st.col}` }} onClick={() => openMatter(p.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cmr-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div className="cmr-area" style={{ marginTop: 2 }}>
                        {[p.matterType, firstWords(p.area, 3), hrs > 0 ? `${hrs}h` : ''].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {p.assignees.length > 0 && <AvStack ids={p.assignees} size={22} />}
                    <Tag {...pr} />
                    <Tag {...st} />
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', minWidth: 52, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDue(p, true)}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
