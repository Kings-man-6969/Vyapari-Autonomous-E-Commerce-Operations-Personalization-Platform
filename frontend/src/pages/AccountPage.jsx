import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Lock, 
  MapPin, 
  Package, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const AccountPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  // Security form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/profile');
        if (res.data?.success) {
          setName(res.data.data.name || '');
          setPhone(res.data.data.phone || '');
        }
      } catch (err) {
        console.error('Failed to load profile details:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    try {
      setProfileLoading(true);
      const res = await api.put('/users/profile', { name, phone });
      if (res.data?.success) {
        setProfileMsg({ type: 'success', text: 'Profile details updated successfully.' });
      }
    } catch (err) {
      setProfileMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to update profile. Please try again.' 
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await api.put('/users/password', {
        currentPassword,
        newPassword
      });
      if (res.data?.success) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordMsg({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to change password.' 
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px 24px 80px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
          Account & Security
        </h1>
        <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
          Manage personal credentials, session security, and saved delivery endpoints
        </p>
      </div>

      {/* Account Navigation Tabs */}
      <div className="tab-list" style={{ marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('profile')}
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <User size={15} />
          <span>Profile Info</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <KeyRound size={15} />
          <span>Security & Keys</span>
        </button>
        <Link
          to="/account/addresses"
          className="tab-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        >
          <MapPin size={15} />
          <span>Address Book</span>
        </Link>
        <Link
          to="/orders"
          className="tab-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
        >
          <Package size={15} />
          <span>Orders</span>
        </Link>
      </div>

      {/* Tab: Personal Info */}
      {activeTab === 'profile' && (
        <div className="table-card" style={{ padding: '32px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--color-border-steel)' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-slate-chrome)',
              border: '1px solid var(--color-border-chrome)',
              color: 'var(--color-icy-steel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 600
            }}>
              {name ? name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 500, color: '#ffffff' }}>{name || user?.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-steel-mist)' }}>{user?.email}</span>
                <span className="badge-agent" style={{ textTransform: 'capitalize', fontSize: '11px' }}>{user?.role}</span>
              </div>
            </div>
          </div>

          {profileMsg.text && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: profileMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${profileMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
              color: profileMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
              fontSize: '0.875rem'
            }}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} style={{ maxWidth: '560px' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Full Name</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Email Address (Verified)</label>
              <input
                type="email"
                className="input-field"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6 }}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '4px', display: 'block' }}>
                Your email is tied to cryptographic refresh-token cookie rotation.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Phone Number</label>
              <input
                type="tel"
                className="input-field"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={profileLoading}
              style={{
                marginTop: '12px',
                padding: '10px 24px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#02090a',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: profileLoading ? 'not-allowed' : 'pointer'
              }}
            >
              <Save size={14} />
              <span>{profileLoading ? 'Saving...' : 'Save Profile Details'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className="table-card" style={{ padding: '32px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>Security & Authentication</h2>
            <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
              Ensure your account is protected with a secure password and rotate tokens safely
            </p>
          </div>

          {passwordMsg.text && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: passwordMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${passwordMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
              color: passwordMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
              fontSize: '0.875rem'
            }}>
              {passwordMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ maxWidth: '480px' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Current Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>New Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Min. 8 characters with letters & numbers"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Confirm New Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              style={{
                marginTop: '12px',
                padding: '10px 24px',
                borderRadius: '9999px',
                backgroundColor: '#ffffff',
                color: '#02090a',
                fontWeight: 600,
                fontSize: '13px',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: passwordLoading ? 'not-allowed' : 'pointer'
              }}
            >
              <Lock size={14} />
              <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AccountPage;
