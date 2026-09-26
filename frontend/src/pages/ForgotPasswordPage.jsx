import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound, ArrowLeft, Send } from 'lucide-react';
import api from '../services/api';

/**
 * Forgot password — step 1 of 2.
 *
 * The backend answers 200 whether or not the address exists, and this page
 * must not undermine that. It never says "no account with that email"; the
 * success copy is identical either way, which is the whole point of the
 * endpoint's design. Anything more specific here turns a non-enumerating
 * endpoint back into an enumerating one.
 */
export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Present only when the backend runs outside production. The server decides
  // this; the client never decides it, because a client that guessed would hand
  // out a live reset token.
  const [devLink, setDevLink] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setDevLink(data?.data?.dev_reset_link || null);
      setSent(true);
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Could not send the reset email. Please try again shortly.'
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

  if (sent) {
    return shell(
      <>
        {header(<Send size={22} />, 'Check your inbox', 'If that address has an account, a reset link is on its way.')}

        <div style={{
          padding: '14px 16px',
          backgroundColor: 'rgba(56, 189, 248, 0.10)',
          color: 'var(--color-silver-glow)',
          borderRadius: '8px',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          fontSize: '12px',
          lineHeight: 1.6,
          marginBottom: '22px'
        }}>
          The link expires in 60 minutes and can be used once. If it has been a
          few minutes and nothing arrives, check the spam folder before
          requesting another — requesting a new one invalidates the first.
        </div>

        {devLink && (
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
            <strong style={{ color: '#ffffff' }}>Development mode.</strong>{' '}
            No email provider is configured, so the link is returned inline. The
            server withholds this in production.
            <div style={{ marginTop: '10px' }}>
              <a href={devLink} style={{ color: 'var(--color-icy-steel)', wordBreak: 'break-all' }}>
                {devLink}
              </a>
            </div>
          </div>
        )}

        <Link to="/login" className="btn-primary" style={{ width: '100%', padding: '13px', textAlign: 'center', textDecoration: 'none' }}>
          Back to sign in
        </Link>
      </>
    );
  }

  return shell(
    <>
      {header(<KeyRound size={22} />, 'Reset your password', 'We will email you a link to choose a new one.')}

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
            Email Address
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Mail size={16} color="var(--color-ash-label)" style={{ position: 'absolute', left: '12px' }} />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '38px', backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', padding: '14px', marginTop: '6px', fontSize: '14px' }}
        >
          {loading ? 'Sending...' : 'Send reset link'}
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
    </>
  );
};
