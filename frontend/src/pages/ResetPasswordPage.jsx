import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ShieldCheck, ArrowLeft, Check, X } from 'lucide-react';
import api from '../services/api';
import { evaluatePassword } from '../lib/passwordPolicy';

/**
 * Reset password — step 2 of 2.
 *
 * The rules are mirrored from the backend on purpose. The server is the
 * authority and will reject anything that fails regardless, but validating
 * here means the user finds out before the request is sent, and critically
 * before their one-shot token is spent. A typo silently burning the token
 * would send them back to their inbox for another email.
 *
 * The rules themselves live in src/lib/passwordPolicy.js so this page and
 * RegisterPage cannot disagree with each other; that module documents the
 * backend counterpart it mirrors.
 */
export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { ok, checks, common: tooCommon } = useMemo(
    () => evaluatePassword(password),
    [password]
  );
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = token && ok && !mismatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mismatch) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      // Every session was revoked server-side, so the in-memory access token in
      // this tab is worthless. Bounce to login rather than letting the user
      // click around and collect 401s.
      setTimeout(() => navigate('/login', { replace: true }), 2600);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Could not reset your password. Please request a new link.'
      );
    } finally {
      setLoading(false);
    }
  };

  const shell = (children) => (
    <div style={{
      backgroundColor: 'var(--color-obsidian-graphite)',
      minHeight: 'calc(100vh - 76px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '52px 20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--color-gunmetal-dark)',
        padding: '44px 38px',
        borderRadius: '16px',
        border: '1px solid var(--color-border-steel)',
        boxShadow: '0 24px 50px rgba(0,0,0,0.6)'
      }}>
        {children}
      </div>
    </div>
  );

  const header = (icon, title, sub) => (
    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        backgroundColor: 'var(--color-titanium-brushed)',
        border: '1px solid var(--color-border-chrome)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-icy-steel)',
        marginBottom: '18px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
      }}>
        {icon}
      </div>
      <h1 className="heading-whisper" style={{ fontSize: '24px', color: '#ffffff', letterSpacing: '0.02em', marginBottom: '8px' }}>
        {title}
      </h1>
      <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', margin: 0 }}>
        {sub}
      </p>
    </div>
  );

  if (!token) {
    return shell(
      <>
        {header(<Lock size={22} />, 'Reset link missing', 'This page needs a reset link.')}
        <div style={{
          padding: '14px 16px',
          backgroundColor: 'rgba(250, 204, 21, 0.10)',
          color: 'var(--color-silver-glow)',
          borderRadius: '8px',
          border: '1px solid rgba(250, 204, 21, 0.32)',
          fontSize: '12px',
          lineHeight: 1.6,
          marginBottom: '22px'
        }}>
          The address you followed did not include a token. Open the link from
          your reset email, or request a new one.
        </div>
        <Link
          to="/forgot-password"
          className="btn-primary"
          style={{ width: '100%', padding: '13px', textAlign: 'center', textDecoration: 'none' }}
        >
          Request a new link
        </Link>
      </>
    );
  }

  if (done) {
    return shell(
      <>
        {header(<ShieldCheck size={22} />, 'Password updated', 'Taking you to the sign-in page...')}
        <div style={{
          padding: '14px 16px',
          backgroundColor: 'rgba(56, 189, 248, 0.10)',
          color: 'var(--color-silver-glow)',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          fontSize: '12px',
          lineHeight: 1.6
        }}>
          For your safety, every other session has been signed out. Sign in
          again with your new password.
        </div>
      </>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-obsidian-graphite)',
      minHeight: 'calc(100vh - 76px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '52px 20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--color-gunmetal-dark)',
        padding: '44px 38px',
        borderRadius: '16px',
        border: '1px solid var(--color-border-steel)',
        boxShadow: '0 24px 50px rgba(0,0,0,0.6)'
      }}>
        {header(<Lock size={22} />, 'Choose a new password', 'This link works once.')}

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(244, 63, 94, 0.12)',
            color: 'var(--color-error)',
            borderRadius: '8px',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            fontSize: '12px',
            fontWeight: 500,
            marginBottom: '22px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              New Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color="var(--color-ash-label)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '38px', backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
              />
            </div>
          </div>

          {password.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '-6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {checks.map((c) => (
                <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px' }}>
                  {c.ok
                    ? <Check size={12} color="var(--color-icy-steel)" />
                    : <X size={12} color="var(--color-ash-label)" />}
                  <span style={{ color: c.ok ? 'var(--color-icy-steel)' : 'var(--color-ash-label)' }}>
                    {c.label}
                  </span>
                </li>
              ))}
              {tooCommon && (
                <li style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px' }}>
                  <X size={12} color="var(--color-error)" />
                  <span style={{ color: 'var(--color-error)' }}>
                    That password is too common. Choose another.
                  </span>
                </li>
              )}
            </ul>
          )}

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              Confirm New Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color="var(--color-ash-label)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-field"
                style={{
                  paddingLeft: '38px',
                  backgroundColor: 'var(--color-obsidian-graphite)',
                  borderColor: mismatch ? 'var(--color-error)' : 'var(--color-border-steel)'
                }}
              />
            </div>
            {mismatch && (
              <p style={{ color: 'var(--color-error)', fontSize: '11px', margin: '6px 0 0' }}>
                The two passwords do not match.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', marginTop: '6px', fontSize: '14px' }}
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--color-silver-glow)',
              opacity: 0.8,
              textDecoration: 'none'
            }}
          >
            <ArrowLeft size={13} />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
