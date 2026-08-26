import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/services/api';
import { useToast } from '@/shared/hooks/useToast';
import PageHeader from '@/shared/components/PageHeader';

/* ─── DESIGN.MD — Seller AI Assistant & Logs ───
   Canvas: #000000 · Cards: #0a0a0a · Hairlines: #1e2c31
   Buttons: pill-only · Typography: Inter ss03
───────────────────────────────────────────────── */

export default function SellerAIAssistant({ token }) {
  const { showToast } = useToast();
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);

  const fetchLogs = async () => {
    try {
      const data = await apiFetch('/agent/logs', {}, token);
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load logs', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleCommand = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    setSending(true);
    try {
      await apiFetch('/agent/command', {
        method: 'POST',
        body: JSON.stringify({ command }),
      }, token);
      showToast('Command dispatched to Autonomous AI Agent', 'success');
      setCommand('');
      fetchLogs();
    } catch (err) {
      showToast(err.message || 'Failed to dispatch command', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      fontFamily: "'Inter', Helvetica, Arial, sans-serif",
      fontFeatureSettings: '"ss03"',
    }}>
      <PageHeader
        title="Autonomous AI Assistant & Logs"
        description="Command store agents directly and inspect autonomous telemetry in real time."
      />

      <div style={{ flex: 1, display: 'flex', gap: 24, overflow: 'hidden', flexWrap: 'wrap' }}>
        
        {/* Command & Chat Interface */}
        <div style={{
          flex: 1,
          minWidth: 320,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e2c31' }}>
            <h2 style={{ fontSize: 16, margin: 0, fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
              Command Dispatch
            </h2>
          </div>
          
          <div style={{ flex: 1, padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              padding: '16px 20px',
              background: '#121212',
              borderRadius: 10,
              border: '1px solid #1e2c31',
              color: 'rgba(255,255,255,0.8)',
              fontSize: 14,
              lineHeight: 1.6,
            }}>
              👋 <strong>Vyapari AI Agent ready.</strong> I can execute inventory adjustments, price simulation sweeps, review triage, and sales forecasting. Enter an operational prompt below.
            </div>
          </div>

          <div style={{ padding: '18px 24px', borderTop: '1px solid #1e2c31', background: '#0a0a0a' }}>
            <form onSubmit={handleCommand} style={{ display: 'flex', gap: 12 }}>
              <input
                type="text"
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder="e.g. 'Simulate price elasticity for low-stock SKUs'…"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 9999,
                  background: '#121212',
                  border: '1px solid #1e2c31',
                  color: '#ffffff',
                  fontSize: 14,
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.3)'}
                onBlur={e => e.target.style.borderColor = '#1e2c31'}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !command.trim()}
                style={{
                  padding: '10px 24px',
                  background: sending || !command.trim() ? '#1e2c31' : '#ffffff',
                  color: sending || !command.trim() ? '#71717a' : '#000000',
                  borderRadius: 9999,
                  border: 'none',
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: sending || !command.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.18s',
                  fontFamily: "'Inter', Helvetica, Arial, sans-serif",
                  fontFeatureSettings: '"ss03"',
                }}
              >
                {sending ? 'Dispatching…' : 'Dispatch'}
              </button>
            </form>
          </div>
        </div>

        {/* Action Logs Feed */}
        <div style={{
          width: 380,
          minWidth: 300,
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          border: '1px solid #1e2c31',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e2c31', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, margin: 0, fontWeight: 500, color: '#ffffff', fontFeatureSettings: '"ss03"' }}>
              Agent Telemetry
            </h2>
            <span style={{ fontSize: 11, color: '#c1fbd4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Live</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#71717a', fontSize: 14, marginTop: 40 }}>
                No actions logged yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {logs.map((log, idx) => (
                  <div
                    key={log.log_id || idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 10,
                      background: '#121212',
                      border: '1px solid #1e2c31',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#c1fbd4', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {log.action_type || 'AGENT_TASK'}
                      </span>
                      <span style={{ fontSize: 11, color: '#71717a' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                      {log.details || log.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
