'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { ApiError } from '@/lib/apiClient';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-split">
      <div
        style={{
          background: 'var(--color-sidebar-bg)',
          color: 'var(--color-sidebar-text)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: 'var(--color-sidebar-active)',
                color: 'var(--color-accent-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-serif)',
                fontWeight: 600,
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              M
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent-gold)', fontSize: 19 }}>Mélange</div>
              <div style={{ fontSize: 10, letterSpacing: '0.12em', opacity: 0.75 }}>PATISSERIE &amp; BOULANGERIE</div>
            </div>
          </div>

          <span
            className="pill"
            style={{ background: 'var(--color-sidebar-active)', color: 'var(--color-accent-gold)', border: '1px solid var(--color-accent-gold)' }}
          >
            Operations platform
          </span>

          <h1 style={{ fontSize: 40, lineHeight: 1.15, marginTop: 20, color: '#fff' }}>
            Every cake.
            <br />
            Every batch.
            <br />
            <span style={{ color: 'var(--color-accent-gold)' }}>In flow.</span>
          </h1>

          <p style={{ fontSize: 14.5, lineHeight: 1.6, marginTop: 18, maxWidth: 420, opacity: 0.85 }}>
            The dedicated command center for orders, recipes, inventory, costing and growth — built
            around the way Mélange actually bakes.
          </p>

          <div style={{ display: 'flex', gap: 32, marginTop: 36 }}>
            {[
              ['132', 'ORDERS/MO'],
              ['104', 'ACTIVE RECIPES'],
              ['79%', 'GROSS MARGIN'],
            ].map(([value, label]) => (
              <div key={label}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#fff' }}>{value}</div>
                <div style={{ fontSize: 10, letterSpacing: '0.08em', opacity: 0.7, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, opacity: 0.6 }}>© {new Date().getFullYear()} Mélange Patisserie</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--color-bg-page)' }}>
        <form onSubmit={handleSubmit} style={{ width: 360, maxWidth: '100%' }}>
          <h1 style={{ fontSize: 26 }}>Welcome back</h1>
          <p style={{ margin: '4px 0 24px', fontSize: 13.5, color: 'var(--color-text-secondary)' }}>
            Sign in to your operations dashboard.
          </p>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Email or username</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={{ width: '100%', marginBottom: 16 }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Password</label>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Forgot password?</span>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: 20 }}
          />

          {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13, marginBottom: 16 }}>{error}</p>}

          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
