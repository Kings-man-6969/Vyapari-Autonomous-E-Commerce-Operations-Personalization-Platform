import React, { useState, useEffect, useCallback } from 'react';
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
import VariantEditor from '../components/VariantEditor';
import ImageUploader from '../components/ImageUploader';
import { imageList } from '../lib/imageUrl';

export const SellerProductEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [hasVariants, setHasVariants] = useState(false);
  // Whether the "link to an image" rows are showing. Off until asked for, so
  // the upload box is what a seller sees first.
  const [showUrlFallback, setShowUrlFallback] = useState(false);

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

  const fetchData = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        // The seller's own endpoint, not /api/products/:id. It is the same row
        // plus the two things an edit form needs and the public endpoint does
        // not lift out of the attributes jsonb: cost_price and tags -- and it
        // aliases stock_qty as inventory_count. The page was reading the public
        // endpoint, whose payload nests the row under data.product, so the form
        // loaded with a blank title and price and the seller saved the blanks
        // over a live listing.
        api.get(`/seller/products/${id}`)
      ]);

      const catList = catRes.data?.data?.categories || catRes.data?.categories || (Array.isArray(catRes.data?.data) ? catRes.data.data : []);
      if (catRes.data?.success) {
        setCategories(catList);
      }

      if (prodRes.data?.success) {
        const p = prodRes.data.data || {};
        const imgArr = imageList(p.images);
        const resolvedCatId = p.category_id || (catList[0]?.id || '');

        // jsonb arrives as text on this pool, so tags is '["silk","handloom"]'.
        // Handed to the text box unparsed, the next save splits it on commas and
        // the seller ends up with tags called '["silk"' and 'handloom"]'.
        let tags = p.tags;
        if (typeof tags === 'string' && tags.trim().startsWith('[')) {
          try {
            tags = JSON.parse(tags);
          } catch {
            tags = [];
          }
        }
        const tagText = Array.isArray(tags) ? tags.join(', ') : (tags || '');

        setFormData({
          title: p.title || '',
          slug: p.slug || '',
          description: p.description || '',
          price: p.price ?? '',
          compare_at_price: p.compare_at_price ?? '',
          cost_price: p.cost_price ?? '',
          inventory_count: p.inventory_count !== undefined ? p.inventory_count : p.stock_qty || 0,
          category_id: resolvedCatId,
          tags: tagText,
          // Whatever the product actually has. Seeding a fake photo here was
          // worse than useless on an edit form: it looked like the seller's own
          // image, and the first save wrote it to the database permanently.
          images: imgArr,
          status: p.status || 'active'
        });
        setHasVariants(!!p.has_variants);
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to load product details.' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

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
        category_id: formData.category_id && formData.category_id.trim() ? formData.category_id.trim() : null,
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
        // A product with options has no stock of its own -- the total is the sum
        // of the options and the trigger maintains it. Sending it would be
        // refused (STOCK_MANAGED_BY_VARIANTS) or, worse, accepted and silently
        // overwritten by the next option edit. Omitting the field leaves the
        // computed value alone, so the other edits on this form still save.
        inventory_count: hasVariants ? null : (parseInt(formData.inventory_count, 10) || 0),
        images: cleanedImages,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map((t) => t.trim()).filter(Boolean) : formData.tags
      };

      const res = await api.put(`/seller/products/${id}`, payload);
      if (res.data?.success) {
        setStatusMsg({ type: 'success', text: 'Product modifications successfully persisted.' });
        // has_variants can flip in either direction from the editor: the second
        // option raises the flag, and deleting back to one lowers it and promotes
        // that option's price onto the product. The sidebar has to know which it
        // is now, or it keeps telling the seller to edit a total that is theirs
        // to edit again.
        setHasVariants(!!res.data.data?.has_variants);
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
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ height: '40px', width: '200px', marginBottom: '24px' }} className="skeleton" />
        <div style={{ height: '400px' }} className="skeleton" />
      </div>
    );
  }

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
              Edit Listing
            </h1>
            <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>SKU ID: {id}</span>
          </div>
        </div>

        <Link 
          to={`/products/${id}`} 
          target="_blank" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-gunmetal-dark)',
            border: '1px solid var(--color-border-steel)',
            color: '#ffffff',
            fontSize: '13px',
            textDecoration: 'none'
          }}
        >
          <Eye size={15} color="var(--color-icy-steel)" />
          <span>View Public PDP</span>
        </Link>
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
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Description</label>
                <textarea
                  className="textarea-field"
                  rows="6"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Tags (Comma separated)</label>
                <input
                  type="text"
                  className="input-field"
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
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Selling Price (₹)</label>
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
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Compare-at Price (₹)</label>
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
                  <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>Cost Price (₹)</label>
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
            <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '16px' }}>
                Media Assets
              </h3>

              <ImageUploader
                value={formData.images}
                onChange={(urls) => setFormData((prev) => ({ ...prev, images: urls }))}
                label="Product images"
              />

              {showUrlFallback ? (
                <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--color-border-veil, var(--color-border-steel))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-silver-glow)' }}>
                      Or link to an image
                    </span>
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
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUrlFallback(true)}
                  style={{
                    marginTop: '12px',
                    fontSize: '12px',
                    color: 'var(--color-ash-label)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0',
                    textDecoration: 'underline'
                  }}
                >
                  Already have the image hosted somewhere? Link it instead
                </button>
              )}
            </div>

            {/* Options. Inside the form but not part of it -- no input here has a
                name attribute and the editor renders its own type="button"
                controls, so saving the product cannot take a live size run down
                with a mistyped description. */}
            <VariantEditor productId={id} onProductChanged={fetchData} />
          </div>

          {/* Right Sidebar Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '16px' }}>
                Status & Allocation
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
                <label className="form-label" style={{ color: 'var(--color-ash-label)' }}>
                  Available Inventory Units
                </label>
                {hasVariants ? (
                  <>
                    {/* A derived number is not editable. Offering a text box for
                        it invites a seller to type a total, see it accepted, and
                        watch the next option edit overwrite it -- the API would
                        refuse a changed value, but not one that already matched. */}
                    <input
                      type="number"
                      className="input-field"
                      value={formData.inventory_count}
                      readOnly
                      aria-readonly="true"
                      style={{ opacity: 0.7, cursor: 'not-allowed' }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--color-tide-pool)', margin: '6px 0 0' }}>
                      This product has options, so this is their total. Set each
                      option&apos;s stock in the Options panel below.
                    </p>
                  </>
                ) : (
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formData.inventory_count}
                    onChange={(e) => setFormData({ ...formData, inventory_count: e.target.value })}
                    required
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
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
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
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
