import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useToast } from '../../shared/hooks/useToast';
import { SpinnerPage } from '../../shared/components/Spinner';
import PageHeader from '../../shared/components/PageHeader';

/* ─── DESIGN.MD — Admin User Directory ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
─────────────────────────────────────────── */

const ROLE_BADGES = {
  admin:    { bg: 'rgba(254,226,226,0.15)', color: '#fee2e2' },
  seller:   { bg: 'rgba(237,233,254,0.15)', color: '#ede9fe' },
  customer: { bg: 'rgba(193,251,212,0.15)', color: '#c1fbd4' },
};

export default function AdminUsers({ token }) {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch('/admin/users', {}, token);
      setUsers(data || []);
    } catch (e) {
      showToast(e.message || 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, [token]);

  if (loading && users.length === 0) return <SpinnerPage message="Loading directory records…" />;

  return (
    <div style={{
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="User & Tenant Directory"
        description="Global access control, merchant credentials, and authentication statuses."
        action={
          <button
            onClick={loadUsers}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: 9999,
              background: 'transparent',
              border: '1px solid #1e2c31',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 420,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.18s',
              fontFamily: "'Inter', Helvetica, Arial, sans-serif",
              fontFeatureSettings: '"ss03"',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2c31'; }}
          >
            <span>↻</span>
            <span>Refresh</span>
          </button>
        }
      />

      {/* Directory Table Card */}
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #1e2c31',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px', color: '#71717a' }}>
            No registered users found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#121212', borderBottom: '1px solid #1e2c31' }}>
                  <th style={thStyle}>User Identifier</th>
                  <th style={thStyle}>Display Name</th>
                  <th style={thStyle}>Email Address</th>
                  <th style={thStyle}>Platform Role</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, idx) => {
                  const roleBadge = ROLE_BADGES[u.account_type?.toLowerCase()] || ROLE_BADGES.customer;
                  return (
                    <tr
                      key={u.user_id}
                      style={{
                        borderBottom: idx < users.length - 1 ? '1px solid #1e2c31' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#141414'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '16px 24px', color: '#71717a', fontFeatureSettings: '"ss03"' }}>
                        #{u.user_id?.slice(0, 10)}
                      </td>
                      <td style={{ padding: '16px 24px', color: '#ffffff', fontWeight: 500, fontFeatureSettings: '"ss03"' }}>
                        {u.name}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'rgba(255,255,255,0.75)', fontFeatureSettings: '"ss03"' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 500,
                          background: roleBadge.bg,
                          color: roleBadge.color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          fontFeatureSettings: '"ss03"',
                        }}>
                          {u.account_type}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          color: u.is_active ? '#c1fbd4' : '#fee2e2',
                          fontSize: 13,
                          fontWeight: 420,
                          fontFeatureSettings: '"ss03"',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: u.is_active ? '#c1fbd4' : '#fee2e2' }} />
                          <span>{u.is_active ? 'Active' : 'Suspended'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '14px 24px',
  fontSize: 11,
  fontWeight: 500,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.72px',
  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
  fontFeatureSettings: '"ss03"',
};
