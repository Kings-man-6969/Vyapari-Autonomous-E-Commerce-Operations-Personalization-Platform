import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  UserCheck, 
  UserX,
  Mail,
  Calendar
} from 'lucide-react';
import api from '../services/api';

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState({ type: '', text: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load users list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleSuspend = async (userId, currentStatus) => {
    const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      const res = await api.put(`/admin/users/${userId}/status`, { status: nextStatus });
      if (res.data?.success) {
        setActionMsg({
          type: 'success',
          text: `User account has been ${nextStatus === 'suspended' ? 'suspended' : 'reactivated'}.`
        });
        fetchUsers();
      }
    } catch (err) {
      setActionMsg({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update user status.'
      });
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>
            User Accounts Governance
          </h1>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem', marginTop: '4px' }}>
            Manage shopper, merchant, and governance roles, privileges, and access permissions
          </p>
        </div>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${actionMsg.type === 'success' ? 'rgba(56, 189, 248, 0.3)' : 'var(--color-status-cancelled)'}`,
          color: actionMsg.type === 'success' ? 'var(--color-icy-steel)' : '#fca5a5',
          fontSize: '0.875rem'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--color-forest-floor)',
        border: '1px solid var(--color-iron-veil)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'customer', 'seller', 'admin'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              style={{
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: roleFilter === r ? '#ffffff' : 'var(--color-deep-canopy)',
                color: roleFilter === r ? '#02090a' : 'var(--color-tide-pool)',
                border: '1px solid',
                borderColor: roleFilter === r ? '#ffffff' : 'var(--color-iron-veil)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--color-abyssal-ink)',
          border: '1px solid var(--color-iron-veil)',
          padding: '6px 14px',
          borderRadius: '9999px',
          width: '280px'
        }}>
          <Search size={14} color="var(--color-ash-label)" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '12px',
              color: '#ffffff',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <Users size={40} color="var(--color-ash-label)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 330, letterSpacing: '0.015em', color: '#ffffff' }}>No users match criteria</h3>
          <p style={{ color: 'var(--color-tide-pool)', fontSize: '0.875rem' }}>
            Adjust filter or search parameters to inspect platform accounts.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive" style={{ backgroundColor: 'var(--color-forest-floor)', border: '1px solid var(--color-iron-veil)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSuspended = u.status === 'suspended';
                return (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem', color: '#ffffff' }}>{u.name || 'Anonymous User'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-ash-label)', marginTop: '2px' }}>{u.email}</div>
                      </div>
                    </td>
                    <td>
                      <span className="badge-agent" style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${isSuspended ? 'status-cancelled' : 'status-active'}`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--color-tide-pool)' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleToggleSuspend(u.id, u.status)}
                          style={{
                            padding: '5px 12px',
                            fontSize: '11px',
                            borderRadius: '6px',
                            backgroundColor: isSuspended ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${isSuspended ? 'rgba(56, 189, 248, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            color: isSuspended ? 'var(--color-icy-steel)' : '#f87171',
                            cursor: 'pointer'
                          }}
                        >
                          {isSuspended ? 'Reactivate' : 'Suspend'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
