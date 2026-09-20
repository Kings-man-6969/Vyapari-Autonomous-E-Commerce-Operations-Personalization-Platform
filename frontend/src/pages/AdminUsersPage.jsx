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
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
            User Accounts Governance
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            Manage shopper, seller, and administrator accounts, roles, and platform permissions
          </p>
        </div>
      </div>

      {actionMsg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: actionMsg.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: actionMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          fontSize: 'var(--font-size-sm)'
        }}>
          {actionMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
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
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                textTransform: 'capitalize',
                backgroundColor: roleFilter === r ? 'var(--color-primary)' : 'var(--color-surface-subtle)',
                color: roleFilter === r ? '#ffffff' : 'var(--color-text-secondary)',
                transition: 'all var(--transition-fast)'
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
          background: 'var(--color-surface-subtle)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-sm)',
          width: '280px'
        }}>
          <Search size={16} color="var(--color-text-secondary)" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 'var(--font-size-xs)',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="table-card" style={{ padding: '24px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: '56px', marginBottom: '12px' }} className="skeleton" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="table-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Users size={40} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>No users found</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Try resetting your search query or filter.
          </p>
        </div>
      ) : (
        <div className="table-card table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Identity</th>
                <th>Role</th>
                <th>Associated Entity</th>
                <th>Joined</th>
                <th>Account Status</th>
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
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{u.name}</span>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Mail size={12} />
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {u.store_name || (u.order_count !== undefined ? `${u.order_count} orders` : 'Shopper')}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${isSuspended ? 'status-pill-suspended' : 'status-pill-active'}`}>
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => handleToggleSuspend(u.id, u.status)}
                          className="btn-outline"
                          style={{
                            padding: '5px 10px',
                            fontSize: '11px',
                            color: isSuspended ? 'var(--color-success)' : 'var(--color-error)',
                            borderColor: isSuspended ? 'var(--color-success)' : 'var(--color-error)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {isSuspended ? <UserCheck size={12} /> : <UserX size={12} />}
                          <span>{isSuspended ? 'Reactivate' : 'Suspend'}</span>
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
