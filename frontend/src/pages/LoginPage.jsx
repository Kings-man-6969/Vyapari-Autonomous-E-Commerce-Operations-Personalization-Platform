import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, User, Store, ShieldCheck, ShoppingBag, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      if (user.role === 'seller') {
        navigate('/seller/dashboard');
      } else if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/explore');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div style={{
      backgroundColor: 'var(--color-obsidian-graphite)',
      minHeight: 'calc(100vh - 76px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '52px 20px',
      position: 'relative'
    }}>
      {/* Background Titanium Ambient Sheen */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '350px',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.05) 0%, rgba(203, 213, 225, 0.02) 40%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--color-gunmetal-dark)',
        padding: '44px 38px',
        borderRadius: '16px',
        border: '1px solid var(--color-border-steel)',
        boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
        position: 'relative',
        zIndex: 1
      }}>
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
            <KeyRound size={22} />
          </div>
          <h1 className="heading-whisper" style={{ fontSize: '26px', color: '#ffffff', letterSpacing: '0.02em', marginBottom: '8px' }}>
            Platform Authentication
          </h1>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', margin: 0 }}>
            Unified role-based access with live cryptographic token security
          </p>
        </div>

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
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                style={{ paddingLeft: '38px', backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
              />
            </div>
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color="var(--color-ash-label)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        {/* Demo One-Click Fill Options */}
        <div style={{ marginTop: '32px', borderTop: '1px solid var(--color-border-steel)', paddingTop: '22px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-ash-label)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px', textAlign: 'center' }}>
            Instant Role Credentials (Password: Password@123)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleDemoFill('customer1@vyapari.com', 'Password@123')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                color: 'var(--color-silver-glow)',
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-chrome)';
                e.currentTarget.style.backgroundColor = 'var(--color-slate-chrome)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-steel)';
                e.currentTarget.style.backgroundColor = 'var(--color-titanium-brushed)';
                e.currentTarget.style.color = 'var(--color-silver-glow)';
              }}
            >
              <User size={14} color="var(--color-icy-steel)" />
              <span>Customer: <strong style={{ color: '#ffffff' }}>Aarav Sharma</strong> (customer1@vyapari.com)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoFill('seller2@vyapari.com', 'Password@123')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                color: 'var(--color-silver-glow)',
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-chrome)';
                e.currentTarget.style.backgroundColor = 'var(--color-slate-chrome)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-steel)';
                e.currentTarget.style.backgroundColor = 'var(--color-titanium-brushed)';
                e.currentTarget.style.color = 'var(--color-silver-glow)';
              }}
            >
              <Store size={14} color="var(--color-icy-steel)" />
              <span>Seller: <strong style={{ color: '#ffffff' }}>Volt Tech Studio</strong> (seller2@vyapari.com)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDemoFill('admin@vyapari.com', 'Password@123')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-titanium-brushed)',
                border: '1px solid var(--color-border-steel)',
                color: 'var(--color-silver-glow)',
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-chrome)';
                e.currentTarget.style.backgroundColor = 'var(--color-slate-chrome)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-steel)';
                e.currentTarget.style.backgroundColor = 'var(--color-titanium-brushed)';
                e.currentTarget.style.color = 'var(--color-silver-glow)';
              }}
            >
              <ShieldCheck size={14} color="var(--color-icy-steel)" />
              <span>Admin: <strong style={{ color: '#ffffff' }}>Vyapari SuperAdmin</strong> (admin@vyapari.com)</span>
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.8 }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ fontWeight: 600, color: 'var(--color-icy-steel)', textDecoration: 'underline' }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
};
