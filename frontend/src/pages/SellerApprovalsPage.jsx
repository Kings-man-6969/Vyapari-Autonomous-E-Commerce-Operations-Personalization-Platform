import React, { useState, useEffect } from 'react';
import { Bot, Check, X, AlertTriangle, ShieldCheck, Sparkles, Clock, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export const SellerApprovalsPage = () => {
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [actionNotice, setActionNotice] = useState('');

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/approvals?status=${filter}`);
      if (res.data?.success) {
        setQueue(res.data.data.queue || []);
      }
    } catch (err) {
      console.error('Failed to load approval queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [filter]);

  const handleApprove = async (id) => {
    try {
      const res = await api.post(`/approvals/${id}/approve`);
      if (res.data?.success) {
        setActionNotice(`Approved action #${id.slice(0, 8)} successfully.`);
        setTimeout(() => setActionNotice(''), 3000);
        await fetchQueue();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Please specify a rejection reason:');
    if (reason === null) return;

    try {
      const res = await api.post(`/approvals/${id}/reject`, { reason });
      if (res.data?.success) {
        setActionNotice(`Rejected action #${id.slice(0, 8)}.`);
        setTimeout(() => setActionNotice(''), 3000);
        await fetchQueue();
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Rejection failed');
    }
  };

  const getRiskBadge = (risk) => {
    switch (risk) {
      case 'high':
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}>
            HIGH RISK
          </span>
        );
      case 'medium':
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            color: '#fef08a',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}>
            MEDIUM RISK
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: 'var(--color-icy-steel)',
            fontWeight: 600,
            letterSpacing: '0.04em'
          }}>
            LOW RISK
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <ShieldCheck size={16} color="var(--color-icy-steel)" />
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-icy-steel)', fontWeight: 600 }}>
            Human-in-the-Loop Safe Mutation Boundary
          </span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
          Agent Approval Queue
        </h1>
        <p style={{ color: 'var(--color-silver-glow)', opacity: 0.75, fontSize: '0.875rem', marginTop: '4px' }}>
          Autonomous Gemini agents operate strictly within draft bounds. Explicit merchant review is required before mutating live catalog or dispatching customer messages.
        </p>
      </div>

      {actionNotice && (
        <div style={{
          padding: '12px 18px',
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          color: 'var(--color-icy-steel)',
          borderRadius: '8px',
          fontWeight: 500,
          marginBottom: '24px',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['pending', 'approved', 'rejected', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: filter === status ? '#ffffff' : 'var(--color-forest-floor)',
              color: filter === status ? '#02090a' : 'var(--color-tide-pool)',
              border: '1px solid',
              borderColor: filter === status ? '#ffffff' : 'var(--color-iron-veil)',
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'capitalize',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Queue Items List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(n => <div key={n} style={{ height: '140px', backgroundColor: 'var(--color-forest-floor)' }} className="skeleton" />)}
        </div>
      ) : queue.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '64px 20px', 
          border: '1px dashed var(--color-border-steel)', 
          borderRadius: '12px',
          backgroundColor: 'var(--color-gunmetal-dark)' 
        }}>
          <ShieldCheck size={40} color="var(--color-icy-steel)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff', marginBottom: '8px' }}>
            Queue is clear
          </h3>
          <p style={{ color: 'var(--color-steel-mist)', fontSize: '0.875rem' }}>
            No agent mutations are currently pending for {filter} approval.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {queue.map((item) => {
            const payload = typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : item.payload;

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: 'var(--color-forest-floor)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-iron-veil)',
                  padding: '22px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {item.item_type.replace('_', ' ')}
                    </span>
                    {getRiskBadge(item.risk_level)}
                    <span className="status-pill status-draft" style={{ fontSize: '11px' }}>
                      {item.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
                    Generated: {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Payload Preview */}
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-deep-canopy)',
                  border: '1px solid var(--color-iron-veil)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  lineHeight: 1.6
                }}>
                  {item.item_type === 'listing_draft' && (
                    <div>
                      <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                        Draft Title: {payload.draft_title || payload.title}
                      </div>
                      <div style={{ color: 'var(--color-tide-pool)' }}>
                        Suggested Price: <strong style={{ color: '#ffffff' }}>₹{payload.suggested_price || payload.price}</strong> • Category: {payload.category || 'General'}
                      </div>
                    </div>
                  )}

                  {item.item_type === 'support_reply' && (
                    <div>
                      <div style={{ fontWeight: 600, color: '#f87171', marginBottom: '6px' }}>
                        Customer Query: {payload.customer_query || 'Inquiry regarding product return/refund'}
                      </div>
                      <div style={{ fontStyle: 'italic', color: 'var(--color-tide-pool)' }}>
                        "Draft Response: {payload.draft_response || payload.draft_preview}"
                      </div>
                    </div>
                  )}

                  {item.item_type === 'inventory_advisory' && (
                    <div>
                      <div style={{ fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                        Stock Depletion Advisory ({payload.days_left} Days Runway Left)
                      </div>
                      <div style={{ color: 'var(--color-tide-pool)' }}>
                        Recommended Reorder: <strong style={{ color: '#ffffff' }}>{payload.reorder} units</strong>. {payload.reasoning}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons (if pending) */}
                {item.status === 'pending' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                    <button
                      onClick={() => handleReject(item.id)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '9999px',
                        backgroundColor: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: 500,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={14} /> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(item.id)}
                      style={{
                        padding: '7px 20px',
                        borderRadius: '9999px',
                        backgroundColor: '#ffffff',
                        color: '#02090a',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={14} /> Approve & Commit
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerApprovalsPage;
