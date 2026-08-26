import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';

/* ─── DESIGN.MD — Seller Performance Analytics ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────────────────── */

const fmt = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 });

export default function SellerAnalytics({ token }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const res = await apiFetch('/seller/analytics?days=30', {}, token);
      setData(res);
    } catch (err) {
      showToast(err.message || 'Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAnalytics(); }, [token]);

  if (loading && !data) return <SpinnerPage message="Aggregating performance insights…" />;
  if (!data) return <div style={{ color: '#ffffff', textAlign: 'center', padding: 80, fontFamily: "'Inter', sans-serif" }}>Failed to load analytics.</div>;

  const maxDailyRevenue = Math.max(...(data.daily_revenue || []).map(d => d.revenue), 1);

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', letterSpacing: '0.36px', lineHeight: 1.2, marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
            Performance Analytics
          </h1>
          <p style={{ color: '#71717a', fontSize: 15, fontWeight: 420, fontFeatureSettings: '"ss03"' }}>
            Revenue velocity, order volume, and category distribution for the last {data.period || '30 days'}.
          </p>
        </div>
        <button
          onClick={loadAnalytics}
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
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Gross Revenue', value: fmt(data.total_revenue || 0), sub: 'Across all SKUs' },
          { label: 'Orders Completed', value: (data.total_orders || 0).toLocaleString(), sub: 'Fulfillment throughput' },
          { label: 'Average Order Value', value: fmt(data.avg_order_value || 0), sub: 'Per transaction basket' },
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
            <div style={{ fontSize: 28, fontWeight: 400, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 12, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
              {stat.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Trend Chart Card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '28px',
        marginBottom: 24,
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 24, fontFeatureSettings: '"ss03"' }}>
          Daily Revenue Trend
        </h2>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: 180,
          gap: 6,
          paddingBottom: 12,
          borderBottom: '1px solid #1e2c31',
        }}>
          {(data.daily_revenue || []).map((d, i) => {
            const heightPct = (d.revenue / maxDailyRevenue) * 100;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  height: '100%',
                }}
                title={`${d.date}: ${fmt(d.revenue)} (${d.orders} orders)`}
              >
                <div
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    height: `${Math.max(heightPct, 3)}%`,
                    borderRadius: '3px 3px 0 0',
                    opacity: 0.85,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown Card */}
      {data.revenue_by_category?.length > 0 && (
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: '28px',
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 20, fontFeatureSettings: '"ss03"' }}>
            Revenue by Category
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.revenue_by_category.map((cat, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontFeatureSettings: '"ss03"' }}>{cat.category}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>{fmt(cat.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
