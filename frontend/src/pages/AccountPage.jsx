import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Lock, 
  MapPin, 
  Package, 
  Heart, 
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
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          Account Settings
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
          Manage your personal information, security credentials, and preferences
        </p>
      </div>

      {/* Account Navigation Tabs */}
      <div className="tab-list">
        <button
          onClick={() => setActiveTab('profile')}
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <User size={16} />
          <span>Personal Info</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <KeyRound size={16} />
          <span>Password & Security</span>
        </button>
        <Link
          to="/account/addresses"
          className="tab-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <MapPin size={16} />
          <span>Address Book</span>
        </Link>
        <Link
          to="/orders"
          className="tab-button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Package size={16} />
          <span>My Orders</span>
        </Link>
      </div>

      {/* Tab: Personal Info */}
      {activeTab === 'profile' && (
        <div className="table-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--color-border-card)' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800
            }}>
              {name ? name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{name || user?.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{user?.email}</span>
                <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
              </div>
            </div>
          </div>

          {profileMsg.text && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: profileMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
              color: profileMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
              fontSize: 'var(--font-size-sm)'
            }}>
              {profileMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} style={{ maxWidth: '560px' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address (Immutable)</label>
              <input
                type="email"
                className="input-field"
                value={user?.email || ''}
                disabled
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                Your email is verified and tied to your marketplace identity.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
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
              className="btn-primary"
              disabled={profileLoading}
              style={{ marginTop: '8px' }}
            >
              <Save size={16} />
              <span>{profileLoading ? 'Saving...' : 'Save Profile Details'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div className="table-card" style={{ padding: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Security & Authentication</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
              Ensure your account is protected with a secure password
            </p>
          </div>

          {passwordMsg.text && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: passwordMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
              color: passwordMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
              fontSize: 'var(--font-size-sm)'
            }}>
              {passwordMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ maxWidth: '480px' }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
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
              <label className="form-label">New Password</label>
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
              <label className="form-label">Confirm New Password</label>
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
              className="btn-primary"
              disabled={passwordLoading}
              style={{ marginTop: '8px' }}
            >
              <Lock size={16} />
              <span>{passwordLoading ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AccountPage;
