'use client';

import type { CSSProperties } from 'react';
import type { Member } from '@/lib/types';
import { useStore } from './store';

/** <img> that hides itself if it fails to load (and renders nothing for an empty src). */
export function Photo({ src, style }: { src?: string; style?: CSSProperties }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={e => { e.currentTarget.style.display = 'none'; }}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }}
    />
  );
}

export function Av({ e, size = 24, ml = 0 }: { e?: Member; size?: number; ml?: number }) {
  if (!e) return null;
  return (
    <div className="av" style={{ width: size, height: size, background: e.color, marginLeft: ml }} title={e.name}>
      <Photo src={e.img} />
    </div>
  );
}

export function AvStack({ ids, size = 22 }: { ids: string[]; size?: number }) {
  const { emp } = useStore();
  return (
    <div className="av-stack">
      {ids.map((id, i) => <Av key={id} e={emp(id)} size={size} ml={i > 0 ? -7 : 0} />)}
    </div>
  );
}

export function Tag({ col, bg, label }: { col: string; bg: string; label: string }) {
  return <span className="tag" style={{ background: bg, color: col }}>{label}</span>;
}

export function PageHeader({ title, light, sub, children }: { title: string; light: string; sub: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-hdr">
      <div className="page-hdr-left">
        <div className="page-title">{title} <span style={{ fontWeight: 300, color: 'var(--text-secondary)' }}>{light}</span></div>
        <div className="page-sub">{sub}</div>
      </div>
      {children && <div className="page-hdr-right">{children}</div>}
    </div>
  );
}

export const cardTitle: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' };
export const muted: CSSProperties = { fontSize: 12, color: 'var(--text-tertiary)' };
