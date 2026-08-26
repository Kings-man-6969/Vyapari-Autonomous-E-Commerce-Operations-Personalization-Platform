import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import Modal from '../../shared/components/Modal';

/* ─── DESIGN.MD — Seller Inventory ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────── */

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports'];
const emptyForm = { name: '', category: 'Electronics', price: '', cost: '', stock: '' };

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

export default function SellerInventory({ token }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editProduct, setEditProduct] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { loadInventory(); }, [token]);

  async function loadInventory() {
    setLoading(true);
    try {
      const payload = await apiFetch('/seller/inventory', {}, token);
      setProducts(payload.products || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/seller/products', {
        method: 'POST',
        body: JSON.stringify({
          name: createForm.name,
          category: createForm.category,
          price: Number(createForm.price),
          cost: Number(createForm.cost),
          stock: Number(createForm.stock),
        }),
      }, token);
      setCreateForm(emptyForm);
      setShowAddModal(false);
      showToast('Product created successfully.', 'success');
      await loadInventory();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(product) {
    setEditProduct(product);
    setEditForm({
      name: product.name || '',
      category: product.category || 'Electronics',
      price: String(product.price ?? ''),
      cost: String(product.cost ?? ''),
      stock: String(product.stock ?? ''),
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editProduct) return;
    setSubmitting(true);
    try {
      await apiFetch(`/seller/products/${editProduct.product_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category,
          price: Number(editForm.price),
          cost: Number(editForm.cost),
          stock: Number(editForm.stock),
        }),
      }, token);
      setEditProduct(null);
      showToast('Product updated successfully.', 'success');
      await loadInventory();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.product_id.toLowerCase().includes(search.toLowerCase())
  );

  const totalStock = products.reduce((s, p) => s + Number(p.stock || 0), 0);
  const totalValue = products.reduce((s, p) => s + Number(p.price || 0) * Number(p.stock || 0), 0);
  const criticalCount = products.filter((p) => Number(p.stock) < 5).length;

  if (loading && products.length === 0) return <SpinnerPage message="Loading catalog inventory…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', letterSpacing: '0.36px', lineHeight: 1.2, marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
            Inventory Management
          </h1>
          <p style={{ color: '#71717a', fontSize: 15, fontWeight: 420, fontFeatureSettings: '"ss03"' }}>
            Monitor real-time stock levels, profit margins, and catalog listings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={loadInventory}
            disabled={loading}
            style={{
              padding: '9px 20px',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              borderRadius: 9999,
              border: '1px solid #1e2c31',
              fontWeight: 420,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.18s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ffffff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
          >
            <span>↻</span>
            <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '9px 24px',
              background: '#ffffff',
              color: '#000000',
              borderRadius: 9999,
              border: 'none',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.18s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e4e4e7'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
          >
            <span>+</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Listings', value: products.length, sub: 'Active SKUs' },
          { label: 'Units in Stock', value: totalStock.toLocaleString(), sub: 'Warehouse aggregate' },
          { label: 'Total Stock Value', value: fmt(totalValue), sub: 'Retail potential' },
          { label: 'Critical Items', value: criticalCount, sub: criticalCount > 0 ? 'Requires restocking' : 'Optimal status', alert: criticalCount > 0 },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: '#0a0a0a',
              border: '1px solid #1e2c31',
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 400, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', marginBottom: 8, fontFeatureSettings: '"ss03"' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 400, color: stat.alert ? '#fee2e2' : '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: stat.alert ? '#fee2e2' : '#71717a', fontFeatureSettings: '"ss03"' }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Table Container */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* Search header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e2c31', display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#71717a', fontSize: 14 }}>🔍</span>
            <input
              type="text"
              placeholder="Filter products by title or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 40px',
                background: '#121212',
                border: '1px solid #1e2c31',
                borderRadius: 9999,
                color: '#ffffff',
                fontSize: 14,
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
                outline: 'none',
                transition: 'border-color 0.18s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
              onBlur={e => e.target.style.borderColor = '#1e2c31'}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#121212', borderBottom: '1px solid #1e2c31' }}>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Category</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Price</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Margin</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Stock</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📦</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>No products found</div>
                    <div style={{ color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>Try adjusting your search query.</div>
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => {
                  const margin = p.price > 0 ? ((p.price - p.cost) / p.price * 100) : 0;
                  const isLow = Number(p.stock) < 5;
                  return (
                    <tr
                      key={p.product_id}
                      style={{
                        borderBottom: idx < filtered.length - 1 ? '1px solid #1e2c31' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#ffffff', marginBottom: 2, fontFeatureSettings: '"ss03"' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>ID: {p.product_id?.slice(0, 10)}</div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.75)', fontFeatureSettings: '"ss03"' }}>{p.category}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>{fmt(p.price)}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: '#71717a', fontFeatureSettings: '"ss03"' }}>{fmt(p.cost)}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 500,
                          background: margin >= 20 ? 'rgba(193,251,212,0.15)' : 'rgba(254,226,226,0.15)',
                          color: margin >= 20 ? '#c1fbd4' : '#fee2e2',
                          fontFeatureSettings: '"ss03"',
                        }}>
                          {margin.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: isLow ? '#fee2e2' : '#ffffff',
                          fontWeight: isLow ? 500 : 420,
                          fontFeatureSettings: '"ss03"',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isLow ? '#fee2e2' : '#c1fbd4' }} />
                          <span>{p.stock}</span>
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button
                          onClick={() => startEdit(p)}
                          style={{
                            padding: '6px 14px',
                            background: 'transparent',
                            color: '#ffffff',
                            borderRadius: 9999,
                            border: '1px solid #1e2c31',
                            fontWeight: 420,
                            fontSize: 12,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                            fontFeatureSettings: '"ss03"',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={showAddModal || !!editProduct}
        title={showAddModal ? 'Add New Product' : `Edit: ${editProduct?.name}`}
        onClose={() => { setShowAddModal(false); setEditProduct(null); }}
        maxWidth={480}
      >
        <ProductForm
          form={showAddModal ? createForm : editForm}
          onChange={(k, v) => showAddModal ? setCreateForm(c => ({...c, [k]: v})) : setEditForm(c => ({...c, [k]: v}))}
          onSubmit={showAddModal ? handleCreate : handleUpdate}
          onCancel={() => { setShowAddModal(false); setEditProduct(null); }}
          submitting={submitting}
          submitLabel={showAddModal ? 'Create Product' : 'Save Changes'}
        />
      </Modal>
    </div>
  );
}

function ProductForm({ form, onChange, onSubmit, onCancel, submitting, submitLabel }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={labelStyle}>Product Name</label>
        <input
          style={inputStyle}
          value={form.name}
          onChange={e => onChange('name', e.target.value)}
          required
          placeholder="e.g. Wireless Ergonomic Keyboard"
          onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
          onBlur={e => e.target.style.borderColor = '#1e2c31'}
        />
      </div>
      <div>
        <label style={labelStyle}>Category</label>
        <select
          style={inputStyle}
          value={form.category}
          onChange={e => onChange('category', e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#0a0a0a', color: '#fff' }}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Price (₹)</label>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={e => onChange('price', e.target.value)}
            required
            placeholder="0.00"
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
            onBlur={e => e.target.style.borderColor = '#1e2c31'}
          />
        </div>
        <div>
          <label style={labelStyle}>Cost (₹)</label>
          <input
            style={inputStyle}
            type="number"
            step="0.01"
            min="0"
            value={form.cost}
            onChange={e => onChange('cost', e.target.value)}
            required
            placeholder="0.00"
            onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
            onBlur={e => e.target.style.borderColor = '#1e2c31'}
          />
        </div>
        <div>
          <label style={labelStyle}>Stock</label>
          <input
            style={inputStyle}
            type="number"
            min="0"
            value={form.stock}
            onChange={e => onChange('stock', e.target.value)}
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
          onClick={onCancel}
          disabled={submitting}
          style={{
            padding: '10px 22px',
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
            padding: '10px 24px',
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
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

const thStyle = {
  padding: '14px 24px',
  fontSize: 11,
  fontWeight: 500,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.72px',
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
};

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
  padding: '10px 12px',
  color: '#ffffff',
  fontSize: 15,
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.18s',
};
