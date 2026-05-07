import React, { useState, useEffect } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'

export default function SellerAIAssistant({ token }) {
  const toast = useToast()
  const [command, setCommand] = useState('')
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState([])

  const fetchLogs = async () => {
    try {
      const data = await apiFetch('/agent/logs', {}, token)
      setLogs(data)
    } catch (err) {
      console.error("Failed to load logs", err)
    }
  }

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 5000)
    return () => clearInterval(interval)
  }, [token])

  const handleCommand = async (e) => {
    e.preventDefault()
    if (!command.trim()) return
    setSending(true)
    try {
      await apiFetch('/agent/command', {
        method: 'POST',
        body: JSON.stringify({ command })
      }, token)
      toast.success("Command sent to AI Assistant")
      setCommand('')
      fetchLogs() // immediate update
    } catch (err) {
      toast.error(err.message || "Failed to send command")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <PageHeader 
        title="AI Assistant & Logs" 
        description="Command your autonomous agent and view its action history."
      />

      <div style={{ flex: 1, display: 'flex', gap: 24, overflow: 'hidden' }}>
        
        {/* Chat / Command Interface */}
        <div className="surface-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: 16, margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Command Interface</h2>
          </div>
          
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 16, background: 'var(--color-bg-base)', borderRadius: 'var(--r-md)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
              👋 Hello! I'm your AI Agent. I can help you update pricing, fulfill orders, or analyze your sales. What would you like me to do?
            </div>
          </div>

          <div style={{ padding: 20, borderTop: '1px solid var(--color-border)' }}>
            <form onSubmit={handleCommand} style={{ display: 'flex', gap: 12 }}>
              <input 
                type="text" 
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder="e.g. 'Update prices by 5% for low stock items'"
                style={{ flex: 1, padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                disabled={sending}
              />
              <button type="submit" className="btn btn-primary" disabled={sending || !command.trim()}>
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        {/* Action Logs */}
        <div className="surface-card" style={{ width: 400, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: 16, margin: 0, fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Agent Logs</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: 40 }}>No actions logged yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {logs.map(log => (
                  <div key={log.log_id} style={{ padding: 16, borderRadius: 'var(--r-md)', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>{log.action_type}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {log.details}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
