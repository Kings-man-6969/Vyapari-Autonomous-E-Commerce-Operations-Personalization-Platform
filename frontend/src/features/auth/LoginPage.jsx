import React, { useState } from 'react';
import Spinner from '@/shared/components/Spinner';

/* ─── DESIGN.MD — Authentication Login Page ───
   Canvas: #000000 / #0a0a0a · Hairlines: #1e2c31
   Buttons & Chips: pill-only · Typography: Inter ss03
──────────────────────────────────────────────── */

const DEMO_CREDS = [
  { label: 'Admin',    email: 'admin@vyapari.local',    password: 'admin123',    icon: '🛡️' },
  { label: 'Seller',   email: 'seller@vyapari.local',   password: 'seller123',   icon: '🏪' },
  { label: 'Customer', email: 'customer@vyapari.local', password: 'customer123', icon: '🛒' },
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [shake, setShake]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  function fillCreds(c) {
    setEmail(c.email);
    setPassword(c.password);
    setError('');
  }

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: '#000000',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
      color: '#ffffff',
    }}>
      {/* ── LEFT BRAND PANEL ── */}
      <div style={{
        flex: '0 0 460px',
        background: '#0a0a0a',
        borderRight: '1px solid #1e2c31',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 48px',
        position: 'relative',
      }}>
        <div style={{ maxWidth: 360 }}>
          {/* Logo mark */}
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 9999,
            background: '#ffffff',
            color: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 32,
          }}>
            ⚡
          </div>

          <div style={{
            fontSize: 12,
            fontWeight: 400,
            color: '#71717a',
            letterSpacing: '0.72px',
            textTransform: 'uppercase',
            marginBottom: 12,
            fontFeatureSettings: '"ss03"',
          }}>
            Autonomous Operations
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 3.5vw, 40px)',
            fontWeight: 300,
            color: '#ffffff',
            lineHeight: 1.15,
            letterSpacing: '0.36px',
            marginBottom: 20,
            fontFeatureSettings: '"ss03"',
          }}>
            Commerce,<br />intelligently<br />automated.
          </h1>

          <p style={{ color: '#71717a', fontSize: 15, lineHeight: 1.6, marginBottom: 36, fontFeatureSettings: '"ss03"' }}>
            Real-time multi-agent pricing, inventory health triage, and high-frequency human-in-the-loop oversight.
          </p>

          {[
            'Algorithmic pricing & margin optimization',
            'Human-in-the-loop oversight queue',
            'Automated customer review triage',
            'High-velocity seller fulfillment',
          ].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{
                width: 18,
                height: 18,
                borderRadius: 9999,
                background: 'rgba(193,251,212,0.15)',
                color: '#c1fbd4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}>✓</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFeatureSettings: '"ss03"' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT LOGIN FORM PANEL ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: '#000000',
      }}>
        <div className={shake ? 'animate-shake' : ''} style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 400,
              color: '#ffffff',
              marginBottom: 6,
              letterSpacing: '0.36px',
              fontFeatureSettings: '"ss03"',
            }}>
              Sign in to Vyapari
            </h2>
            <p style={{ color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>
              Select a demo role or enter your merchant credentials.
            </p>
          </div>

          {/* Demo Quick-Fill Pill Chips */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 400, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', marginBottom: 10, fontFeatureSettings: '"ss03"' }}>
              Demo Pre-fill
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DEMO_CREDS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => fillCreds(c)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    border: '1px solid #1e2c31',
                    background: '#0a0a0a',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 12,
                    fontWeight: 420,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                    fontFeatureSettings: '"ss03"',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ffffff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                >
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@vyapari.local"
                required
                autoComplete="email"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>

            {error && (
              <div role="alert" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(254,226,226,0.1)',
                border: '1px solid rgba(254,226,226,0.25)',
                color: '#fee2e2',
                fontSize: 13,
                fontFeatureSettings: '"ss03"',
              }}>
                <span>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 24px',
                marginTop: 6,
                background: loading ? '#1e2c31' : '#ffffff',
                color: loading ? '#71717a' : '#000000',
                border: 'none',
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.18s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#e4e4e7'; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#ffffff'; }}
            >
              {loading ? <><Spinner size="sm" /> Signing in…</> : 'Sign In →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 400,
  color: '#71717a',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.72px',
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
};

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  background: '#0a0a0a',
  border: '1px solid #1e2c31',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: 14,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.18s',
};
