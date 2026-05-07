import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import StatCard from '@/shared/components/StatCard'
import Badge, { riskVariant, statusVariant } from '@/shared/components/Badge'
import Spinner from '@/shared/components/Spinner'

/*
  HITL DECISION QUEUE
  ─────────────────────────────────────────────────────
  Display font : Newsreader (editorial authority)
  Data font    : IBM Plex Mono (audit-grade precision)
  Colors       : Charcoal bg, amber escalations, green approve, blue advisory
  Decision cards: color-coded left border by risk level
*/

function RiskBorder({ level }) {
  const colors = { high: '#f59e0b', medium: '#3b82f6', low: '#14b8a6' }
  return colors[level] || '#64748b'
}

function ConfidenceScore({ score }) {
  const val = Number(score || 0)
  const color = val >= 0.75 ? '#14b8a6' : val >= 0.5 ? '#3b82f6' : '#f59e0b'
  return (
    <span style={{
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 600,
      fontSize: 13,
      color,
      padding: '2px 8px',
      borderRadius: 4,
      background: `${color}18`,
      border: `1px solid ${color}30`,
    }}>
      {val.toFixed(2)}
    </span>
  )
}

export default function HitlQueue({ token }) {
  const toast = useToast()
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [actioning, setActioning] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const payload = await apiFetch('/hitl/decisions?status=pending', {}, token)
      setDecisions(payload.decisions || [])
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token])

  async function approve(decisionId) {
    setActioning(decisionId)
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/approve`, { method: 'POST', body: JSON.stringify({ approver_id: 'USR_ADMIN_001' }) }, token)
      toast.success('Decision approved.')
      await load()
    } catch (err) { toast.error(err.message) }
    finally { setActioning(null) }
  }

  async function reject(decisionId) {
    setActioning(decisionId)
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/reject`, { method: 'POST', body: JSON.stringify({ approver_id: 'USR_ADMIN_001', reason: 'Business override' }) }, token)
      toast.info('Decision rejected.')
      await load()
    } catch (err) { toast.error(err.message) }
    finally { setActioning(null) }
  }

  const highRisk = decisions.filter(d => d.risk_level === 'high').length
  const medRisk  = decisions.filter(d => d.risk_level === 'medium').length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Decision Queue"
        description="Review and act on pending AI-generated decisions. Approve or reject each item to close the loop."
        action={
          <button onClick={load} className="btn btn-secondary btn-sm" disabled={loading}>
            <RefreshIcon /> Refresh
          </button>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        <StatCard label="Pending" value={decisions.length} variant={decisions.length > 0 ? 'warning' : 'success'} />
        <StatCard label="High Risk" value={highRisk} variant={highRisk > 0 ? 'danger' : 'success'} sub="Require immediate review" />
        <StatCard label="Medium Risk" value={medRisk} variant={medRisk > 0 ? 'info' : 'success'} sub="Advisory actions" />
      </div>

      {/* Decision cards */}
      {loading
        ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
        : decisions.length === 0
          ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 600, fontSize: 20, color: 'var(--color-text-primary)', marginBottom: 8 }}>Queue is empty</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 14, fontFamily: "'IBM Plex Mono', monospace" }}>All AI decisions have been reviewed. New decisions will appear here automatically.</div>
            </div>
          )
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {decisions.map((d, i) => (
                <div
                  key={d.decision_id}
                  className="card"
                  style={{
                    padding: 0, overflow: 'hidden',
                    borderLeft: `3px solid ${RiskBorder({ level: d.risk_level })}`,
                    animation: `fadeIn .3s ease ${i * 60}ms both`,
                  }}
                >
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* Decision ID */}
                    <Link
                      to={`/hitl/decision/${d.decision_id}`}
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 12, fontWeight: 600,
                        color: '#60a5fa', textDecoration: 'none',
                        letterSpacing: '.02em', flexShrink: 0,
                        minWidth: 220,
                      }}
                    >
                      {d.decision_id}
                    </Link>

                    {/* Type */}
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontFamily: "'Newsreader', Georgia, serif", flex: 1 }}>
                      {d.decision_type}
                    </span>

                    {/* Risk badge */}
                    <Badge variant={riskVariant(d.risk_level)}>{d.risk_level}</Badge>

                    {/* Confidence */}
                    <ConfidenceScore score={d.confidence_score} />

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {actioning === d.decision_id
                        ? <Spinner size="sm" />
                        : (
                          <>
                            <button
                              onClick={() => approve(d.decision_id)}
                              style={{
                                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                                background: 'rgba(20,184,166,.1)',
                                border: '1px solid rgba(20,184,166,.3)',
                                color: '#14b8a6', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 150ms',
                                fontFamily: "'IBM Plex Mono', monospace",
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(20,184,166,.2)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(20,184,166,.1)' }}
                            >
                              <CheckIcon /> APPROVE
                            </button>
                            <button
                              onClick={() => reject(d.decision_id)}
                              style={{
                                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                                background: 'rgba(239,68,68,.08)',
                                border: '1px solid rgba(239,68,68,.25)',
                                color: '#f87171', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', transition: 'all 150ms',
                                fontFamily: "'IBM Plex Mono', monospace",
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.15)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,.08)' }}
                            >
                              <XIcon /> REJECT
                            </button>
                            <Link
                              to={`/hitl/decision/${d.decision_id}`}
                              style={{
                                padding: '7px 14px', borderRadius: 'var(--r-sm)',
                                background: 'rgba(59,130,246,.08)',
                                border: '1px solid rgba(59,130,246,.2)',
                                color: '#60a5fa', fontSize: 12, fontWeight: 700,
                                cursor: 'pointer', textDecoration: 'none',
                                fontFamily: "'IBM Plex Mono', monospace",
                                display: 'flex', alignItems: 'center', gap: 5,
                              }}
                            >
                              DETAIL →
                            </Link>
                          </>
                        )
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
      }
    </div>
  )
}

function CheckIcon()   { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> }
function XIcon()       { return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg> }
function RefreshIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> }
