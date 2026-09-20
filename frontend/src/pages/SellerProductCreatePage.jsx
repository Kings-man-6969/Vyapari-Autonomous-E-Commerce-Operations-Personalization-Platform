import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import api from '../services/api';

export const SellerProductCreatePage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // AI draft assistant modal / drawer
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    price: '',
    compare_at_price: '',
    cost_price: '',
    inventory_count: 20,
    category_id: '',
    tags: '',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
    status: 'active'
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) {
          setCategories(res.data.data);
          if (res.data.data.length > 0) {
            setFormData((prev) => ({ ...prev, category_id: res.data.data[0].id }));
          }
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Auto-generate slug from title
  const handleTitleChange = (val) => {
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-');
    setFormData((prev) => ({ ...prev, title: val, slug: generatedSlug }));
  };

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

  const handleAiGenerate = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    try {
      setAiGenerating(true);
      const res = await api.post('/ai/listing/generate', {
        specs: aiPrompt,
        category: categories.find((c) => c.id === formData.category_id)?.name || 'General'
      });
      if (res.data?.success) {
        const draft = res.data.data;
        setFormData((prev) => ({
          ...prev,
          title: draft.title || prev.title,
          slug: (draft.title || prev.title).toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-'),
          description: draft.description || prev.description,
          tags: Array.isArray(draft.tags) ? draft.tags.join(', ') : draft.tags || prev.tags,
          price: draft.suggested_price || prev.price
        }));
        setShowAiModal(false);
        setStatusMsg({ type: 'success', text: 'AI drafted listing applied! Review and finalize below.' });
      }
    } catch (err) {
      // Fallback draft generation
      const mockTitle = aiPrompt.split('\n')[0].slice(0, 80);
      setFormData((prev) => ({
        ...prev,
        title: mockTitle,
        slug: mockTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-'),
        description: `Premium quality ${mockTitle}. Handcrafted and tested for durability, performance, and modern aesthetics.\n\nSpecifications:\n${aiPrompt}`,
        tags: 'premium, trending, artisanal'
      }));
      setShowAiModal(false);
      setStatusMsg({ type: 'success', text: 'Generated product draft! You can adjust details below.' });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });

    if (!formData.title || !formData.price || !formData.category_id) {
      setStatusMsg({ type: 'error', text: 'Title, Price, and Category are required.' });
      return;
    }

    try {
      setLoading(true);
      const cleanedImages = formData.images.filter((url) => url.trim().length > 0);
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        inventory_count: parseInt(formData.inventory_count, 10) || 0,
        images: cleanedImages.length > 0 ? cleanedImages : ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      };

      const res = await api.post('/seller/products', payload);
      if (res.data?.success) {
        navigate('/seller/products');
      }
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to create product listing.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/seller/products" style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Create New Product</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="btn-outline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}
        >
          <Sparkles size={16} />
          <span>Draft with AI Copilot</span>
        </button>
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
                  placeholder="e.g., Handcrafted Ceramic Coffee Mug 350ml"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
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
                <label className="form-label">Full Description</label>
                <textarea
                  className="textarea-field"
                  rows="6"
                  placeholder="Describe material, dimensions, care instructions, warranty..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Search & AI Tags (Comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ceramic, artisan, kitchenware, coffee mug"
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
                    placeholder="999"
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
                    placeholder="1499"
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
                    placeholder="450"
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
                    placeholder="https://images.unsplash.com/..."
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
            {/* Status & Visibility Card */}
            <div className="table-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Visibility</h3>
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
                <label className="form-label">Initial Inventory Units</label>
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
                disabled={loading}
                style={{ width: '100%', marginTop: '16px' }}
              >
                <Save size={16} />
                <span>{loading ? 'Publishing...' : 'Publish Product'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* AI Draft Assistant Modal */}
      {showAiModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="var(--color-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>AI Listing Studio Copilot</h3>
              </div>
              <button onClick={() => setShowAiModal(false)} style={{ color: 'var(--color-text-secondary)' }}>
                &times;
              </button>
            </div>
            <form onSubmit={handleAiGenerate}>
              <div className="modal-body">
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                  Paste rough specs, supplier bullet points, or product features. The Gemini Team B agent will formulate an SEO-optimized title, comprehensive description, and semantic tags.
                </p>
                <div className="form-group">
                  <label className="form-label">Product Raw Notes / Bullet Points</label>
                  <textarea
                    className="textarea-field"
                    rows="6"
                    placeholder="e.g., Organic cotton oversized hoodie, 400 GSM heavy fleece, pre-shrunk, drop-shoulder cut, available in charcoal and beige..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAiModal(false)} className="btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={aiGenerating}>
                  <Sparkles size={16} />
                  <span>{aiGenerating ? 'Drafting with Gemini...' : 'Generate Listing'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerProductCreatePage;
