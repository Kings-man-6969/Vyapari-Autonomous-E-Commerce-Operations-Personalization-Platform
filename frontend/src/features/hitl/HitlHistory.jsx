import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/services/api';
import { useToast } from '@/shared/hooks/useToast';
import PageHeader from '@/shared/components/PageHeader';
import Badge, { statusVariant } from '@/shared/components/Badge';
import Spinner from '@/shared/components/Spinner';
import EmptyState from '@/shared/components/EmptyState';

/* ─── DESIGN.MD — HITL Decision History ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────────────── */

const FILTERS = ['all', 'approved', 'rejected', 'auto_executed'];

export default function HitlHistory({ token }) {
  const { showToast } = useToast();
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    apiFetch('/hitl/history', {}, token)
      .then((payload) => setDecisions(payload.decisions || []))
      .catch((err) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = filter === 'all'
    ? decisions
    : decisions.filter((d) => d.decision_status === filter);

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Decision Audit History"
        description="Comprehensive chronological log of all approved, rejected, and auto-executed agent actions."
      />

      {/* Pill Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {FILTERS.map((f) => {
          const active = filter === f;
          const count = f === 'all' ? decisions.length : decisions.filter(d => d.decision_status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textTransform: 'capitalize',
              }}
            >
              <span>{f.replace('_', ' ')}</span>
              <span style={{
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 9999,
                background: active ? 'rgba(0,0,0,0.15)' : '#1e2c31',
                color: active ? '#000000' : 'rgba(255,255,255,0.8)',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No decisions found" description="No logged actions match the selected filter query." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((d) => {
            return (
              <div
                key={d.decision_id}
                style={{
                  background: '#0a0a0a',
                  border: '1px solid #1e2c31',
                  borderRadius: 12,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: d.decision_status === 'approved' ? '#c1fbd4' : d.decision_status === 'rejected' ? '#fee2e2' : '#ffffff',
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                    <Link
                      to={`/hitl/decision/${d.decision_id}`}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontFeatureSettings: '"ss03"',
                      }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >
                      #{d.decision_id.slice(0, 10)}
                    </Link>
                    <Badge variant={statusVariant(d.decision_status)}>{d.decision_status}</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                    {d.decision_type}{d.approval_reason ? ` · ${d.approval_reason}` : ''}
                  </div>
                </div>

                {d.updated_at && (
                  <div style={{ fontSize: 12, color: '#71717a', whiteSpace: 'nowrap', fontFeatureSettings: '"ss03"' }}>
                    {new Date(d.updated_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
