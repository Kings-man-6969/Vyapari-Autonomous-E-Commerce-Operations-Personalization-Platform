import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { User, Store, ShoppingBag, ShieldCheck, UserPlus } from 'lucide-react';
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
        maxWidth: '500px',
        backgroundColor: 'var(--color-gunmetal-dark)',
        padding: '44px 38px',
        borderRadius: '16px',
        border: '1px solid var(--color-border-steel)',
        boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
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
            <UserPlus size={22} />
          </div>
          <h1 className="heading-whisper" style={{ fontSize: '26px', color: '#ffffff', letterSpacing: '0.02em', marginBottom: '8px' }}>
            Create Account
          </h1>
          <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', margin: 0 }}>
            Join the autonomous commerce platform ecosystem
          </p>
        </div>

        {/* Role Chooser Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '6px',
          backgroundColor: 'var(--color-obsidian-graphite)',
          borderRadius: '10px',
          border: '1px solid var(--color-border-steel)',
          marginBottom: '26px'
        }}>
          <button
            type="button"
            onClick={() => setRole('customer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: role === 'customer' ? 'var(--color-titanium-brushed)' : 'transparent',
              color: role === 'customer' ? '#ffffff' : 'var(--color-silver-glow)',
              border: role === 'customer' ? '1px solid var(--color-border-chrome)' : '1px solid transparent',
              boxShadow: role === 'customer' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <User size={14} color={role === 'customer' ? 'var(--color-icy-steel)' : 'currentColor'} /> Customer
          </button>
          <button
            type="button"
            onClick={() => setRole('seller')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: role === 'seller' ? 'var(--color-titanium-brushed)' : 'transparent',
              color: role === 'seller' ? '#ffffff' : 'var(--color-silver-glow)',
              border: role === 'seller' ? '1px solid var(--color-border-chrome)' : '1px solid transparent',
              boxShadow: role === 'seller' ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Store size={14} color={role === 'seller' ? 'var(--color-icy-steel)' : 'currentColor'} /> Seller / Merchant
          </button>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Aarav Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
            />
          </div>

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
            />
          </div>

          {role === 'seller' && (
            <div>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
                Store / Merchant Brand Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Volt Tech Studio"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="input-field"
                style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-silver-glow)', opacity: 0.7, marginTop: '4px', display: 'block' }}>
                Merchants gain instant autonomous studio access; KYC review required for public ledger publishing.
              </span>
            </div>
          )}

          <div>
            <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
              Password (min. 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              style={{ backgroundColor: 'var(--color-obsidian-graphite)', borderColor: 'var(--color-border-steel)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', marginTop: '8px', fontSize: '14px' }}
          >
            {loading ? 'Registering Account...' : (role === 'seller' ? 'Establish Seller Store' : 'Create Customer Account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: 'var(--color-silver-glow)', opacity: 0.8 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--color-icy-steel)', textDecoration: 'underline' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};
