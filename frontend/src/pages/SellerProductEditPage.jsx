import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Eye
} from 'lucide-react';
import api from '../services/api';

export const SellerProductEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    price: '',
    compare_at_price: '',
    cost_price: '',
    inventory_count: 0,
    category_id: '',
    tags: '',
    images: [],
    status: 'active'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [catRes, prodRes] = await Promise.all([
          api.get('/categories'),
          api.get(`/products/${id}`)
        ]);

        if (catRes.data?.success) {
          setCategories(catRes.data.data);
        }

        if (prodRes.data?.success) {
          const p = prodRes.data.data;
          const imgArr = Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? JSON.parse(p.images || '[]') : []);
          setFormData({
            title: p.title || '',
            slug: p.slug || '',
            description: p.description || '',
            price: p.price || '',
            compare_at_price: p.compare_at_price || '',
            cost_price: p.cost_price || '',
            inventory_count: p.inventory_count !== undefined ? p.inventory_count : p.stock_qty || 0,
            category_id: p.category_id || '',
            tags: Array.isArray(p.tags) ? p.tags.join(', ') : p.tags || '',
            images: imgArr.length > 0 ? imgArr : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
            status: p.status || 'active'
          });
        }
      } catch (err) {
        setStatusMsg({ type: 'error', text: 'Failed to load product details.' });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleAddImageUrl = () => {
    setFormData((prev) => ({ ...prev, images: [...prev.images, ''] }));
  };

  const handleImageUrlChange = (index, val) => {
    const updated = [...formData.images];
    updated[index] = val;
    setFormData((prev) => ({ ...prev, images: updated }));
  };

  const handleRemoveImageUrl = (index) => {
    if (formData.images.length === 1) return;
    const updated = formData.images.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, images: updated }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    try {
      setSaving(true);
      const cleanedImages = formData.images.filter((url) => url.trim().length > 0);
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        inventory_count: parseInt(formData.inventory_count, 10) || 0,
        images: cleanedImages.length > 0 ? cleanedImages : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags
      };

      const res = await api.put(`/seller/products/${id}`, payload);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Product updated successfully.' });
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update product.'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ height: '40px', width: '200px', marginBottom: '24px' }} className="skeleton" />
        <div style={{ height: '400px' }} className="skeleton" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/seller/products" style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Edit Product</h1>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>ID: {id}</span>
          </div>
        </div>

        <Link to={`/products/${id}`} target="_blank" className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <Eye size={16} />
          <span>View Live Product</span>
        </Link>
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

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* General Info Card */}
            <div className="table-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>General Information</h3>
              <div className="form-group">
                <label className="form-label">Product Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">URL Slug</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="textarea-field"
                  rows="6"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tags (Comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </div>

            {/* Pricing Card */}
            <div className="table-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Pricing & Margins</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Compare-at Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={formData.compare_at_price}
                    onChange={(e) => setFormData({ ...formData, compare_at_price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-field"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Product Images Card */}
            <div className="table-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Image Assets</h3>
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} />
                  <span>Add Image URL</span>
                </button>
              </div>

              {formData.images.map((url, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <input
                    type="url"
                    className="input-field"
                    value={url}
                    onChange={(e) => handleImageUrlChange(idx, e.target.value)}
                  />
                  {formData.images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImageUrl(idx)}
                      style={{ color: 'var(--color-error)', padding: '8px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="table-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Status & Stock</h3>
              <div className="form-group">
                <label className="form-label">Listing Status</label>
                <select
                  className="select-field"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active (Live in Marketplace)</option>
                  <option value="draft">Draft (Private)</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="select-field"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Available Inventory Units</label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={formData.inventory_count}
                  onChange={(e) => setFormData({ ...formData, inventory_count: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
                style={{ width: '100%', marginTop: '16px' }}
              >
                <Save size={16} />
                <span>{saving ? 'Saving Changes...' : 'Save Product'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SellerProductEditPage;
