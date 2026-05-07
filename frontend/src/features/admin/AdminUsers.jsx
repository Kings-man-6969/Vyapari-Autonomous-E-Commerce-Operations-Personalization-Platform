import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import { SpinnerPage } from '@/shared/components/Spinner'

export default function AdminUsers({ token }) {
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await apiFetch('/admin/users', {}, token)
      setUsers(data)
    } catch (e) {
      toast.error(e.message || "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [token])

  if (loading) return <SpinnerPage message="Loading platform users..." />

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="User Management" 
        description="View and manage all users on the platform."
      />

      <div className="surface-card">
        {users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No users found.
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{u.user_id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span style={{ 
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        background: 'rgba(56,189,248,.1)', color: '#38bdf8'
                      }}>
                        {u.account_type}
                      </span>
                    </td>
                    <td>{u.is_active ? 'Active' : 'Suspended'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
