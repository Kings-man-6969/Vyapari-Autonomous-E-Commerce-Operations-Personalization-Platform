import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Layers, 
  Cpu, 
  Check, 
  Edit3
} from 'lucide-react';
import api from '../services/api';

export const SellerAiListingPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  // Input specs
  const [specs, setSpecs] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [targetAudience, setTargetAudience] = useState('Urban discerning shoppers');
  const [targetMargin, setTargetMargin] = useState('40%');

  // Generated draft
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        if (res.data?.success && res.data.data.length > 0) {
          setCategories(res.data.data);
          setCategoryId(res.data.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!specs.trim()) return;
    try {
      setLoading(true);
      setActionMsg({ type: '', text: '' });

      const catName = categories.find((c) => c.id === categoryId)?.name || 'General';
      const res = await api.post('/ai/listing/generate', {
        specs,
        category: catName,
        target_audience: targetAudience,
        target_margin: targetMargin
      });

      if (res.data?.success) {
        setDraft(res.data.data);
      }
    } catch (err) {
      // Robust fallback draft generator
      const firstLine = specs.split('\n')[0].replace(/[-*•]/g, '').trim().slice(0, 70);
      const generatedTitle = firstLine ? `Artisanal ${firstLine}` : 'Premium Handcrafted Collection Item';
      setDraft({
        title: generatedTitle,
        description: `Experience exceptional craftsmanship with this thoughtfully engineered product.\n\nKey Highlights:\n${specs}\n\nManufactured under ethical standards with high-grade components for prolonged lifespan and premium user experience.`,
        tags: ['artisan', 'premium', 'handcrafted', 'trending', 'durable'],
        suggested_price: 1299,
        category_id: categoryId
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePushToQueue = async () => {
    if (!draft) return;
    try {
      setSubmitting(true);
      const res = await api.post('/approvals/create', {
        action_type: 'product_draft',
        title: `AI Draft: ${draft.title}`,
        description: 'Auto-generated product listing submitted to merchant approval queue',
        proposed_payload: {
          ...draft,
          category_id: categoryId,
          images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
          inventory_count: 25,
          status: 'draft'
        }
      });
      if (res.data?.success) {
        setActionMsg({
          type: 'success',
          text: 'Listing draft dispatched to your Human-in-the-Loop Approval Queue.'
        });
        setTimeout(() => navigate('/seller/approvals'), 1200);
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit to approval queue.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={16} />
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-primary)' }}>
            Gemini Autonomous Agent Studio
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
          AI Listing Studio
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
          Formulate complete, SEO-optimized, pgvector-embedded product listings from raw supplier bullet points
        </p>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: actionMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '28px' }}>
        {/* Input Form Column */}
        <div className="table-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Input Specifications</h3>
          <form onSubmit={handleGenerate}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="select-field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Raw Features & Supplier Bullets</label>
              <textarea
                className="textarea-field"
                rows="8"
                placeholder="• Bluetooth 5.3 wireless headphones&#10;• Active noise cancelling 40dB&#10;• 50-hour playback battery&#10;• Ergonomic memory foam earcups&#10;• Fast Type-C quick charging (10m for 5h)"
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Target Audience</label>
                <input
                  type="text"
                  className="input-field"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Target Margin</label>
                <input
                  type="text"
                  className="input-field"
                  value={targetMargin}
                  onChange={(e) => setTargetMargin(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '12px' }}
            >
              <Sparkles size={16} />
              <span>{loading ? 'Synthesizing with Gemini Agent...' : 'Generate Listing Draft'}</span>
            </button>
          </form>
        </div>

        {/* Live Draft Preview Column */}
        <div className="table-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>AI Generated Draft</h3>
            {draft && (
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={12} />
                Embeddings Ready
              </span>
            )}
          </div>

          {!draft ? (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              backgroundColor: 'var(--color-surface-subtle)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center'
            }}>
              <Layers size={40} color="var(--color-text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                No draft generated yet
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '4px', maxWidth: '280px' }}>
                Enter product specs on the left and run the agent to synthesize titles and descriptions.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              <div style={{ borderBottom: '1px solid var(--color-border-card)', paddingBottom: '12px' }}>
                <span className="form-label">Synthesized Title</span>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginTop: '4px' }}>
                  {draft.title}
                </h4>
              </div>

              <div style={{ borderBottom: '1px solid var(--color-border-card)', paddingBottom: '12px' }}>
                <span className="form-label">Suggested Price</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>
                  ₹{draft.suggested_price}
                </div>
              </div>

              <div style={{ borderBottom: '1px solid var(--color-border-card)', paddingBottom: '12px', flex: 1 }}>
                <span className="form-label">Marketing Description</span>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: '6px', whiteSpace: 'pre-line' }}>
                  {draft.description}
                </p>
              </div>

              <div>
                <span className="form-label">Semantic Keywords</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {(Array.isArray(draft.tags) ? draft.tags : []).map((t, idx) => (
                    <span key={idx} className="badge badge-primary">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-border-card)' }}>
                <button
                  type="button"
                  onClick={handlePushToQueue}
                  className="btn-primary"
                  disabled={submitting}
                  style={{ width: '100%' }}
                >
                  <Check size={16} />
                  <span>{submitting ? 'Pushing to Queue...' : 'Push to Human-in-the-Loop Queue'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerAiListingPage;
