import { useEffect, useState } from 'react'
import { getSettings, updateSettings, type AgentSettings } from '../api'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Settings2, Save, Undo2, CheckCircle2, Bot, AlertTriangle } from 'lucide-react'

const defaults: AgentSettings = {
  restock_threshold_days: 7,
  restock_buffer_days: 14,
  price_drift_threshold_pct: 10,
  minimum_price_margin_pct: 10,
  escalation_star_threshold: 1,
  sentiment_confidence_min: 0.75,
  autonomous_confidence_threshold: 0.85,
  max_auto_drafts_per_run: 50,
}

export function AgentSettingsPage() {
  const [settings, setSettings] = useState<AgentSettings>(defaults)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  const onChange = <K extends keyof AgentSettings>(key: K, value: string) => {
    setSettings((current) => ({
      ...current,
      [key]: Number(value),
    }))
  }

  const save = async () => {
    await updateSettings(settings)
    setMessage('Agent configuration synced securely.')
    setTimeout(() => setMessage(''), 3000)
  }

  const reset = () => {
    setSettings(defaults)
    setMessage('Reset to semantic defaults locally. Save to deploy to agent.')
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings2 className="text-brand-500" />
            Agent Settings
          </h1>
          <p className="text-slate-500 mt-1">Configure parameters for the autonomous operations agent.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={reset}>
            <Undo2 size={16} className="mr-2" /> Reset
          </Button>
          <Button onClick={save}>
            <Save size={16} className="mr-2" /> Deploy Changes
          </Button>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Bot className="text-brand-500" />
            <h2 className="text-lg font-bold">Autonomous Control</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1 flex justify-between">
                Confidence Threshold Minimum
                <Badge variant="outline" className="font-mono">{settings.autonomous_confidence_threshold.toFixed(2)}</Badge>
              </label>
              <p className="text-xs text-slate-500 mb-2">Agent will route to HITL below this confidence.</p>
              <Input 
                type="number" step="0.01" max="1" min="0"
                value={settings.autonomous_confidence_threshold}
                onChange={(e) => onChange('autonomous_confidence_threshold', e.target.value)}
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold mb-1 flex justify-between">
                Max AI Drafts per Execution
                <Badge variant="outline" className="font-mono">{settings.max_auto_drafts_per_run}</Badge>
              </label>
              <p className="text-xs text-slate-500 mb-2">Rate limit background review generation tasks.</p>
              <Input 
                type="number" step="1" min="1"
                value={settings.max_auto_drafts_per_run}
                onChange={(e) => onChange('max_auto_drafts_per_run', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 flex justify-between">
                Sentiment Min Confidence
                <Badge variant="outline" className="font-mono">{settings.sentiment_confidence_min.toFixed(2)}</Badge>
              </label>
              <Input 
                type="number" step="0.01" max="1" min="0"
                value={settings.sentiment_confidence_min}
                onChange={(e) => onChange('sentiment_confidence_min', e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <AlertTriangle className="text-amber-500" />
            <h2 className="text-lg font-bold">Risk Management Thresholds</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-1 flex justify-between">
                Price Drift Limit (%)
                <Badge variant="outline" className="font-mono">{settings.price_drift_threshold_pct}%</Badge>
              </label>
              <Input 
                type="number" step="1" max="100" min="1"
                value={settings.price_drift_threshold_pct}
                onChange={(e) => onChange('price_drift_threshold_pct', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold mb-1 flex justify-between">
                Minimum Allowed Margin (%)
                <Badge variant="outline" className="font-mono">{settings.minimum_price_margin_pct}%</Badge>
              </label>
              <Input 
                type="number" step="1" max="100" min="0"
                value={settings.minimum_price_margin_pct}
                onChange={(e) => onChange('minimum_price_margin_pct', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-sm font-semibold mb-1 block">Restock Threshold</label>
                  <Input 
                    type="number" step="1"
                    value={settings.restock_threshold_days}
                    onChange={(e) => onChange('restock_threshold_days', e.target.value)}
                  />
                  <div className="text-xs text-slate-500 mt-1">Days</div>
               </div>
               <div>
                  <label className="text-sm font-semibold mb-1 block">Buffer Days</label>
                  <Input 
                    type="number" step="1"
                    value={settings.restock_buffer_days}
                    onChange={(e) => onChange('restock_buffer_days', e.target.value)}
                  />
                  <div className="text-xs text-slate-500 mt-1">Days</div>
               </div>
            </div>
            
            <div>
              <label className="text-sm font-semibold mb-1 flex justify-between">
                Escalation Threshold (Stars)
                <Badge variant="outline" className="font-mono">≤ {settings.escalation_star_threshold}</Badge>
              </label>
              <Input 
                type="number" step="1" max="5" min="1"
                value={settings.escalation_star_threshold}
                onChange={(e) => onChange('escalation_star_threshold', e.target.value)}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
