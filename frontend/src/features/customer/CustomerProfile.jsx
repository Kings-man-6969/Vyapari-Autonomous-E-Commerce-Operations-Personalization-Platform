import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'

export default function CustomerProfile({ token }) {
  const toast = useToast()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiFetch('/auth/me', {}, token)
        setProfile(data)
        setName(data.name || '')
        setEmail(data.email || '')
      } catch (err) {
        toast.error("Failed to load profile")
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [token, toast])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await apiFetch('/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email })
      }, token)
      setProfile(updated)
      toast.success("Profile updated successfully")
    } catch (e) {
      toast.error(e.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size="lg" /></div>

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page" style={{ maxWidth: 600 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 900, color: '#ecfdf5', marginBottom: 24 }}>Account Settings</h1>
        
        <div className="cust-card">
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a7f3d0' }}>Full Name</label>
              <input 
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a7f3d0' }}>Email Address</label>
              <input 
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                required
              />
            </div>
            
            <div style={{ marginTop: 8 }}>
              <button 
                type="submit" 
                className="cust-btn-primary" 
                disabled={saving || (name === profile?.name && email === profile?.email)}
                style={{ minWidth: 120, justifyContent: 'center' }}
              >
                {saving ? <Spinner size="sm" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
