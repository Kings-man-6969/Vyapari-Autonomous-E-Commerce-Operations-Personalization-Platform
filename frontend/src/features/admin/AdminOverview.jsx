import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import PageHeader from '../../shared/components/PageHeader';
import StatCard from '../../shared/components/StatCard';

/* ─── DESIGN.MD — Admin Overview ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────── */

export default function AdminOverview({ token }) {
  const { showToast } = useToast();
  const [users, setUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const u = await apiFetch('/admin/users', {}, token);
      setUsers(u.length || 0);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [token]);

  if (loading) return <SpinnerPage message="Loading ecosystem metrics…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Platform Vitals"
        description="Global system telemetry, platform-wide gross volume, and operational uptime."
        action={
          <button
            onClick={loadData}
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

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Registered Users" value={users.toLocaleString()} sub="Buyers, sellers & ops" />
        <StatCard label="Active Sellers" value="42" sub="Verified merchant stores" />
        <StatCard label="Monthly GMV" value="₹1,42,500" sub="Catalog gross throughput" variant="teal" />
        <StatCard label="Fulfillment Velocity" value="3,812" sub="Orders processed this month" />
      </div>

      {/* Analytics Card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '48px 32px',
        textAlign: 'center',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚡</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
          Autonomous Multi-Tenant Architecture
        </h2>
        <p style={{ color: '#71717a', fontSize: 14, maxWidth: 540, margin: '0 auto', lineHeight: 1.6, fontFeatureSettings: '"ss03"' }}>
          The underlying orchestrator handles distributed agent state, real-time catalog events, and dynamic margin optimization across all active tenants.
        </p>
      </div>
    </div>
  );
}
