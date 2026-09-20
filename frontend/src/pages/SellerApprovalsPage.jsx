import React, { useState, useEffect } from 'react';
import { Bot, Check, X, AlertTriangle, ShieldCheck, Sparkles, Clock } from 'lucide-react';
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
        return <span className="badge badge-error">HIGH RISK</span>;
      case 'medium':
        return <span className="badge badge-warning">MEDIUM RISK</span>;
      default:
        return <span className="badge badge-success">LOW RISK</span>;
    }
  };

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '32px' }}>
        <div className="badge badge-primary" style={{ marginBottom: '8px' }}>
          <Bot size={14} style={{ marginRight: '4px' }} />
          Team B Human-in-the-Loop Engine
        </div>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800 }}>
          Agent Approval Queue
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
          Every AI agent draft must be explicitly approved by you before touching live catalog or customer communications.
        </p>
      </div>

      {actionNotice && (
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          marginBottom: '24px',
          fontSize: 'var(--font-size-sm)'
        }}>
          {actionNotice}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        {['pending', 'approved', 'rejected', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: filter === status ? 'var(--color-text-primary)' : 'var(--color-surface-subtle)',
              color: filter === status ? '#ffffff' : 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Queue Items List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map(n => <div key={n} style={{ height: '140px' }} className="skeleton" />)}
        </div>
      ) : queue.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', border: '1px dashed var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <ShieldCheck size={48} color="var(--color-success)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: '8px' }}>Queue is clean</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            No agent actions are currently waiting for {filter} approval.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {queue.map((item) => {
            const payload = typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : item.payload;

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-card)',
                  padding: '24px',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: 'var(--font-size-base)', textTransform: 'uppercase' }}>
                      {item.item_type.replace('_', ' ')}
                    </span>
                    {getRiskBadge(item.risk_level)}
                    <span className="badge" style={{ backgroundColor: 'var(--color-surface-subtle)' }}>
                      Status: {item.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    Generated: {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Payload Preview */}
                <div style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-sm)',
                  lineHeight: 1.6
                }}>
                  {item.item_type === 'listing_draft' && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>Draft Title: {payload.draft_title || payload.title}</div>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        Suggested Price: <strong>₹{payload.suggested_price || payload.price}</strong> • Category: {payload.category || 'General'}
                      </div>
                    </div>
                  )}

                  {item.item_type === 'support_reply' && (
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--color-error)', marginBottom: '6px' }}>
                        Customer Issue: {payload.customer_query || 'Inquiry regarding product return/refund'}
                      </div>
                      <div style={{ fontStyle: 'italic', color: 'var(--color-text-primary)' }}>
                        "Draft Response: {payload.draft_response || payload.draft_preview}"
                      </div>
                    </div>
                  )}

                  {item.item_type === 'inventory_advisory' && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                        Stock Depletion Alert ({payload.days_left} Days Left)
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)' }}>
                        Recommended Reorder: <strong>{payload.reorder} units</strong>. {payload.reasoning}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons (if pending) */}
                {item.status === 'pending' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                    <button
                      onClick={() => handleReject(item.id)}
                      className="btn-outline"
                      style={{ color: 'var(--color-error)', borderColor: 'var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}
                    >
                      <X size={16} /> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="btn-primary"
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    >
                      <Check size={16} /> Approve & Execute
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
