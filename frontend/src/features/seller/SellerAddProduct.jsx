import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import PageHeader from '../../shared/components/PageHeader';

/* ─── DESIGN.MD — Seller Add Product ───
   Canvas: #000000 · Form card: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────────── */

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports'];

export default function SellerAddProduct({ token }) {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'Electronics', price: '', cost: '', stock: '', image_url: ''
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/seller/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          price: Number(form.price),
          cost: Number(form.cost),
          stock: Number(form.stock),
          image_url: form.image_url || undefined,
        }),
      }, token);
      showToast('Product created successfully.', 'success');
      navigate('/seller/inventory');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Add New Listing"
        description="Expand your product catalog by configuring pricing, initial stock, and metadata."
      />

      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '36px',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div>
            <label style={labelStyle}>Product Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={e => setForm(c => ({ ...c, name: e.target.value }))}
              required
              placeholder="e.g. Premium Noise-Cancelling Headphones"
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
              onBlur={e => e.target.style.borderColor = '#1e2c31'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={labelStyle}>Category *</label>
              <select
                style={inputStyle}
                value={form.category}
                onChange={e => setForm(c => ({ ...c, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a', color: '#fff' }}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Image URL (Optional)</label>
              <input
                style={inputStyle}
                type="url"
                value={form.image_url}
                onChange={e => setForm(c => ({ ...c, image_url: e.target.value }))}
                placeholder="https://images.unsplash.com/..."
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>
          </div>

          <div style={{ height: 1, background: '#1e2c31', margin: '4px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
            <div>
              <label style={labelStyle}>Selling Price (₹) *</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => setForm(c => ({ ...c, price: e.target.value }))}
                required
                placeholder="0.00"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>
            <div>
              <label style={labelStyle}>Unit Cost (₹) *</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                value={form.cost}
                onChange={e => setForm(c => ({ ...c, cost: e.target.value }))}
                required
                placeholder="0.00"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>
            <div>
              <label style={labelStyle}>Initial Stock *</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                value={form.stock}
                onChange={e => setForm(c => ({ ...c, stock: e.target.value }))}
                required
                placeholder="0"
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/seller/inventory')}
              disabled={submitting}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                borderRadius: 9999,
                border: '1px solid #1e2c31',
                fontWeight: 420,
                fontSize: 14,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.18s',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '12px 32px',
                background: '#ffffff',
                color: '#000000',
                borderRadius: 9999,
                border: 'none',
                fontWeight: 500,
                fontSize: 14,
                cursor: submitting ? 'wait' : 'pointer',
                transition: 'background 0.18s',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#e4e4e7'; }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#ffffff'; }}
            >
              {submitting ? 'Creating…' : 'Create Product'}
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
