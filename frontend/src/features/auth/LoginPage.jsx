import React, { useState } from 'react'
import Spinner from '@/shared/components/Spinner'

/*
  LOGIN PAGE — Split-panel design
  Left : Deep emerald brand panel with editorial Playfair headline
  Right: Minimal form on charcoal background
  Body font: Source Sans 3
*/

const DEMO_CREDS = [
  { label: 'Admin',    email: 'admin@vyapari.local',    password: 'admin123',    icon: '🛡️', color: '#6366f1' },
  { label: 'Seller',  email: 'seller@vyapari.local',   password: 'seller123',   icon: '🏪', color: '#0d9488' },
  { label: 'Customer',email: 'customer@vyapari.local', password: 'customer123', icon: '🛒', color: '#d97706' },
]

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [shake, setShake]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  function fillCreds(c) { setEmail(c.email); setPassword(c.password); setError('') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070c09', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
      {/* ── LEFT BRAND PANEL ── */}
      <div style={{
        flex: '0 0 480px',
        background: 'linear-gradient(160deg, #022c22 0%, #065f46 45%, #047857 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px 52px', position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative orb */}
        <div style={{ position: 'absolute', right: -100, top: -80, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: -60, bottom: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,6,.12) 0%, transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,.12)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', marginBottom: 32,
            boxShadow: '0 0 28px rgba(52,211,153,.35)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
              <path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.6)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            Autonomous Commerce
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(34px,4vw,52px)',
            fontWeight: 900,
            color: '#ecfdf5',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 20,
          }}>
            Commerce,<br /><em style={{ fontStyle: 'italic', color: '#34d399' }}>intelligently</em><br />automated.
          </h1>

          <p style={{ color: 'rgba(167,243,208,.65)', fontSize: 16, maxWidth: 320, lineHeight: 1.75, marginBottom: 40 }}>
            AI-driven inventory, pricing, and HITL decision workflows — all in one unified platform.
          </p>

          {[
            'Real-time inventory & stock management',
            'AI pricing engine with manual override',
            'Human-in-the-loop decision workflows',
            'Review sentiment analysis & response tools',
          ].map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 13 }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'rgba(52,211,153,.2)', border: '1px solid rgba(52,211,153,.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#34d399', fontWeight: 800, flexShrink: 0, marginTop: 1,
              }}>✓</span>
              <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT LOGIN PANEL ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#070c09' }}>
        <div className={shake ? 'animate-shake' : ''} style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 30, fontWeight: 800,
              color: '#ecfdf5', marginBottom: 8,
              letterSpacing: '-0.03em',
            }}>
              Welcome back
            </h2>
            <p style={{ color: 'rgba(167,243,208,.5)', fontSize: 14 }}>
              Sign in to access your dashboard.
            </p>
          </div>

          {/* Demo quick-fills */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              Quick fill — demo accounts
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DEMO_CREDS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => fillCreds(c)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--r-full)',
                    border: '1px solid rgba(52,211,153,.15)',
                    background: 'rgba(16,185,129,.05)',
                    color: 'rgba(167,243,208,.7)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 150ms ease',
                    fontFamily: "'Source Sans 3', sans-serif",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,.35)'; e.currentTarget.style.background = 'rgba(16,185,129,.1)'; e.currentTarget.style.color = '#d1fae5' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(52,211,153,.15)'; e.currentTarget.style.background = 'rgba(16,185,129,.05)'; e.currentTarget.style.color = 'rgba(167,243,208,.7)' }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.45)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Email address</span>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vyapari.local"
                required
                autoComplete="email"
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'rgba(16,185,129,.05)',
                  border: '1px solid rgba(52,211,153,.18)',
                  borderRadius: 'var(--r-md)',
                  color: '#d1fae5', fontSize: 14,
                  fontFamily: "'Source Sans 3', sans-serif",
                  outline: 'none',
                  transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(52,211,153,.18)'; e.target.style.boxShadow = 'none' }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(167,243,208,.45)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Password</span>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '11px 14px',
                  background: 'rgba(16,185,129,.05)',
                  border: '1px solid rgba(52,211,153,.18)',
                  borderRadius: 'var(--r-md)',
                  color: '#d1fae5', fontSize: 14,
                  fontFamily: "'Source Sans 3', sans-serif",
                  outline: 'none',
                  transition: 'border-color var(--t-fast), box-shadow var(--t-fast)',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(52,211,153,.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,.1)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(52,211,153,.18)'; e.target.style.boxShadow = 'none' }}
              />
            </label>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 'var(--r-md)',
                background: 'rgba(239,68,68,.08)',
                border: '1px solid rgba(239,68,68,.2)',
                color: '#fca5a5', fontSize: 13, fontWeight: 500,
              }}>
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '13px 24px', marginTop: 4,
                background: loading ? 'rgba(16,185,129,.4)' : 'linear-gradient(135deg, #059669, #10b981)',
                border: 'none', borderRadius: 'var(--r-md)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                fontFamily: "'Source Sans 3', sans-serif",
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all var(--t-base)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'linear-gradient(135deg, #047857, #059669)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(16,185,129,.35)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #059669, #10b981)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              {loading ? <><Spinner size="sm" color="#fff" /> Signing in…</> : 'Sign in →'}
            </button>
          </form>

          <p style={{ color: 'rgba(167,243,208,.25)', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 1.6 }}>
            Customers get the storefront · Sellers & admins get the operations console.
          </p>
        </div>
      </div>
    </div>
  )
}
