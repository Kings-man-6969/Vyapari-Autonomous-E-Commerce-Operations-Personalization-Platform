import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Mail } from 'lucide-react';
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
      // Role-based redirection per contract §10
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
    <div className="container" style={{ padding: '64px 24px', maxWidth: '440px' }}>
      <div style={{
        backgroundColor: '#ffffff',
        padding: '36px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-card)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #FF385C 0%, #E00B41 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            marginBottom: '12px'
          }}>
            <Sparkles size={24} />
          </div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>
            Welcome to Vyapari
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Unified role-based marketplace login
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} color="var(--color-text-muted)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--font-size-sm)'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color="var(--color-text-muted)" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 38px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-subtle)',
                  fontSize: 'var(--font-size-sm)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', marginTop: '8px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo One-Click Fill Options */}
        <div style={{ marginTop: '28px', borderTop: '1px solid var(--color-border-card)', paddingTop: '20px' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '10px', textAlign: 'center' }}>
            ONE-CLICK DEMO ACCOUNTS (Password: Password@123)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleDemoFill('customer1@vyapari.com', 'Password@123')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-surface-subtle)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                textAlign: 'left',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              👤 Customer: Aarav Sharma (customer1@vyapari.com)
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('seller2@vyapari.com', 'Password@123')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-secondary-light)',
                color: 'var(--color-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                textAlign: 'left',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              🏪 Seller: Volt Tech Studio (seller2@vyapari.com)
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill('admin@vyapari.com', 'Password@123')}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#EEF2FF',
                color: '#6366F1',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                textAlign: 'left',
                border: '1px solid var(--color-border-subtle)'
              }}
            >
              🛡️ Admin: Vyapari Admin (admin@vyapari.com)
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};
