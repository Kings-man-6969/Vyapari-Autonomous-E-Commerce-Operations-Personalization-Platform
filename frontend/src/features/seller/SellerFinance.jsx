import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import StatCard from '@/shared/components/StatCard'
import { SpinnerPage } from '@/shared/components/Spinner'

export default function SellerFinance({ token }) {
  const toast = useToast()
  const [finance, setFinance] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadFinance() {
    setLoading(true)
    try {
      const data = await apiFetch('/seller/finance', {}, token)
      setFinance(data)
    } catch (e) {
      toast.error(e.message || "Failed to load finance data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadFinance() }, [token])

  if (loading) return <SpinnerPage message="Loading financial records..." />

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Financial Dashboard" 
        description="Track your revenue, payouts, and transaction history."
        action={
          <button onClick={loadFinance} className="btn btn-secondary btn-sm">
            Refresh
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 36 }}>
        <StatCard 
          label="Total Revenue" 
          value={`₹${finance?.total_revenue?.toFixed(2) || '0.00'}`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          variant="success" 
        />
        <StatCard 
          label="Pending Payout" 
          value={`₹${finance?.pending_payout?.toFixed(2) || '0.00'}`}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
          variant="warning" 
        />
      </div>

      <div className="surface-card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: 18, margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Transaction History</h2>
        </div>
        {!finance?.recent_transactions?.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No recent transactions found.
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {finance.recent_transactions.map(t => (
                  <tr key={t.transaction_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.transaction_id}</td>
                    <td>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        background: t.transaction_type === 'sale' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
                        color: t.transaction_type === 'sale' ? '#10b981' : '#ef4444'
                      }}>
                        {t.transaction_type}
                      </span>
                    </td>
                    <td style={{ color: t.transaction_type === 'sale' ? '#10b981' : 'var(--color-text-primary)' }}>
                      {t.transaction_type === 'sale' ? '+' : '-'}₹{t.amount.toFixed(2)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.order_id || '-'}</td>
                    <td>{new Date(t.created_at).toLocaleString()}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
