import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/services/api';
import { useToast } from '@/shared/hooks/useToast';
import PageHeader from '@/shared/components/PageHeader';
import StatCard from '@/shared/components/StatCard';
import { SpinnerPage } from '@/shared/components/Spinner';

/* ─── DESIGN.MD — Seller Finance ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────── */

export default function SellerFinance({ token }) {
  const { showToast } = useToast();
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadFinance() {
    setLoading(true);
    try {
      const data = await apiFetch('/seller/finance', {}, token);
      setFinance(data);
    } catch (e) {
      showToast(e.message || 'Failed to load finance records', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadFinance(); }, [token]);

  if (loading) return <SpinnerPage message="Loading financial ledger…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Financial Dashboard"
        description="Track revenue reconciliation, settlements, and transactional ledger."
        action={
          <button
            onClick={loadFinance}
            style={{
              padding: '8px 18px',
              borderRadius: 9999,
              background: 'transparent',
              border: '1px solid #1e2c31',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 420,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.18s',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; }}
          >
            <span>↻</span>
            <span>Refresh</span>
          </button>
        }
      />

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard
          label="Total Settled Revenue"
          value={`₹${Number(finance?.total_revenue || 0).toFixed(2)}`}
          sub="Disbursed earnings"
          variant="success"
        />
        <StatCard
          label="Pending Settlement Payout"
          value={`₹${Number(finance?.pending_payout || 0).toFixed(2)}`}
          sub="Next scheduled tranche"
          variant="warning"
        />
      </div>

      {/* Transaction History Card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2c31' }}>
          <h2 style={{ fontSize: 18, margin: 0, fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
            Transaction History
          </h2>
        </div>

        {!finance?.recent_transactions?.length ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>
            No recent ledger transactions recorded.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid #1e2c31' }}>
                  <th style={thStyle}>Transaction Ref</th>
                  <th style={thStyle}>Type</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={thStyle}>Order Ref</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Description</th>
                </tr>
              </thead>
              <tbody>
                {finance.recent_transactions.map((t, idx) => (
                  <tr
                    key={t.transaction_id || idx}
                    style={{
                      borderBottom: idx < finance.recent_transactions.length - 1 ? '1px solid #1e2c31' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px 24px', color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                      #{t.transaction_id?.slice(0, 8)?.toUpperCase()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 9999,
                        fontSize: 11,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        background: t.transaction_type === 'sale' ? 'rgba(193,251,212,0.15)' : 'rgba(254,226,226,0.15)',
                        color: t.transaction_type === 'sale' ? '#c1fbd4' : '#fee2e2',
                        fontFeatureSettings: '"ss03"',
                      }}>
                        {t.transaction_type}
                      </span>
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      textAlign: 'right',
                      fontWeight: 500,
                      color: t.transaction_type === 'sale' ? '#c1fbd4' : '#ffffff',
                      fontFeatureSettings: '"ss03"',
                    }}>
                      {t.transaction_type === 'sale' ? '+' : '-'}₹{Number(t.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
                      {t.order_id ? `#${t.order_id.slice(0, 8).toUpperCase()}` : '—'}
                    </td>
                    <td style={{ padding: '16px 24px', color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                      {new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.7)', fontFeatureSettings: '"ss03"' }}>
                      {t.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
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
