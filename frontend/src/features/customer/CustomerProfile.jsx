import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';

/* ─── DESIGN.MD — Transactional Track ───
   Canvas: #fbfbf5 cream
   Form card: #ffffff white, hairline border, Level-3 stacked shadow
   Inputs: text-input spec (white bg, hairline border, rounded-md 8px)
   CTA: solid black pill
─────────────────────────────────────────── */

export default function CustomerProfile({ token }) {
  const { showToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    async function loadProfile() {
      try {
        const data = await apiFetch('/auth/me', {}, token);
        setProfile(data);
        setName(data.name || '');
        setEmail(data.email || '');
      } catch (err) {
        showToast('Failed to load profile', 'error');
      } finally { setLoading(false); }
    }
    loadProfile();
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email }),
      }, token);
      setProfile(updated);
      showToast('Profile updated successfully', 'success');
    } catch (e) {
      showToast(e.message || 'Failed to update profile', 'error');
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div style={{ background: '#fbfbf5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SpinnerPage />
    </div>
  );

  const hasChanges = name !== profile?.name || email !== profile?.email;

  return (
    <div style={{
      background: '#fbfbf5', minHeight: '100vh',
      padding: '48px 24px 80px',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Page title */}
        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 55px)',
          fontWeight: 300, color: '#000000',
          marginBottom: 8, lineHeight: 1.16,
          fontFeatureSettings: '"ss03"',
        }}>
          Account
        </h1>
        <p style={{ fontSize: 16, fontWeight: 420, color: '#71717a', marginBottom: 40, fontFeatureSettings: '"ss03"' }}>
          Manage your personal information.
        </p>

        {/* Hairline divider */}
        <div style={{ height: 1, background: '#e4e4e7', marginBottom: 32 }} />

        {/* Profile card */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e4e4e7',
          borderRadius: 12,
          padding: '32px',
          boxShadow: '0 8px 8px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.07), 0 2px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)',
        }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#c1fbd4',  /* aloe */
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 500, color: '#000',
              flexShrink: 0,
              fontFeatureSettings: '"ss03"',
            }}>
              {(name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#000000', fontFeatureSettings: '"ss03"' }}>
                {profile?.name || 'User'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 420, color: '#71717a', marginTop: 2, fontFeatureSettings: '"ss03"' }}>
                {profile?.email}
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#000000'}
                onBlur={e => e.target.style.borderColor = '#e4e4e7'}
              />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#000000'}
                onBlur={e => e.target.style.borderColor = '#e4e4e7'}
              />
            </div>

            {/* Save — button-primary-pill */}
            <button
              type="submit"
              disabled={saving || !hasChanges}
              style={{
                width: '100%', padding: '13px 24px',
                background: !hasChanges || saving ? '#d4d4d8' : '#000000',
                color: !hasChanges || saving ? '#71717a' : '#ffffff',
                border: 'none', borderRadius: 9999,
                fontSize: 15, fontWeight: 420, cursor: (!hasChanges || saving) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.18s',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
                marginTop: 8,
              }}
              onMouseEnter={e => { if (hasChanges && !saving) e.currentTarget.style.background = '#3f3f46'; }}
              onMouseLeave={e => { if (hasChanges && !saving) e.currentTarget.style.background = '#000000'; }}
            >
              {saving ? (
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid rgba(0,0,0,0.15)',
                  borderTopColor: '#71717a',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }} />
              ) : null}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
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
  transition: 'border-color 0.18s',
};
