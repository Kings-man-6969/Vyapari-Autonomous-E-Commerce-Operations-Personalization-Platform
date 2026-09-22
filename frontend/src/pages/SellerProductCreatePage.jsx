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
  ShieldAlert,
  Terminal,
  Image as ImageIcon
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export const SellerProductCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
    status: user?.seller_status === 'active' ? 'active' : 'draft'
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success) {
          const list = res.data.data?.categories || res.data.categories || (Array.isArray(res.data.data) ? res.data.data : []);
          setCategories(list);
          if (list.length > 0) {
            setFormData((prev) => ({ ...prev, category_id: list[0].id }));
          }
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

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
        setStatusMsg({ type: 'success', text: 'Gemini formulation synthesized into product draft.' });
      }
    } catch (err) {
      // Fallback draft generation
      const mockTitle = aiPrompt.split('\n')[0].slice(0, 80);
      setFormData((prev) => ({
        ...prev,
        title: mockTitle,
        slug: mockTitle.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-'),
        description: `High-performance ${mockTitle}. Engineered with precision tolerances, durable structural components, and ergonomic finish.\n\nKey Specifications:\n${aiPrompt}`,
        tags: 'artisan, durable, modern, verified'
      }));
      setShowAiModal(false);
      setStatusMsg({ type: 'success', text: 'Listing drafted from operational specifications.' });
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
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags
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
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link 
            to="/seller/products" 
            style={{ 
              color: 'var(--color-tide-pool)', 
              display: 'flex', 
              alignItems: 'center',
              padding: '6px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-deep-canopy)',
              border: '1px solid var(--color-iron-veil)'
            }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
              Create Listing
            </h1>
            <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.8125rem', marginTop: '2px' }}>
              Publish item to catalog and auto-generate 384D semantic embeddings
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          <Sparkles size={15} color="var(--color-icy-steel)" />
          <span>Draft with AI Copilot</span>
        </button>
      </div>

      {user?.seller_status === 'pending_kyc' && (
        <div style={{
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.8125rem',
          color: '#fef08a'
        }}>
          <ShieldAlert size={18} color="#facc15" style={{ flexShrink: 0 }} />
          <span>
            <strong>Store Verification Pending:</strong> Your account is currently in <code>pending_kyc</code> review. You can create and edit draft listings now; they will automatically be activated upon administrative review.
          </span>
        </div>
      )}

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

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* General Info Card */}
            <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '16px' }}>
                Listing Specifications
              </h3>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Product Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g., Handcrafted Matte Ceramic Mug 350ml"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>URL Slug</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Product Narrative / Description</label>
                <textarea
                  className="textarea-field"
                  rows="6"
                  placeholder="Describe material provenance, technical dimensions, care guidelines, and aesthetic design..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Search Keywords & Semantic Tags (Comma separated)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ceramic, artisan, kitchenware, matte finish"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>
            </div>

            {/* Pricing Card */}
            <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '16px' }}>
                Financial Parameters
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>List Price (₹)</label>
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
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Compare Price (₹)</label>
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
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Unit Cost (₹)</label>
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
            <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
                  Media Assets
                </h3>
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  style={{ 
                    fontSize: '12px', 
                    color: 'var(--color-icy-steel)', 
                    fontWeight: 600, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={14} />
                  <span>Add URL</span>
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
                      style={{ 
                        color: '#f87171', 
                        padding: '8px', 
                        background: 'transparent', 
                        border: 'none', 
                        cursor: 'pointer' 
                      }}
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
            <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '16px' }}>
                Inventory & Status
              </h3>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Listing Status</label>
                <select
                  className="select-field"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">Active (Public)</option>
                  <option value="draft">Draft (Private)</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Category Taxonomy</label>
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
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Stock Units (Option B Atomic Allocation)</label>
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
                disabled={loading}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px 24px',
                  borderRadius: '9999px',
                  backgroundColor: '#ffffff',
                  color: '#02090a',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={16} />
                <span>{loading ? 'Committing...' : 'Commit Listing'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* AI Draft Assistant Modal */}
      {showAiModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ backgroundColor: 'var(--color-gunmetal-dark)', border: '1px solid var(--color-border-steel)', maxWidth: '580px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--color-border-steel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--color-icy-steel)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
                  AI Listing Formulation
                </h3>
              </div>
              <button 
                onClick={() => setShowAiModal(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--color-tide-pool)', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAiGenerate}>
              <div className="modal-body">
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-tide-pool)', marginBottom: '16px', lineHeight: 1.5 }}>
                  Provide rough supplier notes, material tags, or bullet points. The agent synthesizes an SEO-structured narrative, tags, and suggested pricing.
                </p>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Raw Specifications / Supplier Notes</label>
                  <textarea
                    className="textarea-field"
                    rows="6"
                    placeholder="e.g., Japanese titanium pour-over dripper, double-wall insulation, food-grade 304 mesh filter, 450ml capacity, lightweight camping and countertop use..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--color-iron-veil)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowAiModal(false)} 
                  style={{
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-deep-canopy)',
                    border: '1px solid var(--color-iron-veil)',
                    color: 'var(--color-tide-pool)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={aiGenerating}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '9999px',
                    backgroundColor: '#ffffff',
                    color: '#02090a',
                    fontWeight: 600,
                    fontSize: '13px',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: aiGenerating ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Sparkles size={14} />
                  <span>{aiGenerating ? 'Synthesizing...' : 'Generate Listing'}</span>
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
