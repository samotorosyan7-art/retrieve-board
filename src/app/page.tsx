'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sha256hex } from '@/lib/auth';
import { LOGO_SRC } from '@/lib/constants';
import { useStore } from '@/components/store';

const FEATURES: [string, string][] = [
  ['⊞', 'Kanban + list view for all active matters'],
  ['👥', 'Live team workload & utilisation tracking'],
  ['⏱', 'Time logging with one-click entry on any matter'],
  ['₾', 'Monthly billing reports with RA VAT — send direct to client'],
  ['📅', 'Deadline calendar view across all matters'],
  ['🔒', 'Role-based access — billing admin-only'],
];

export default function LandingPage() {
  const { hydrated, currentUser, creds, login, isDark, toggleTheme } = useStore();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockLeft, setLockLeft] = useState(0);
  const passRef = useRef<HTMLInputElement>(null);
  // Brute-force state (in-memory only, resets on page refresh)
  const fails = useRef(0);
  const lockDuration = useRef(30);

  useEffect(() => {
    if (hydrated && currentUser) router.replace('/dashboard');
  }, [hydrated, currentUser, router]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setTimeout(() => setLockLeft(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [lockLeft]);

  const locked = lockLeft > 0;

  async function attemptLogin() {
    if (locked) return;
    const emailRaw = email.trim().toLowerCase();
    if (!emailRaw || !pass) { setError('Please enter your email and password.'); return; }

    setBusy(true);
    const [eHash, pHash] = await Promise.all([sha256hex(emailRaw), sha256hex(pass)]);
    const role = Object.entries(creds).find(([, c]) => c.emailHash === eHash && c.passHash === pHash)?.[0];
    setBusy(false);

    if (!role) {
      fails.current++;
      // Deliberate small delay to slow automated attacks
      await new Promise(r => setTimeout(r, 600));
      if (fails.current >= 5) {
        setError('');
        setLockLeft(lockDuration.current);
        lockDuration.current = Math.min(lockDuration.current * 2, 600); // max 10 min
        fails.current = 0;
      } else {
        const left = 5 - fails.current;
        setError(`Incorrect email or password. ${left} attempt${left === 1 ? '' : 's'} remaining.`);
      }
      setPass('');
      passRef.current?.focus();
      return;
    }

    fails.current = 0;
    setError('');
    if (login(role)) router.push('/dashboard');
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

          {error && !locked && <div className="login-error">{error}</div>}
          {locked && (
            <div className="login-locked">
              🔒 Too many failed attempts.<br />Account locked for <span>{lockLeft}</span>s.
            </div>
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

          <button className="btn-primary" disabled={busy || locked} onClick={attemptLogin}>
            {busy ? 'Signing in…' : 'Sign In →'}
          </button>
          <div className="lc-note" style={{ marginTop: 12 }}>
            Use your <strong>@retrieve.am</strong> email and your assigned password.<br />
            Contact Feliks for access issues.
          </div>
        </div>
      </div>
    </div>
  );
}
