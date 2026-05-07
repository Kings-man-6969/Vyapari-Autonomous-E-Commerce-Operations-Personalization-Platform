import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Badge, { riskVariant, statusVariant } from '@/shared/components/Badge'
import Spinner from '@/shared/components/Spinner'

/*
  HITL DECISION DETAIL
  Typography: Newsreader for narrative, IBM Plex Mono for IDs/scores/timestamps
  Dark-mode, audit-trail aesthetic, high-contrast actions
*/

function MetaRow({ label, value, mono = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--color-border)', gap: 16 }}>
      <dt style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
        {label}
      </dt>
      <dd style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right', fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Newsreader', Georgia, serif" }}>
        {value}
      </dd>
    </div>
  )
}

export default function HitlDecisionDetail({ token }) {
  const { decisionId } = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const [decision, setDecision]   = useState(null)
  const [loading, setLoading]     = useState(true)
  const [actioning, setActioning] = useState(false)

  useEffect(() => {
    apiFetch(`/hitl/decisions/${decisionId}`, {}, token)
      .then(setDecision)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [decisionId, token])

  async function handleApprove() {
    setActioning(true)
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/approve`, { method: 'POST', body: JSON.stringify({ approver_id: 'USR_ADMIN_001' }) }, token)
      toast.success('Decision approved.')
      navigate('/hitl')
    } catch (err) { toast.error(err.message) }
    finally { setActioning(false) }
  }

  async function handleReject() {
    setActioning(true)
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/reject`, { method: 'POST', body: JSON.stringify({ approver_id: 'USR_ADMIN_001', reason: 'Business override' }) }, token)
      toast.info('Decision rejected.')
      navigate('/hitl')
    } catch (err) { toast.error(err.message) }
    finally { setActioning(false) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner size="lg" /></div>

  if (!decision) return (
    <div style={{ textAlign: 'center', padding: 64, color: 'var(--color-text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
      <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8, fontSize: 18 }}>Decision not found</div>
      <Link to="/hitl" className="btn btn-secondary btn-sm">← Back to Queue</Link>
    </div>
  )

  const isPending = decision.decision_status === 'pending'
  const riskBorderColor = { high: '#f59e0b', medium: '#3b82f6', low: '#14b8a6' }[decision.risk_level] || '#64748b'
  const confidence = Number(decision.confidence_score || 0)

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <Link to="/hitl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 500, textDecoration: 'none', marginBottom: 20, fontFamily: "'IBM Plex Mono', monospace" }}>
        ← Back to Queue
      </Link>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 20, borderLeft: `4px solid ${riskBorderColor}`, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: 'var(--color-text-faint)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Decision ID
            </div>
            <h2 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 12, wordBreak: 'break-all' }}>
              {decision.decision_id}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge variant={statusVariant(decision.decision_status)}>{decision.decision_status}</Badge>
              <Badge variant={riskVariant(decision.risk_level)}>{decision.risk_level} risk</Badge>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: confidence >= 0.75 ? '#14b8a6' : confidence >= 0.5 ? '#60a5fa' : '#fbbf24', padding: '2px 8px', background: 'rgba(255,255,255,.04)', borderRadius: 4, border: '1px solid rgba(255,255,255,.08)' }}>
                conf: {confidence.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          {isPending && (
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              {actioning
                ? <Spinner size="md" />
                : (
                  <>
                    <button
                      onClick={handleApprove}
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--r-md)',
                        background: 'rgba(20,184,166,.1)', border: '1px solid rgba(20,184,166,.35)',
                        color: '#14b8a6', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace",
                        display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,184,166,.2)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(20,184,166,.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,184,166,.1)'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      <CheckIcon /> APPROVE
                    </button>
                    <button
                      onClick={handleReject}
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--r-md)',
                        background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)',
                        color: '#f87171', fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace",
                        display: 'flex', alignItems: 'center', gap: 6,
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.16)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,.08)' }}
                    >
                      <XIcon /> REJECT
                    </button>
                  </>
                )
              }
            </div>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 18 }}>
        <div className="card">
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace" }}>
            Decision Info
          </h3>
          <dl>
            <MetaRow label="Product"  value={decision.product_id}   mono />
            <MetaRow label="Agent"    value={decision.agent_type} />
            <MetaRow label="Type"     value={decision.decision_type} />
            <MetaRow label="Status"   value={<Badge variant={statusVariant(decision.decision_status)}>{decision.decision_status}</Badge>} />
          </dl>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace" }}>
            Risk Assessment
          </h3>
          <dl>
            <MetaRow label="Risk Level"  value={<Badge variant={riskVariant(decision.risk_level)}>{decision.risk_level}</Badge>} />
            <MetaRow label="Confidence"  value={
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 16, color: confidence >= 0.75 ? '#14b8a6' : confidence >= 0.5 ? '#60a5fa' : '#fbbf24' }}>
                {confidence.toFixed(2)}
              </span>
            } />
            {decision.approval_reason && <MetaRow label="Resolution" value={decision.approval_reason} />}
          </dl>
        </div>
      </div>

      {/* Proposed action — audit-log style */}
      <div className="card">
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: "'IBM Plex Mono', monospace" }}>
          Proposed Action
        </h3>
        <div style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--sp-4)',
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 13,
          color: '#60a5fa',
          lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {decision.proposed_action || '— No proposed action data —'}
        </div>
      </div>
    </div>
  )
}

function CheckIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> }
function XIcon()     { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg> }
