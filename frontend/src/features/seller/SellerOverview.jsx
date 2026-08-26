import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/services/api';
import StatCard from '@/shared/components/StatCard';
import PageHeader from '@/shared/components/PageHeader';
import { SpinnerPage } from '@/shared/components/Spinner';

/* ─── DESIGN.MD — Seller Overview ───
   Canvas: #000000 · Cards: #0a0a0a · Border: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────── */

export default function SellerOverview({ token }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/seller/stats', {}, token);
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStats(); }, [token]);

  if (loading) return <SpinnerPage message="Loading operational metrics…" />;

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '18px 24px',
        borderRadius: 12,
        background: 'rgba(254,226,226,0.1)',
        border: '1px solid rgba(254,226,226,0.25)',
        color: '#fee2e2',
        marginBottom: 24,
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
      }} role="alert">
        <span style={{ fontSize: 18, marginTop: 1 }}>⚠</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500, marginBottom: 4, color: '#ffffff' }}>Failed to load dashboard data</div>
          <div style={{ fontSize: 13, color: '#fee2e2' }}>{error}</div>
        </div>
        <button
          onClick={loadStats}
          style={{
            padding: '6px 16px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid #fee2e2',
            color: '#fee2e2',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const criticalCount = stats?.critical_stock ?? stats?.critical_stock_items ?? 0;
  const warningCount = stats?.warning_stock ?? stats?.stock_warning_items ?? 0;
  const pendingDecisions = stats?.pending_decisions ?? stats?.pending_agent_decisions ?? 0;
  const pendingReviews = stats?.pending_reviews ?? 0;
  const escalatedReviews = stats?.escalated_reviews ?? 0;

  const kpis = [
    { label: 'Total Products',    value: stats?.total_products ?? 0, icon: <BoxIcon />,    variant: 'teal' },
    { label: 'Critical Stock',    value: criticalCount,             icon: <AlertIcon />,  variant: criticalCount > 0 ? 'danger' : 'success',  sub: '< 5 units' },
    { label: 'Stock Warnings',    value: warningCount,              icon: <WarnIcon />,   variant: warningCount > 0 ? 'warning' : 'success', sub: '5–20 units' },
    { label: 'Pending Decisions', value: pendingDecisions,          icon: <QueueIcon />,  variant: pendingDecisions > 0 ? 'warning' : 'success', sub: 'Awaiting HITL' },
    { label: 'Pending Reviews',   value: pendingReviews,            icon: <StarIcon />,   variant: pendingReviews > 0 ? 'info' : 'success',          sub: 'Needs response' },
    { label: 'Escalated Reviews', value: escalatedReviews,          icon: <FlagIcon />,   variant: escalatedReviews > 0 ? 'danger' : 'success',      sub: 'Negative sentiment' },
  ];

  const quickLinks = [
    { to: '/seller/inventory',    label: 'Inventory',     desc: 'Stock levels & listings',  icon: <BoxIcon /> },
    { to: '/seller/pricing',      label: 'Pricing',       desc: 'Dynamic AI algorithms',    icon: <TagIcon /> },
    { to: '/seller/orders',       label: 'Orders',        desc: 'Fulfillment & status',     icon: <OrderIcon /> },
    { to: '/seller/reviews',      label: 'Reviews',       desc: 'Customer sentiment triage',icon: <StarIcon /> },
    { to: '/seller/analytics',    label: 'Analytics',     desc: 'Revenue & velocity metrics',icon: <ChartIcon /> },
    { to: '/hitl',                label: 'HITL Queue',    desc: 'Autonomous oversight',     icon: <BrainIcon /> },
    { to: '/seller/products/add', label: 'Add Product',   desc: 'Create new catalog item',  icon: <PlusIcon /> },
    { to: '/seller/settings',     label: 'Settings',      desc: 'Store configuration',      icon: <GearIcon /> },
  ];

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Dashboard"
        description="Real-time snapshot of inventory health, AI decision queues, and catalog velocity."
        action={
          <button
            onClick={loadStats}
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
            <RefreshIcon />
            <span>Refresh</span>
          </button>
        }
      />

      {/* KPI Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 48,
      }}>
        {kpis.map(k => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={k.icon}
            variant={k.variant}
            sub={k.sub}
          />
        ))}
      </div>

      {/* Quick Navigation section */}
      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 400,
          color: '#71717a',
          letterSpacing: '0.72px',
          textTransform: 'uppercase',
          marginBottom: 16,
          fontFeatureSettings: '"ss03"',
        }}>
          Quick Navigation
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {quickLinks.map(item => (
            <Link
              key={item.to}
              to={item.to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '20px',
                borderRadius: 12,
                border: '1px solid #1e2c31',
                background: '#0a0a0a',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = '#121212';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#1e2c31';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = '#0a0a0a';
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 9999,
                background: '#141414',
                border: '1px solid #1e2c31',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{
                  fontWeight: 500,
                  color: '#ffffff',
                  fontSize: 15,
                  marginBottom: 2,
                  fontFeatureSettings: '"ss03"',
                }}>
                  {item.label}
                </div>
                <div style={{
                  color: '#71717a',
                  fontSize: 13,
                  fontFeatureSettings: '"ss03"',
                }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function RefreshIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>; }
function BoxIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>; }
function AlertIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>; }
function WarnIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>; }
function QueueIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>; }
function StarIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }
function FlagIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>; }
function TagIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l7.72-7.72a1 1 0 0 0 0-1.41z"/><path d="M7 7h.01"/></svg>; }
function OrderIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>; }
function ChartIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>; }
function BrainIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>; }
function PlusIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>; }
function GearIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>; }
