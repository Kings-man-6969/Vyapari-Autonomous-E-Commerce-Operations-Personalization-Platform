import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import { SpinnerPage } from '@/shared/components/Spinner'

export default function SellerSettings({ token }) {
  const toast = useToast()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [storeName, setStoreName] = useState('')
  const [storeDescription, setStoreDescription] = useState('')
  const [returnPolicy, setReturnPolicy] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      try {
        const data = await apiFetch('/seller/settings', {}, token)
        setSettings(data)
        setStoreName(data.store_name || '')
        setStoreDescription(data.store_description || '')
        setReturnPolicy(data.return_policy || '')
        setContactEmail(data.contact_email || '')
      } catch (err) {
        toast.error(err.message || "Failed to load settings")
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [token, toast])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await apiFetch('/seller/settings', {
        method: 'PUT',
        body: JSON.stringify({
          store_name: storeName,
          store_description: storeDescription,
          return_policy: returnPolicy,
          contact_email: contactEmail
        })
      }, token)
      setSettings(updated)
      toast.success("Settings updated successfully")
    } catch (err) {
      toast.error(err.message || "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SpinnerPage message="Loading store settings..." />

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Store Settings" 
        description="Manage your storefront profile, policies, and contact information."
      />

      <div className="surface-card" style={{ maxWidth: 800, padding: 32 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>Store Name</label>
            <input 
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="e.g. Acme Electronics"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>Contact Email</label>
            <input 
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="support@acme.com"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>Store Description</label>
            <textarea 
              value={storeDescription}
              onChange={e => setStoreDescription(e.target.value)}
              placeholder="Tell customers about your store..."
              rows={4}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-faint)', textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'var(--font-mono)' }}>Return Policy</label>
            <textarea 
              value={returnPolicy}
              onChange={e => setReturnPolicy(e.target.value)}
              placeholder="e.g. 30-day money-back guarantee."
              rows={3}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', resize: 'vertical' }}
            />
          </div>
          
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
