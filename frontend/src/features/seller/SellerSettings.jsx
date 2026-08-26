import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import PageHeader from '../../shared/components/PageHeader';

/* ─── DESIGN.MD — Seller Settings ───
   Canvas: #000000 · Form card: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
────────────────────────────────────── */

export default function SellerSettings({ token }) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const data = await apiFetch('/seller/settings', {}, token);
        setStoreName(data.store_name || '');
        setStoreDescription(data.store_description || '');
        setReturnPolicy(data.return_policy || '');
        setContactEmail(data.contact_email || '');
      } catch (err) {
        showToast(err.message || 'Failed to load store settings', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [token]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/seller/settings', {
        method: 'PUT',
        body: JSON.stringify({
          store_name: storeName,
          store_description: storeDescription,
          return_policy: returnPolicy,
          contact_email: contactEmail,
        }),
      }, token);
      showToast('Store settings updated successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SpinnerPage message="Loading store configuration…" />;

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Store Settings"
        description="Manage storefront identity, merchant policies, and customer support channels."
      />

      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '36px',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={labelStyle}>Store Name</label>
              <input
                style={inputStyle}
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="e.g. Apex Hardware Store"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>
            <div>
              <label style={labelStyle}>Contact Email</label>
              <input
                style={inputStyle}
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                placeholder="merchant-ops@apex.com"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Storefront Description</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
              value={storeDescription}
              onChange={e => setStoreDescription(e.target.value)}
              placeholder="Tell buyers about your operational specialty, sourcing, and quality promise…"
              rows={3}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
              onBlur={e => e.target.style.borderColor = '#1e2c31'}
            />
          </div>

          <div>
            <label style={labelStyle}>Return & Warranty Policy</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
              value={returnPolicy}
              onChange={e => setReturnPolicy(e.target.value)}
              placeholder="e.g. 14-day hassle-free return policy on verified delivery…"
              rows={3}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
              onBlur={e => e.target.style.borderColor = '#1e2c31'}
            />
          </div>

          <div style={{ height: 1, background: '#1e2c31', margin: '4px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '12px 32px',
                background: '#ffffff',
                color: '#000000',
                borderRadius: 9999,
                border: 'none',
                fontWeight: 500,
                fontSize: 14,
                cursor: saving ? 'wait' : 'pointer',
                transition: 'background 0.18s',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
              }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#e4e4e7'; }}
              onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#ffffff'; }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 400,
  color: '#71717a',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.72px',
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
};

const inputStyle = {
  width: '100%',
  background: '#121212',
  border: '1px solid #1e2c31',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#ffffff',
  fontSize: 15,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.18s',
};
