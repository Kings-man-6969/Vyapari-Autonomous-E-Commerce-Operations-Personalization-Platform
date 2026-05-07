import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import Badge, { statusVariant } from '@/shared/components/Badge'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'

const FILTERS = ['all', 'approved', 'rejected', 'auto_executed']

export default function HitlHistory({ token }) {
  const toast = useToast()
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    apiFetch('/hitl/history', {}, token)
      .then((payload) => setDecisions(payload.decisions || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [token])

  const filtered = filter === 'all'
    ? decisions
    : decisions.filter((d) => d.decision_status === filter)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Decision History"
        description="Full audit trail of all resolved HITL decisions. Filter by outcome to investigate patterns."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {FILTERS.map((f) => {
          const active = filter === f
          const count = f === 'all' ? decisions.length : decisions.filter(d => d.decision_status === f).length
          return (
            <button key={f} onClick={() => setFilter(f)} className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} style={{ textTransform: 'capitalize' }}>
              {f.replace('_', ' ')}
              <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 'var(--radius-full)', background: active ? 'rgba(255,255,255,0.2)' : 'var(--c-surface-3)', fontSize: 10, fontWeight: 700 }}>{count}</span>
            </button>
          )
        })}
      </div>

      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
        : filtered.length === 0
          ? <EmptyState title="No history found" description="No decisions match the selected filter." />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((d) => {
                const dotColors = { approved: 'var(--c-success)', rejected: 'var(--c-danger)', auto_executed: 'var(--c-primary)' }
                return (
                  <div key={d.decision_id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColors[d.decision_status] || 'var(--c-neutral)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <Link to={`/hitl/decision/${d.decision_id}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', color: 'var(--c-primary-light)', fontWeight: 700 }}>
                          {d.decision_id}
                        </Link>
                        <Badge variant={statusVariant(d.decision_status)}>{d.decision_status}</Badge>
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-muted)' }}>
                        {d.decision_type}{d.approval_reason ? ` · ${d.approval_reason}` : ''}
                      </div>
                    </div>
                    {d.updated_at && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-faint)', whiteSpace: 'nowrap' }}>{new Date(d.updated_at).toLocaleDateString()}</div>}
                  </div>
                )
              })}
            </div>
          )
      }
    </div>
  )
}
