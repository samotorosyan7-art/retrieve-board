'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOGO_SRC } from '@/lib/constants';
import { useStore } from '@/components/store';
import { ArrowRightIcon, ArrowUpRightIcon, CalendarIcon, CheckIcon, EyeIcon, EyeOffIcon, LockKeyholeIcon, MoonIcon, ReceiptIcon, ShieldCheckIcon, SquareKanbanIcon, SunIcon, TimerIcon, UsersIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const FEATURES: [LucideIcon, string][] = [
  [SquareKanbanIcon, 'Kanban + list view for all active tasks'],
  [UsersIcon, 'Live team workload & utilisation tracking'],
  [TimerIcon, 'Time logging with one-click entry on any task'],
  [ReceiptIcon, 'Monthly billing reports with RA VAT — send direct to client'],
  [CalendarIcon, 'Deadline calendar view across all tasks'],
  [ShieldCheckIcon, 'Role-based access — billing admin-only'],
];

export default function LandingPage() {
  const { authStatus, currentUser, passwordRecovery, login, logout, sendPasswordEmail, isDark, toggleTheme } = useStore();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // 'forgot' swaps the card to the reset-password form.
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Admins start on the dashboard; everyone else on their own tasks.
    // A reset link can land here (Supabase falls back to the Site URL): go set the new password first.
    if (passwordRecovery && authStatus !== 'signedOut') { router.replace('/reset-password'); return; }
    if (authStatus !== 'signedIn') return;
    // Back to the page that sent them here (only same-site paths), else their home page.
    const next = new URLSearchParams(location.search).get('next');
    router.replace(next && /^\/(?![/\\])/.test(next) ? next : currentUser?.isAdmin ? '/dashboard' : '/tasks');
  }, [authStatus, currentUser, passwordRecovery, router]);

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

  function switchMode(next: 'login' | 'forgot') {
    setMode(next); setError(''); setNotice(''); setPass('');
  }

  async function forgotPassword() {
    if (!email.trim()) { setError('Please enter your work email.'); return; }
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
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">{isDark ? <MoonIcon size={16} /> : <SunIcon size={16} />}</button>
          <a href="https://retrieve.am" target="_blank" rel="noreferrer" className="btn-ghost"><ArrowUpRightIcon size={14} /> retrieve.am</a>
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
            {FEATURES.map(([Icon, text]) => (
              <div className="land-feat" key={text}>
                <div className="land-feat-icon"><Icon size={16} /></div>
                <div className="land-feat-text">{text}</div>
                <div className="land-feat-check"><CheckIcon size={14} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="login-card">
          <div className="lc-eyebrow"><span className="lc-lock"><LockKeyholeIcon size={12} /></span> Secure Sign-in</div>
          <div className="lc-title">{mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</div>
          <div className="lc-sub">
            {mode === 'forgot'
              ? 'Enter your work email and we\u2019ll send you a link to set a new password.'
              : 'Retrieve Legal & Tax · Internal Platform'}
          </div>

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

          {mode === 'forgot' ? (
            <>
              <label className="lc-label">Work email</label>
              <input
                className="lc-input" type="email" placeholder="you@retrieve.am" autoComplete="username" autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') forgotPassword(); }}
              />
              <button className="btn-primary" disabled={busy} onClick={forgotPassword}>
                {busy ? 'Please wait…' : <>Send reset link <ArrowRightIcon size={14} /></>}
              </button>
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <a href="#" onClick={e => { e.preventDefault(); switchMode('login'); }} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                  Back to sign in
                </a>
              </div>
            </>
          ) : (
            <>
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
                  {showPass ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>

              <button className="btn-primary" disabled={busy || authStatus === 'loading'} onClick={attemptLogin}>
                {busy ? 'Please wait…' : <>Sign In <ArrowRightIcon size={14} /></>}
              </button>
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <a href="#" onClick={e => { e.preventDefault(); switchMode('forgot'); }} style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                  Forgot password?
                </a>
              </div>
            </>
          )}
          <div className="lc-note" style={{ marginTop: 12 }}>
            Use your <strong>@retrieve.am</strong> email. First time here? Use the link in your invitation email.<br />
            Contact Feliks for access issues.
          </div>
        </div>
      </div>
    </div>
  );
}
