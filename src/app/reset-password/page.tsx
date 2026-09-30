'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_SRC } from '@/lib/constants';
import { getSupabase } from '@/lib/supabase';
import { useStore } from '@/components/store';
import { ArrowRightIcon } from 'lucide-react';

const MIN_LENGTH = 8;

/** Landing page for invitation and password-reset emails; also used to change your password while signed in. */
export default function ResetPasswordPage() {
  const { authStatus, currentUser, setPasswordRecovery } = useStore();
  const router = useRouter();
  const [linkError, setLinkError] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Our emails link here with ?token_hash=…&type=recovery|invite; confirming it signs the member in.
  const [verifying, setVerifying] = useState(true);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(location.search);
    const token_hash = q.get('token_hash'), type = q.get('type');
    // Supabase's own links put problems in the hash, e.g. #error_description=Email+link+is+invalid+or+has+expired
    const desc = new URLSearchParams(location.hash.slice(1)).get('error_description');
    if (desc) setLinkError(desc.replace(/\+/g, ' '));
    if (!token_hash || (type !== 'recovery' && type !== 'invite')) { setVerifying(false); return; }
    // The token works once: drop it from the address bar (and history) before using it.
    history.replaceState(null, '', location.pathname);
    getSupabase()!.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) setLinkError(error.message);
      else setPasswordRecovery(true);
      setVerifying(false);
    });
  }, [setPasswordRecovery]);

  const signedIn = !linkError && (authStatus === 'signedIn' || authStatus === 'noAccess');

  async function submit() {
    if (pass.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return; }
    if (pass !== pass2) { setError('The two passwords don’t match.'); return; }
    setBusy(true); setError('');
    const { error } = await getSupabase()!.auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setPasswordRecovery(false);
    setTimeout(() => router.replace(currentUser?.isAdmin ? '/dashboard' : '/tasks'), 1200);
  }

  return (
    <div id="screen-landing" className="screen active">
      <div className="land-grid" />
      <div className="land-glow" />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', zIndex: 1 }}>
        <div className="login-card" style={{ width: '100%', maxWidth: 400 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="Retrieve" style={{ height: 40, marginBottom: 16 }} className="land-logo-img" />
          <div className="lc-title">Set your password</div>
          <div className="lc-sub">Retrieve Legal &amp; Tax · Internal Platform</div>

          {verifying || authStatus === 'loading' ? (
            <div className="lc-note">Checking your link…</div>
          ) : !signedIn ? (
            <>
              <div className="login-error">{linkError || 'This link is invalid or has expired.'}</div>
              <div className="lc-note">Go back to sign-in and use “Forgot password?” to get a fresh link.</div>
              <button className="btn-primary" style={{ marginTop: 14 }} onClick={() => router.replace('/')}>Back to sign-in</button>
            </>
          ) : done ? (
            <div className="login-error" style={{ background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)', color: '#34D399' }}>
              Password saved. Taking you in…
            </div>
          ) : (
            <>
              {error && <div className="login-error">{error}</div>}
              <label className="lc-label">New password</label>
              <input className="lc-input" type="password" autoComplete="new-password" value={pass} onChange={e => setPass(e.target.value)} autoFocus />
              <label className="lc-label">Repeat new password</label>
              <input
                className="lc-input" type="password" autoComplete="new-password" value={pass2} onChange={e => setPass2(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              />
              <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : <>Save password <ArrowRightIcon size={14} /></>}</button>
              <div className="lc-note" style={{ marginTop: 12 }}>At least {MIN_LENGTH} characters. Don’t reuse a password from another site.</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
