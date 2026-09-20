import React, { useState, useEffect } from 'react';
import { 
  Store, 
  FileText, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Building2,
  Mail,
  Phone
} from 'lucide-react';
import api from '../services/api';

export const SellerSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    store_name: '',
    store_description: '',
    business_address: '',
    return_policy: '',
    shipping_policy: '',
    support_email: '',
    support_phone: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/seller/settings');
        if (res.data?.success) {
          const s = res.data.data;
          setFormData({
            store_name: s.store_name || '',
            store_description: s.store_description || '',
            business_address: s.business_address || '',
            return_policy: s.return_policy || 'Standard 7-day return policy for unused items in original packaging.',
            shipping_policy: s.shipping_policy || 'Orders dispatched within 24-48 hours via registered express courier.',
            support_email: s.support_email || '',
            support_phone: s.support_phone || ''
          });
        }
      } catch (err) {
        console.error('Failed to load store settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    try {
      setSaving(true);
      const res = await api.put('/seller/settings', formData);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Store settings and Support RAG policies updated successfully.' });
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to save settings.'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '840px', margin: '0 auto' }}>
        <div style={{ height: '40px', width: '200px', marginBottom: '24px' }} className="skeleton" />
        <div style={{ height: '350px' }} className="skeleton" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          Store Settings & AI Policy Knowledge Base
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
          Configure your storefront identity and policy documents indexed by our Customer Support RAG agent
        </p>
      </div>

      {statusMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: statusMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: statusMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Brand Identity */}
        <div className="table-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={18} color="var(--color-primary)" />
            <span>Storefront Brand Identity</span>
          </h3>

          <div className="form-group">
            <label className="form-label">Public Store Name</label>
            <input
              type="text"
              className="input-field"
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Store Biography & Tagline</label>
            <textarea
              className="textarea-field"
              rows="3"
              value={formData.store_description}
              onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Registered Operational Address</label>
            <input
              type="text"
              className="input-field"
              value={formData.business_address}
              onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Support Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="support@yourbrand.com"
                value={formData.support_email}
                onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Support Helpline</label>
              <input
                type="tel"
                className="input-field"
                placeholder="+91 80 1234 5678"
                value={formData.support_phone}
                onChange={(e) => setFormData({ ...formData, support_phone: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Policy Knowledge Base for RAG */}
        <div className="table-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--color-secondary)" />
              <span>Policies for Support RAG Agent</span>
            </h3>
            <span className="badge badge-success">Auto-Indexed</span>
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
            Our autonomous customer service agent queries these policy clauses via semantic retrieval (RAG) when answering buyer questions regarding returns, repairs, and transit times.
          </p>

          <div className="form-group">
            <label className="form-label">Return & Refund Policy Clauses</label>
            <textarea
              className="textarea-field"
              rows="5"
              value={formData.return_policy}
              onChange={(e) => setFormData({ ...formData, return_policy: e.target.value })}
              placeholder="Specify conditions, turnaround times, tags required, and restocking fees if applicable..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Shipping & Packaging Standards</label>
            <textarea
              className="textarea-field"
              rows="5"
              value={formData.shipping_policy}
              onChange={(e) => setFormData({ ...formData, shipping_policy: e.target.value })}
              placeholder="Specify dispatch windows, preferred courier partners, and packaging materials used..."
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Settings & Sync Policies'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SellerSettingsPage;
