import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/services/api';
import { useToast } from '@/shared/hooks/useToast';
import PageHeader from '@/shared/components/PageHeader';
import StatCard from '@/shared/components/StatCard';
import Spinner from '@/shared/components/Spinner';

/* ─── DESIGN.MD — HITL Analytics ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────── */

export default function HitlAnalytics({ token }) {
  const { showToast } = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/hitl/analytics', {}, token)
      .then(setAnalytics)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size="lg" /></div>;
  if (!analytics) return null;

  const approvalRate  = Number(analytics.approval_rate || 0);
  const rejectionRate = Number(analytics.rejection_rate || 0);
  const avgWaitSec    = Math.round((analytics.avg_wait_time_ms || 0) / 1000);

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Oversight Analytics"
        description="Statistical aggregate metrics on autonomous approval velocity, rejection frequency, and latency."
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Approval Rate" value={`${approvalRate.toFixed(1)}%`} variant="success" sub="Resolved decisions" />
        <StatCard label="Rejection Rate" value={`${rejectionRate.toFixed(1)}%`} variant={rejectionRate > 40 ? 'danger' : 'warning'} sub="Resolved decisions" />
        <StatCard label="Mean Queue Latency" value={`${avgWaitSec}s`} variant="info" sub="Creation to resolution" />
      </div>

      {/* Visual breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        
        {/* Outcome distribution card */}
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: '24px',
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#ffffff', marginBottom: 20, fontFeatureSettings: '"ss03"' }}>
            Outcome Distribution
          </h2>

          <RateBar label="Approved Proposals" pct={approvalRate} color="#c1fbd4" />
          <div style={{ marginBottom: 16 }} />
          <RateBar label="Rejected Overrides" pct={rejectionRate} color="#fee2e2" />
          <div style={{ marginBottom: 16 }} />
          <RateBar label="Auto-Executed / Other" pct={Math.max(0, 100 - approvalRate - rejectionRate)} color="rgba(255,255,255,0.5)" />
        </div>

        {/* Summary stats card */}
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: '24px',
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#ffffff', marginBottom: 20, fontFeatureSettings: '"ss03"' }}>
            Performance Metrics
          </h2>

          {[
            { label: 'Approval Ratio', value: `${approvalRate.toFixed(1)}%`, color: '#c1fbd4' },
            { label: 'Rejection Ratio', value: `${rejectionRate.toFixed(1)}%`, color: '#fee2e2' },
            { label: 'Average Resolution Time', value: `${avgWaitSec}s`, color: '#ffffff' },
            { label: 'Raw Processing Duration', value: `${analytics.avg_wait_time_ms ?? 0}ms`, color: '#71717a' },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid #1e2c31',
              }}
            >
              <span style={{ fontSize: 13, color: '#71717a', fontFeatureSettings: '"ss03"' }}>{row.label}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: row.color, fontFeatureSettings: '"ss03"' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RateBar({ label, pct, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFeatureSettings: '"ss03"' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color, fontFeatureSettings: '"ss03"' }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: '#121212', borderRadius: 9999, overflow: 'hidden', border: '1px solid #1e2c31' }}>
        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}
