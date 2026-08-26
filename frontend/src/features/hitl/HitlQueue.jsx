import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/services/api';
import { useToast } from '@/shared/hooks/useToast';
import PageHeader from '@/shared/components/PageHeader';
import StatCard from '@/shared/components/StatCard';
import Spinner from '@/shared/components/Spinner';

/* ─── DESIGN.MD — HITL Decision Queue ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────────── */

const RISK_BADGES = {
  high:   { bg: 'rgba(254,226,226,0.15)', color: '#fee2e2', label: 'HIGH RISK' },
  medium: { bg: 'rgba(254,243,199,0.15)', color: '#fef3c7', label: 'MEDIUM RISK' },
  low:    { bg: 'rgba(193,251,212,0.15)', color: '#c1fbd4', label: 'LOW RISK' },
};

function ConfidenceScore({ score }) {
  const val = Number(score || 0);
  const color = val >= 0.75 ? '#c1fbd4' : val >= 0.5 ? '#dbeafe' : '#fef3c7';
  return (
    <span style={{
      fontSize: 12,
      fontWeight: 500,
      color,
      padding: '2px 8px',
      borderRadius: 9999,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid #1e2c31',
      fontFeatureSettings: '"ss03"',
    }}>
      {(val * 100).toFixed(0)}% Conf
    </span>
  );
}

export default function HitlQueue({ token }) {
  const { showToast } = useToast();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const [filter, setFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      const payload = await apiFetch('/hitl/decisions?status=pending', {}, token);
      setDecisions(payload.decisions || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function approve(decisionId) {
    setActioning(decisionId);
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approver_id: 'USR_ADMIN_001' }),
      }, token);
      showToast('Decision approved and dispatched for execution.', 'success');
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActioning(null);
    }
  }

  async function reject(decisionId) {
    setActioning(decisionId);
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approver_id: 'USR_ADMIN_001', reason: 'Operator override' }),
      }, token);
      showToast('Decision rejected.', 'info');
      await load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActioning(null);
    }
  }

  const highRisk = decisions.filter(d => d.risk_level === 'high').length;
  const medRisk  = decisions.filter(d => d.risk_level === 'medium').length;
  const lowRisk  = decisions.filter(d => d.risk_level === 'low').length;

  const filtered = filter === 'all' ? decisions : decisions.filter(d => d.risk_level === filter);

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Autonomous Decision Queue"
        description="Human-in-the-loop oversight: Review, approve, or override algorithmic recommendations before execution."
        action={
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: 9999,
              background: 'transparent',
              border: '1px solid #1e2c31',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 420,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.18s',
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

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Pending Queue" value={decisions.length} variant={decisions.length > 0 ? 'warning' : 'success'} icon={<QueueIcon />} />
        <StatCard label="High Risk" value={highRisk} variant={highRisk > 0 ? 'danger' : 'success'} icon={<AlertIcon />} sub="Requires manual signoff" />
        <StatCard label="Medium Risk" value={medRisk} variant={medRisk > 0 ? 'info' : 'success'} icon={<InfoIcon />} sub="Advisory action threshold" />
        <StatCard label="Low Risk" value={lowRisk} variant="teal" icon={<CheckIcon />} sub="Safe for auto-execution" />
      </div>

      {/* Filter Tabs — Pill Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { val: 'all',    label: `All (${decisions.length})` },
          { val: 'high',   label: `High Risk (${highRisk})` },
          { val: 'medium', label: `Medium (${medRisk})` },
          { val: 'low',    label: `Low (${lowRisk})` },
        ].map(t => {
          const active = filter === t.val;
          return (
            <button
              key={t.val}
              onClick={() => setFilter(t.val)}
              style={{
                padding: '7px 16px',
                borderRadius: 9999,
                border: active ? 'none' : '1px solid #1e2c31',
                background: active ? '#ffffff' : '#0a0a0a',
                color: active ? '#000000' : 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: active ? 500 : 420,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                fontFeatureSettings: '"ss03"',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Decision Cards List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '64px 24px',
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 4, fontFeatureSettings: '"ss03"' }}>
            Queue is clear
          </div>
          <div style={{ color: '#71717a', fontSize: 14, fontFeatureSettings: '"ss03"' }}>
            All algorithmic decisions have been reviewed. New proposals will appear here automatically.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((d) => {
            const risk = RISK_BADGES[d.risk_level] || RISK_BADGES.low;
            const isActioning = actioning === d.decision_id;

            return (
              <div
                key={d.decision_id}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #1e2c31',
                  borderRadius: 12,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
                  transition: 'border-color 0.18s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2c31'}
              >
                {/* Left info cluster */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: risk.bg,
                    color: risk.color,
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFeatureSettings: '"ss03"',
                  }}>
                    {risk.label}
                  </span>

                  <Link
                    to={`/hitl/decision/${d.decision_id}`}
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.6)',
                      textDecoration: 'none',
                      fontFeatureSettings: '"ss03"',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                  >
                    #{d.decision_id.slice(0, 10)}
                  </Link>

                  <span style={{ fontSize: 15, fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
                    {d.decision_type}
                  </span>

                  <ConfidenceScore score={d.confidence_score} />
                </div>

                {/* Right action cluster */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                  {isActioning ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <button
                        onClick={() => approve(d.decision_id)}
                        style={{
                          padding: '7px 18px',
                          borderRadius: 9999,
                          background: '#ffffff',
                          color: '#000000',
                          border: 'none',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                          fontFeatureSettings: '"ss03"',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e4e4e7'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => reject(d.decision_id)}
                        style={{
                          padding: '7px 18px',
                          borderRadius: 9999,
                          background: 'transparent',
                          color: '#fee2e2',
                          border: '1px solid rgba(254,226,226,0.3)',
                          fontSize: 13,
                          fontWeight: 420,
                          cursor: 'pointer',
                          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                          fontFeatureSettings: '"ss03"',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(254,226,226,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        Reject
                      </button>
                      <Link
                        to={`/hitl/decision/${d.decision_id}`}
                        style={{
                          padding: '7px 16px',
                          borderRadius: 9999,
                          background: 'transparent',
                          border: '1px solid #1e2c31',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: 13,
                          fontWeight: 420,
                          textDecoration: 'none',
                          fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                          fontFeatureSettings: '"ss03"',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = '#1e2c31'; }}
                      >
                        Inspect →
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CheckIcon()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function RefreshIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>; }
function QueueIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>; }
function AlertIcon()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>; }
function InfoIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>; }
