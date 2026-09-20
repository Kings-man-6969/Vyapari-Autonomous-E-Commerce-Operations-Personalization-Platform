import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, User, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'seller' ? 'seller' : 'customer';
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await register({
        name,
        email,
        password,
        role,
        phone,
        storeName: role === 'seller' ? storeName : undefined
      });

      if (user.role === 'seller') {
        navigate('/seller/dashboard');
      } else {
        navigate('/explore');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '64px 24px', maxWidth: '480px' }}>
      <div style={{
        backgroundColor: '#ffffff',
        padding: '36px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-card)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800 }}>
            Create Your Account
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Join the autonomous commerce platform
          </p>
        </div>

        {/* Role Chooser Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '4px',
          backgroundColor: 'var(--color-surface-subtle)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '24px'
        }}>
          <button
            type="button"
            onClick={() => setRole('customer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              backgroundColor: role === 'customer' ? '#ffffff' : 'transparent',
              color: role === 'customer' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: role === 'customer' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            <User size={14} /> Customer
          </button>
          <button
            type="button"
            onClick={() => setRole('seller')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              backgroundColor: role === 'seller' ? '#ffffff' : 'transparent',
              color: role === 'seller' ? 'var(--color-secondary)' : 'var(--color-text-secondary)',
              boxShadow: role === 'seller' ? 'var(--shadow-xs)' : 'none'
            }}
          >
            <Store size={14} /> Seller / Merchant
          </button>
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
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Vikram Malhotra"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
            />
          </div>

          {role === 'seller' && (
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
                Store / Brand Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Urban Kicks & Threads"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 600, marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', marginTop: '8px' }}
          >
            {loading ? 'Creating Account...' : (role === 'seller' ? 'Launch Store & Console' : 'Sign Up as Customer')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};
