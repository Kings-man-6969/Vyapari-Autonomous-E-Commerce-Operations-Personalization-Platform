import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, setAccessToken } from '../../services/api';

/* ─── DESIGN.MD — Transactional Track (Auth) ───
   Canvas: canvas-cream #fbfbf5
   Card:   canvas-light #ffffff · hairline-light border · rounded-lg · Level-3 stacked shadow
   CTA:    button-primary-pill (solid black)
   Inputs: text-input spec (white bg, hairline border, rounded-md 8px)
   Demo chips: pill-tag-mint (aloe) / pill-tag-shade
─────────────────────────────────────────────── */

const DEMOS = [
  { label: 'Customer', email: 'customer@vyapari.local', password: 'customer123', role: 'Customer', emoji: '🛍️' },
  { label: 'Seller',   email: 'seller@vyapari.local',   password: 'seller123',   role: 'Seller',   emoji: '📦' },
  { label: 'Admin',    email: 'admin@vyapari.local',    password: 'admin123',    role: 'Admin',    emoji: '🛡️' },
];

export default function AuthPage({ onLogin, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemos, setShowDemos] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (mode === 'login') {
        const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        setAccessToken(data.access_token);
        onLogin({ access_token: data.access_token, role: data.role, user_id: data.user_id, name: data.name });
      } else {
        await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, account_type: accountType }) });
        const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        setAccessToken(data.access_token);
        onLogin({ access_token: data.access_token, role: data.role, user_id: data.user_id, name: data.name });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  }

  function fillDemo(demo) { setEmail(demo.email); setPassword(demo.password); setShowDemos(false); }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fbfbf5',   /* canvas-cream */
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle hairline pattern — cream canvas texture */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(var(--hairline-light, #e4e4e7) 1px, transparent 1px),
                          linear-gradient(90deg, var(--hairline-light, #e4e4e7) 1px, transparent 1px)`,
        backgroundSize: '80px 80px',
        opacity: 0.4,
      }} />

      {/* Back to landing */}
      <Link to="/" style={{
        position: 'fixed', top: 24, left: 24,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 9999,
        border: '1px solid #e4e4e7', background: '#ffffff',
        fontSize: 14, color: '#71717a', textDecoration: 'none',
        fontWeight: 420, transition: 'border-color 0.18s, color 0.18s',
        fontFeatureSettings: '"ss03"',
        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#000'; e.currentTarget.style.color = '#000'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e4e7'; e.currentTarget.style.color = '#71717a'; }}
      >
        ← Back
      </Link>

      {/* Auth card — card-pricing */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#ffffff',
        border: '1px solid #e4e4e7',
        borderRadius: 12,
        padding: '36px 32px',
        boxShadow: '0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
        position: 'relative',
        animation: 'floatIn 0.4s ease both',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ textDecoration: 'none' }}>
            <div style={{
              fontSize: 18, fontWeight: 500, color: '#000000',
              letterSpacing: '0.5px', marginBottom: 6,
              fontFeatureSettings: '"ss03"',
            }}>VYAPARI</div>
          </Link>
          <div style={{
            fontSize: 14, fontWeight: 420, color: '#71717a',
            fontFeatureSettings: '"ss03"',
          }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </div>
        </div>

        {/* Mode tabs — pill-tag-mint/shade style */}
        <div style={{
          display: 'flex', gap: 4,
          background: '#fbfbf5',
          border: '1px solid #e4e4e7',
          borderRadius: 9999, padding: 4, marginBottom: 28,
        }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 9999,
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: mode === m ? 500 : 420,
                background: mode === m ? '#000000' : 'transparent',
                color: mode === m ? '#ffffff' : '#71717a',
                transition: 'all 0.2s',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
              }}
            >{m === 'login' ? 'Sign in' : 'Register'}</button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: 8, padding: '11px 14px',
            color: '#991b1b', fontSize: 14, marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
            fontWeight: 420, fontFeatureSettings: '"ss03"',
          }}>
            <span>⚠</span> {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text" placeholder="Your full name"
                value={name} onChange={e => setName(e.target.value)} required autoFocus
                className="text-input"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#000'}
                onBlur={e => e.target.style.borderColor = '#e4e4e7'}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required
              autoFocus={mode === 'login'}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#000'}
              onBlur={e => e.target.style.borderColor = '#e4e4e7'}
            />
          </div>

          <div style={{ marginBottom: mode === 'register' ? 16 : 24 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#000'}
              onBlur={e => e.target.style.borderColor = '#e4e4e7'}
            />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Account type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { val: 'customer', label: 'Customer', desc: 'Browse & shop', emoji: '🛍️' },
                  { val: 'seller',   label: 'Seller',   desc: 'Manage products', emoji: '📦' },
                ].map(t => (
                  <button key={t.val} type="button" onClick={() => setAccountType(t.val)}
                    style={{
                      padding: '14px 12px', borderRadius: 8,
                      border: `1.5px solid ${accountType === t.val ? '#000000' : '#e4e4e7'}`,
                      background: accountType === t.val ? '#fbfbf5' : '#ffffff',
                      color: '#000000',
                      fontWeight: accountType === t.val ? 500 : 420,
                      fontSize: 14, cursor: 'pointer',
                      transition: 'all 0.18s',
                      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                      fontFeatureSettings: '"ss03"',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</div>
                    <div style={{ fontWeight: 500 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 2, fontWeight: 420 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* button-primary-pill: solid black */}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px',
            background: loading ? '#3f3f46' : '#000000',
            color: '#ffffff', border: 'none', borderRadius: 9999,
            fontSize: 15, fontWeight: 420, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.18s',
            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#3f3f46'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#000000'; }}
          >
            {loading ? (
              <span style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                animation: 'spin 0.8s linear infinite',
                display: 'inline-block',
              }} />
            ) : null}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {/* Demo credentials — pill-tag-mint chips */}
        {mode === 'login' && (
          <div style={{ marginTop: 16 }}>
            <button onClick={() => setShowDemos(!showDemos)} style={{
              width: '100%', padding: '9px 14px',
              background: '#fbfbf5',
              border: '1px solid #e4e4e7',
              borderRadius: 9999, color: '#71717a', fontSize: 13,
              cursor: 'pointer',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'border-color 0.18s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#000'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#e4e4e7'}
            >
              <span>🔑</span>
              <span>Demo credentials</span>
              <span style={{ transform: showDemos ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: 10 }}>▾</span>
            </button>

            {showDemos && (
              <div style={{
                marginTop: 8,
                background: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: 12, overflow: 'hidden',
                animation: 'floatIn 0.18s ease',
              }}>
                {DEMOS.map((d, i) => (
                  <button key={d.email} onClick={() => fillDemo(d)} style={{
                    width: '100%', padding: '14px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: i < DEMOS.length - 1 ? '1px solid #e4e4e7' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                    fontFeatureSettings: '"ss03"',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fbfbf5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {/* Pill-tag-mint or shade chip */}
                    <div style={{
                      padding: '4px 12px', borderRadius: 9999,
                      background: d.label === 'Customer' ? '#c1fbd4' : '#d4d4d8',
                      fontSize: 12, fontWeight: 420, color: '#000',
                      letterSpacing: '0.3px', flexShrink: 0,
                    }}>{d.emoji} {d.label}</div>
                    <div>
                      <div style={{ fontSize: 13, color: '#000', fontWeight: 420 }}>{d.email}</div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 1 }}>Password: {d.password}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 12, color: '#a1a1aa' }}>→</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guest access */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/shop" style={{
            fontSize: 13, color: '#a1a1aa', textDecoration: 'none',
            transition: 'color 0.18s', fontWeight: 420,
            fontFeatureSettings: '"ss03"',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#000'}
          onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
          >
            Continue as guest →
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12, fontWeight: 400,
  color: '#71717a', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.72px',
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
};

const inputStyle = {
  width: '100%',
  background: '#ffffff',
  border: '1px solid #e4e4e7',
  borderRadius: 8,
  padding: '10px 12px',
  color: '#000000',
  fontSize: 16,
  fontWeight: 420,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
  outline: 'none',
  transition: 'border-color 0.18s, box-shadow 0.18s',
};
