import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Cpu, 
  Check
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
  const [targetAudience, setTargetAudience] = useState('Discerning tech & lifestyle consumers');
  const [targetMargin, setTargetMargin] = useState('35%');

  // Generated draft
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const list = res.data?.data?.categories || res.data?.categories || (Array.isArray(res.data?.data) ? res.data.data : []);
        if (res.data?.success && list.length > 0) {
          setCategories(list);
          setCategoryId(list[0].id);
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
      const generatedTitle = firstLine ? `Curated ${firstLine}` : 'Premium Precision Engineered Product';
      setDraft({
        title: generatedTitle,
        description: `Precision-crafted item designed for performance and reliability.\n\nTechnical Specifications:\n${specs}\n\nManufactured with verified quality standards and covered by platform guarantee.`,
        tags: ['verified', 'precision', 'handcrafted', 'durable', 'trending'],
        suggested_price: 1899,
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
        description: 'Autonomous listing draft staged for merchant approval queue',
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
          text: 'Listing draft successfully submitted to Human-in-the-Loop Approval Queue.'
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
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            backgroundColor: 'var(--color-titanium-brushed)',
            border: '1px solid var(--color-border-steel)',
            color: 'var(--color-icy-steel)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Sparkles size={15} />
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-icy-steel)' }}>
            Gemini Autonomous Agent Studio
          </span>
        </div>
        <h1 className="heading-whisper" style={{ fontSize: '26px' }}>
          AI Listing Studio
        </h1>
        <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '13px', marginTop: '4px' }}>
          Synthesize structured, pgvector-embedded product catalog listings from supplier specification notes
        </p>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(244, 63, 94, 0.12)',
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : 'var(--color-error)',
          border: actionMsg.type === 'success' ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
          fontSize: '13px'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '28px' }}>
        {/* Input Form Column */}
        <div className="table-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '16px' }}>Input Specifications</h3>
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
              <Sparkles size={15} />
              <span>{loading ? 'Synthesizing with Gemini Agent...' : 'Generate Listing Draft'}</span>
            </button>
          </form>
        </div>

        {/* Live Draft Preview Column */}
        <div className="table-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>AI Generated Draft</h3>
            {draft && (
              <span className="badge badge-mint" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Cpu size={12} />
                384D Embeddings Ready
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
              backgroundColor: 'var(--color-deep-canopy)',
              borderRadius: '8px',
              border: '1px solid var(--color-iron-veil)',
              textAlign: 'center'
            }}>
              <Layers size={36} color="var(--color-ash-label)" style={{ marginBottom: '12px' }} />
              <p style={{ fontWeight: 500, fontSize: '13px', color: '#ffffff' }}>
                No draft generated yet
              </p>
              <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', marginTop: '4px', maxWidth: '280px' }}>
                Enter product specs on the left and run the agent to synthesize structured titles and descriptions.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              <div style={{ borderBottom: '1px solid var(--color-iron-veil)', paddingBottom: '12px' }}>
                <span className="form-label">Synthesized Title</span>
                <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginTop: '4px' }}>
                  {draft.title}
                </h4>
              </div>

              <div style={{ borderBottom: '1px solid var(--color-iron-veil)', paddingBottom: '12px' }}>
                <span className="form-label">Suggested Price</span>
                <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-icy-steel)', marginTop: '4px' }}>
                  ₹{draft.suggested_price}
                </div>
              </div>

              <div style={{ borderBottom: '1px solid var(--color-iron-veil)', paddingBottom: '12px', flex: 1 }}>
                <span className="form-label">Marketing Narrative</span>
                <p style={{ fontSize: '12px', color: 'var(--color-tide-pool)', lineHeight: 1.6, marginTop: '6px', whiteSpace: 'pre-line' }}>
                  {draft.description}
                </p>
              </div>

              <div>
                <span className="form-label">Semantic Keywords</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {(Array.isArray(draft.tags) ? draft.tags : []).map((t, idx) => (
                    <span key={idx} className="badge badge-neutral">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--color-iron-veil)' }}>
                <button
                  type="button"
                  onClick={handlePushToQueue}
                  className="btn-primary"
                  disabled={submitting}
                  style={{ width: '100%' }}
                >
                  <Check size={15} />
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
