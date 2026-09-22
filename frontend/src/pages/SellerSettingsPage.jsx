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
        setStatusMsg({ type: 'success', text: 'Store identity and RAG policy documents synchronized successfully.' });
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
      <div style={{ maxWidth: '880px', margin: '0 auto' }}>
        <div style={{ height: '40px', width: '200px', marginBottom: '24px' }} className="skeleton" />
        <div style={{ height: '350px' }} className="skeleton" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
          Store Settings & RAG Knowledge Base
        </h1>
        <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
          Configure merchant storefront credentials and policy documents ingested by the Customer Support RAG agent
        </p>
      </div>

      {statusMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: statusMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${statusMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
          color: statusMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '0.875rem'
        }}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Brand Identity */}
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={18} color="var(--color-icy-steel)" />
            <span>Storefront Brand Identity</span>
          </h3>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--color-slate-caption)' }}>Public Store Name</label>
            <input
              type="text"
              className="input-field"
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--color-slate-caption)' }}>Store Biography & Tagline</label>
            <textarea
              className="textarea-field"
              rows="3"
              value={formData.store_description}
              onChange={(e) => setFormData({ ...formData, store_description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--color-slate-caption)' }}>Registered Operational Address</label>
            <input
              type="text"
              className="input-field"
              value={formData.business_address}
              onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-slate-caption)' }}>Support Contact Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="support@yourbrand.com"
                value={formData.support_email}
                onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: 'var(--color-slate-caption)' }}>Support Helpline</label>
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
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--color-icy-steel)" />
              <span>Policies for Support RAG Agent</span>
            </h3>
            <span className="badge-agent" style={{ fontSize: '11px' }}>RAG Ingested</span>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-tide-pool)', marginBottom: '16px', lineHeight: 1.5 }}>
            Our autonomous customer service agent queries these policy clauses via semantic retrieval (RAG) when answering buyer questions regarding returns, repairs, and transit times.
          </p>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Return & Refund Policy Clauses</label>
            <textarea
              className="textarea-field"
              rows="5"
              value={formData.return_policy}
              onChange={(e) => setFormData({ ...formData, return_policy: e.target.value })}
              placeholder="Specify conditions, turnaround times, tags required, and restocking fees if applicable..."
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Shipping & Packaging Standards</label>
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
            disabled={saving}
            style={{
              padding: '12px 28px',
              borderRadius: '9999px',
              backgroundColor: '#ffffff',
              color: '#02090a',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            <Save size={16} />
            <span>{saving ? 'Syncing...' : 'Save Settings & Sync Policies'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default SellerSettingsPage;
