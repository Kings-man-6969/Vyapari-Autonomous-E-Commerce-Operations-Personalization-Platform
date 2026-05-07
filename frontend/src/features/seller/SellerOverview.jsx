import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import StatCard from '@/shared/components/StatCard'
import PageHeader from '@/shared/components/PageHeader'
import { SpinnerPage } from '@/shared/components/Spinner'

/*
  SELLER OVERVIEW — Space Grotesk headings, JetBrains Mono data values
  Cool slate/teal palette, operational clarity
*/

export default function SellerOverview({ token }) {
  const [stats, setStats]   = useState(null)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(true)

  async function loadStats() {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/stats', {}, token)
      setStats(data)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadStats() }, [token])

  if (loading) return <SpinnerPage message="Loading dashboard…" />

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 18px', borderRadius: 'var(--r-lg)',
        background: 'var(--color-alert-bg)',
        border: '1px solid rgba(239,68,68,.2)',
        color: 'var(--color-alert)', fontWeight: 600, marginBottom: 24,
      }} role="alert">
        <span style={{ fontSize: 20, marginTop: 1 }}>⚠</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Failed to load dashboard</div>
          <div style={{ fontSize: 'var(--fs-sm)', opacity: .8 }}>{error}</div>
        </div>
        <button onClick={loadStats} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>Retry</button>
      </div>
    )
  }

  const kpis = [
    { label: 'Total Products',     value: stats?.total_products ?? 0,          icon: <BoxIcon />,     variant: 'primary' },
    { label: 'Critical Stock',     value: stats?.critical_stock_items ?? 0,    icon: <AlertIcon />,   variant: stats?.critical_stock_items > 0 ? 'danger' : 'success',   sub: '< 5 units' },
    { label: 'Stock Warnings',     value: stats?.stock_warning_items ?? 0,     icon: <WarningIcon />, variant: stats?.stock_warning_items > 0 ? 'warning' : 'success',   sub: '5–20 units' },
    { label: 'Pending Decisions',  value: stats?.pending_agent_decisions ?? 0, icon: <QueueIcon />,   variant: stats?.pending_agent_decisions > 0 ? 'warning' : 'success', sub: 'Awaiting HITL' },
    { label: 'Pending Reviews',    value: stats?.pending_reviews ?? 0,         icon: <StarIcon />,    variant: stats?.pending_reviews > 0 ? 'info' : 'success',           sub: 'Needs response' },
    { label: 'Escalated Reviews',  value: stats?.escalated_reviews ?? 0,       icon: <FlagIcon />,    variant: stats?.escalated_reviews > 0 ? 'danger' : 'success',       sub: 'Negative sentiment' },
  ]

  const quickLinks = [
    { to: '/seller/inventory', label: 'Manage Inventory', desc: 'Stock levels, pricing, SKUs', icon: <BoxIcon /> },
    { to: '/seller/pricing',   label: 'Update Pricing',   desc: 'Set prices and view history', icon: <TagIcon /> },
    { to: '/seller/orders',    label: 'Order Management', desc: 'Process and ship orders',     icon: <BoxIcon /> },
    { to: '/seller/finance',   label: 'Finances',         desc: 'View payouts and revenue',    icon: <TagIcon /> },
    { to: '/seller/reviews',   label: 'Review Manager',   desc: 'Respond to customer feedback', icon: <StarIcon /> },
    { to: '/seller/agent',     label: 'AI Assistant',     desc: 'Command your store agent',    icon: <QueueIcon /> },
    { to: '/hitl',             label: 'HITL Queue',       desc: 'Approve or reject AI decisions', icon: <QueueIcon /> },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Real-time snapshot of inventory health, AI decisions, and review queue."
        action={
          <button onClick={loadStats} className="btn btn-secondary btn-sm">
            <RefreshIcon /> Refresh
          </button>
        }
      />

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 36 }} className="stagger-children">
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} variant={k.variant} sub={k.sub} />
        ))}
      </div>

      {/* Quick nav */}
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-faint)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14, fontFamily: 'var(--font-mono)' }}>
          Quick Navigation
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-surface)',
                textDecoration: 'none',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(13,148,136,.35)'; e.currentTarget.style.background = 'rgba(13,148,136,.06)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg-surface)' }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 'var(--r-md)',
                background: 'rgba(13,148,136,.1)', border: '1px solid rgba(13,148,136,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#14b8a6', flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)', marginBottom: 2, fontFamily: 'var(--font-display)' }}>{item.label}</div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--fs-xs)', fontFamily: 'var(--font-display)' }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function RefreshIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> }
function BoxIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg> }
function AlertIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg> }
function WarningIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg> }
function QueueIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg> }
function StarIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> }
function FlagIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg> }
function TagIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.72-7.72a1 1 0 0 0 0-1.41z"/><path d="M7 7h.01"/></svg> }
