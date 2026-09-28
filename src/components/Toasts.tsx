'use client';

import { useStore } from './store';

export function Toasts() {
  const { toasts, sync } = useStore();
  return (
    <>
      {sync !== 'hidden' && (
        <div
          className={`sync-dot ${sync}`}
          title={sync === 'syncing' ? 'Saving…' : sync === 'error' ? 'Sync error — changes saved locally' : 'All changes saved'}
        >
          {sync === 'syncing' ? '🔄' : sync === 'error' ? '⚠️' : '✅'}
        </div>
      )}
      <div className="toast-stack">
        {toasts.map(t => (
          <div
            key={t.id}
            className="toast"
            style={t.leaving ? { opacity: 0, transform: 'translateX(16px)', transition: 'all 0.3s' } : undefined}
          >
            <div className="toast-icon">{t.icon}</div>
            <div>
              <div className="toast-title">{t.title}</div>
              <div className="toast-msg">{t.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
