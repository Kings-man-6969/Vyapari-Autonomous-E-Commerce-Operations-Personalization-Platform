import React from 'react';
import PageHeader from '../../shared/components/PageHeader';

/* ─── DESIGN.MD — Admin Moderation ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────── */

export default function AdminModeration() {
  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Moderation & Risk Queue"
        description="Global platform compliance, counterfeit detection flags, and merchant dispute resolution."
      />

      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        padding: '64px 32px',
        textAlign: 'center',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🛡️</div>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: '#ffffff', marginBottom: 6, fontFeatureSettings: '"ss03"' }}>
          Queue is in pristine standing
        </h2>
        <p style={{ color: '#71717a', fontSize: 14, maxWidth: 440, margin: '0 auto', lineHeight: 1.6, fontFeatureSettings: '"ss03"' }}>
          Automated heuristic filters and customer sentiment guards have flagged zero policy violations requiring immediate manual intervention.
        </p>
      </div>
    </div>
  );
}
