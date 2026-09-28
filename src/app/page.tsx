'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_SRC } from '@/lib/constants';
import { useStore } from '@/components/store';

const FEATURES: [string, string][] = [
  ['⊞', 'Kanban + list view for all active tasks'],
  ['👥', 'Live team workload & utilisation tracking'],
  ['⏱', 'Time logging with one-click entry on any task'],
  ['₾', 'Monthly billing reports with RA VAT — send direct to client'],
  ['📅', 'Deadline calendar view across all tasks'],
  ['🔒', 'Role-based access — billing admin-only'],
];

export default function LandingPage() {
  const { authStatus, currentUser, login, logout, sendPasswordEmail, isDark, toggleTheme } = useStore();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Admins start on the dashboard; everyone else on their own tasks.
    if (authStatus === 'signedIn') router.replace(currentUser?.isAdmin ? '/dashboard' : '/tasks');
  }, [authStatus, currentUser, router]);

  async function attemptLogin() {
    if (!email.trim() || !pass) { setError('Please enter your email and password.'); return; }
    setBusy(true); setError(''); setNotice('');
    const err = await login(email, pass);
    setBusy(false);
    if (err) {
      setError(err);
      setPass('');
      passRef.current?.focus();
    }
  }

  async function forgotPassword() {
    if (!email.trim()) { setError('Enter your work email above, then click "Forgot password?" again.'); return; }
    setBusy(true); setError(''); setNotice('');
    const err = await sendPasswordEmail(email);
    setBusy(false);
    if (err) setError(err);
    else setNotice(`If ${email.trim()} has an account, a link to set a new password is on its way.`);
  }

  return (
    <div id="screen-landing" className="screen active">
      <div className="land-noise" />
      <div className="land-grid" />
      <div className="land-glow" />

      <nav className="land-nav">
        <div className="land-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="land-logo-img" src={LOGO_SRC} alt="Retrieve Legal & Tax" />
        </div>
        <div className="land-nav-right">
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">{isDark ? '🌙' : '☀️'}</button>
          <a href="https://retrieve.am" target="_blank" rel="noreferrer" className="btn-ghost">↗ retrieve.am</a>
        </div>
      </nav>

      <div className="land-hero">
        <div className="land-hero-left">
          <div className="land-hero-logo-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="land-hero-logo" src={LOGO_SRC} alt="Retrieve Legal & Tax" />
          </div>
          <div className="land-pill">
            <div className="land-pill-dot" />
            <span>Internal Practice Management Platform</span>
          </div>
          <h1 className="land-h1">Run your firm.<br /><em>Not after it.</em></h1>
          <p className="land-sub">
            One place for every matter, every deadline, every invoice. Built around how Retrieve Legal &amp; Tax actually works.
          </p>
          <div className="land-features">
            {FEATURES.map(([icon, text]) => (
              <div className="land-feat" key={text}>
                <div className="land-feat-icon">{icon}</div>
                <div className="land-feat-text">{text}</div>
                <div className="land-feat-check">✓</div>
              </div>
            ))}
          </div>
        </div>

        <div className="login-card">
          <div className="lc-eyebrow"><span className="lc-lock">🔐</span> Secure Sign-in</div>
          <div className="lc-title">Welcome back</div>
          <div className="lc-sub">Retrieve Legal &amp; Tax · Internal Platform</div>

          {authStatus === 'noAccess' && (
            <div className="login-error">
              Signed in, but this account isn&apos;t on the Retrieve team list (or the database setup isn&apos;t finished). Ask an admin to add you.{' '}
              <a href="#" onClick={e => { e.preventDefault(); logout(); }} style={{ textDecoration: 'underline' }}>Sign out</a>
            </div>
          )}
          {error && <div className="login-error">{error}</div>}
          {notice && (
            <div className="login-error" style={{ background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)', color: '#34D399' }}>{notice}</div>
          )}

          <label className="lc-label">Work email</label>
          <input
            className="lc-input" type="email" placeholder="you@retrieve.am" autoComplete="username"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') passRef.current?.focus(); }}
          />

          <label className="lc-label">Password</label>
          <div className="lc-pass-wrap">
            <input
              ref={passRef} className="lc-input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
              autoComplete="current-password"
              value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') attemptLogin(); }}
            />
            <button className="lc-eye" type="button" onClick={() => setShowPass(s => !s)} title="Show/hide password">
              {showPass ? '🙈' : '👁'}
            </button>
          </div>

          <button className="btn-primary" disabled={busy || authStatus === 'loading'} onClick={attemptLogin}>
            {busy ? 'Please wait…' : 'Sign In →'}
          </button>
          <div style={{ textAlign: 'right', marginTop: 10 }}>
            <a href="#" onClick={e => { e.preventDefault(); forgotPassword(); }} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'underline' }}>
              Forgot password?
            </a>
          </div>
          <div className="lc-note" style={{ marginTop: 12 }}>
            Use your <strong>@retrieve.am</strong> email. First time here? Use the link in your invitation email.<br />
            Contact Feliks for access issues.
          </div>
        </div>
      </div>
    </div>
  );
}
