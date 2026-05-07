import React from 'react'
import PageHeader from '@/shared/components/PageHeader'
import EmptyState from '@/shared/components/EmptyState'

export default function AdminModeration() {
  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Moderation Queue" 
        description="Review flagged products, reviews, and disputes."
      />

      <div className="surface-card" style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <EmptyState 
          title="Queue is empty" 
          description="There are no items awaiting moderation at this time." 
          icon="🛡️" 
        />
      </div>
    </div>
  )
}
