'use client';

import { useEffect } from 'react';
import { useStore } from '../store';
import { XIcon } from 'lucide-react';

/** In-app replacement for window.confirm(), which embedded/preview browsers often block silently. */
export function ConfirmDialog() {
  const { confirmState: c, setConfirmState } = useStore();
  const close = () => setConfirmState(null);

  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmState(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [c, setConfirmState]);

  return (
    <div className={`modal-backdrop${c ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        {c && (
          <>
            <div className="modal-hdr">
              <div><div className="modal-title">{c.title}</div></div>
              <button className="dp-close" onClick={close}><XIcon size={14} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{c.msg}</div>
              <div className="modal-foot">
                <button className="btn-cancel" onClick={close}>Cancel</button>
                <button
                  className="btn-submit" autoFocus
                  style={{ background: 'var(--p-high)', color: '#fff' }}
                  onClick={() => { close(); c.onConfirm(); }}
                >
                  {c.confirmLabel || 'Delete'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
