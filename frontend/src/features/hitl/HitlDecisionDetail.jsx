import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '@/services/api';
import { useToast } from '@/shared/hooks/useToast';
import Badge, { riskVariant, statusVariant } from '@/shared/components/Badge';
import Spinner from '@/shared/components/Spinner';

/* ─── DESIGN.MD — HITL Decision Detail ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
──────────────────────────────────────────── */

function MetaRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid #1e2c31',
      gap: 16,
    }}>
      <dt style={{
        fontSize: 12,
        color: '#71717a',
        fontWeight: 400,
        textTransform: 'uppercase',
        letterSpacing: '0.72px',
        flexShrink: 0,
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
      }}>
        {label}
      </dt>
      <dd style={{
        fontSize: 14,
        color: '#ffffff',
        fontWeight: 420,
        textAlign: 'right',
        fontFamily: "'Inter', Helvetica, Arial, sans-serif",
        fontFeatureSettings: '"ss03"',
        margin: 0,
      }}>
        {value}
      </dd>
    </div>
  );
}

export default function HitlDecisionDetail({ token }) {
  const { decisionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    apiFetch(`/hitl/decisions/${decisionId}`, {}, token)
      .then(setDecision)
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [decisionId, token]);

  async function handleApprove() {
    setActioning(true);
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approver_id: 'USR_ADMIN_001' }),
      }, token);
      showToast('Decision approved and scheduled for execution.', 'success');
      navigate('/hitl');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActioning(false);
    }
  }

  async function handleReject() {
    setActioning(true);
    try {
      await apiFetch(`/hitl/decisions/${decisionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approver_id: 'USR_ADMIN_001', reason: 'Operator override' }),
      }, token);
      showToast('Decision rejected.', 'info');
      navigate('/hitl');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setActioning(false);
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size="lg" /></div>;

  if (!decision) {
    return (
      <div style={{ textAlign: 'center', padding: 64, color: '#71717a', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 500, color: '#ffffff', marginBottom: 16, fontSize: 18 }}>Decision not found</div>
        <Link
          to="/hitl"
          style={{
            padding: '8px 20px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid #1e2c31',
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: 13,
          }}
        >
          ← Back to Queue
        </Link>
      </div>
    );
  }

  const isPending = decision.decision_status === 'pending';
  const confidence = Number(decision.confidence_score || 0);

  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      {/* Back link */}
      <Link
        to="/hitl"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#71717a',
          fontSize: 13,
          fontWeight: 420,
          textDecoration: 'none',
          marginBottom: 24,
          fontFeatureSettings: '"ss03"',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
        onMouseLeave={e => e.currentTarget.style.color = '#71717a'}
      >
        ← Back to Queue
      </Link>

      {/* Header card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '28px 32px',
        marginBottom: 24,
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.72px', marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
              Decision ID
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: '#ffffff', marginBottom: 12, wordBreak: 'break-all', fontFeatureSettings: '"ss03"' }}>
              {decision.decision_id}
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Badge variant={statusVariant(decision.decision_status)}>{decision.decision_status}</Badge>
              <Badge variant={riskVariant(decision.risk_level)}>{decision.risk_level} risk</Badge>
              <span style={{
                fontSize: 12,
                fontWeight: 500,
                color: confidence >= 0.75 ? '#c1fbd4' : '#fee2e2',
                padding: '2px 8px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 9999,
                border: '1px solid #1e2c31',
                fontFeatureSettings: '"ss03"',
              }}>
                {(confidence * 100).toFixed(0)}% Confidence
              </span>
            </div>
          </div>

          {/* Action buttons */}
          {isPending && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                onClick={handleApprove}
                disabled={actioning}
                style={{
                  padding: '10px 24px',
                  borderRadius: 9999,
                  background: '#ffffff',
                  color: '#000000',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: actioning ? 'wait' : 'pointer',
                  transition: 'background 0.15s',
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                }}
                onMouseEnter={e => { if (!actioning) e.currentTarget.style.background = '#e4e4e7'; }}
                onMouseLeave={e => { if (!actioning) e.currentTarget.style.background = '#ffffff'; }}
              >
                Approve & Execute
              </button>
              <button
                onClick={handleReject}
                disabled={actioning}
                style={{
                  padding: '10px 22px',
                  borderRadius: 9999,
                  background: 'transparent',
                  color: '#fee2e2',
                  border: '1px solid rgba(254,226,226,0.3)',
                  fontSize: 14,
                  fontWeight: 420,
                  cursor: actioning ? 'wait' : 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(254,226,226,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Decision Metadata & Agent Reasoning */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        
        {/* Metadata Card */}
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: '24px',
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#ffffff', marginBottom: 16, fontFeatureSettings: '"ss03"' }}>
            Decision Parameters
          </h2>
          <dl style={{ margin: 0 }}>
            <MetaRow label="Action Type" value={decision.decision_type} />
            <MetaRow label="Target Entity" value={decision.entity_id || decision.product_id || 'System'} />
            <MetaRow label="Created Timestamp" value={decision.created_at ? new Date(decision.created_at).toLocaleString() : '—'} />
            <MetaRow label="Resolved Timestamp" value={decision.updated_at ? new Date(decision.updated_at).toLocaleString() : 'Pending'} />
            <MetaRow label="Assigned Approver" value={decision.approver_id || 'Awaiting Signoff'} />
          </dl>
        </div>

        {/* Reasoning Narrative Card */}
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          padding: '24px',
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: '#ffffff', marginBottom: 16, fontFeatureSettings: '"ss03"' }}>
            Autonomous Agent Rationale
          </h2>
          <div style={{
            padding: '18px 20px',
            background: '#121212',
            border: '1px solid #1e2c31',
            borderRadius: 10,
            color: 'rgba(255,255,255,0.9)',
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            {decision.reasoning || decision.details || 'Algorithm generated recommendation based on real-time stock velocity, competitor index, and elasticity thresholds.'}
          </div>
        </div>

      </div>
    </div>
  );
}
