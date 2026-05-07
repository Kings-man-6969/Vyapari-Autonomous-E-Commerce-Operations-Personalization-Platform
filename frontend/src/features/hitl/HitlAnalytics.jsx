import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import StatCard from '@/shared/components/StatCard'
import Spinner from '@/shared/components/Spinner'

export default function HitlAnalytics({ token }) {
  const toast = useToast()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/hitl/analytics', {}, token)
      .then(setAnalytics)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size="lg" /></div>
  }

  if (!analytics) return null

  const approvalRate   = Number(analytics.approval_rate || 0)
  const rejectionRate  = Number(analytics.rejection_rate || 0)
  const avgWaitSec     = Math.round((analytics.avg_wait_time_ms || 0) / 1000)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="HITL Analytics"
        description="Aggregate metrics on human-in-the-loop decision outcomes and processing performance."
      />

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Approval Rate" value={`${approvalRate.toFixed(1)}%`} variant="success" sub="Of all resolved decisions" />
        <StatCard label="Rejection Rate" value={`${rejectionRate.toFixed(1)}%`} variant={rejectionRate > 40 ? 'danger' : 'warning'} sub="Of all resolved decisions" />
        <StatCard label="Avg Wait Time" value={`${avgWaitSec}s`} variant="info" sub="From creation to resolution" />
      </div>

      {/* Visual breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Approval vs Rejection chart */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20 }}>
            Outcome Distribution
          </h3>

          <RateBar label="Approved" pct={approvalRate} color="var(--c-success)" colorClass="success" />
          <div style={{ marginBottom: 16 }} />
          <RateBar label="Rejected" pct={rejectionRate} color="var(--c-danger)" colorClass="danger" />
          <div style={{ marginBottom: 16 }} />
          <RateBar label="Pending / Other" pct={Math.max(0, 100 - approvalRate - rejectionRate)} color="var(--c-neutral)" colorClass="primary" />
        </div>

        {/* Summary stats card */}
        <div className="card">
          <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20 }}>
            Performance Summary
          </h3>

          {[
            { label: 'Decisions Approved', value: `${approvalRate.toFixed(1)}%`, color: 'var(--c-success)' },
            { label: 'Decisions Rejected', value: `${rejectionRate.toFixed(1)}%`, color: 'var(--c-danger)' },
            { label: 'Average Resolution Time', value: `${avgWaitSec}s`, color: 'var(--c-info)' },
            { label: 'Raw Wait Time (ms)', value: `${analytics.avg_wait_time_ms ?? 0}ms`, color: 'var(--c-text-muted)' },
          ].map((row) => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--c-border)' }}>
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-muted)' }}>{row.label}</span>
              <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: row.color, fontFamily: 'var(--font-mono)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RateBar({ label, pct, color, colorClass }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text)' }}>{label}</span>
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="progress-bar" style={{ height: 10 }}>
        <div className={`progress-fill ${colorClass}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
