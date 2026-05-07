import React from 'react'
import PageHeader from '@/shared/components/PageHeader'
import StatCard from '@/shared/components/StatCard'

export default function AdminOverview() {
  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Platform Health" 
        description="High-level metrics across the entire platform."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 36 }}>
        <StatCard label="Total Users" value="1,245" variant="primary" />
        <StatCard label="Total Sellers" value="84" variant="primary" />
        <StatCard label="Monthly GMV" value="₹45,200" variant="success" />
        <StatCard label="Active Orders" value="142" variant="warning" />
      </div>

      <div className="surface-card">
        <div style={{ padding: '20px 24px' }}>
          <h2 style={{ fontSize: 18, margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Analytics Under Construction</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            Detailed charts and GMV graphs will be available in a future update.
          </p>
        </div>
      </div>
    </div>
  )
}
