import { useEffect, useState } from 'react'
import { getAgentStatus, type AgentStatus } from '../api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Activity, Bot, ShieldCheck, RefreshCw } from 'lucide-react'

export function HitlAgentsPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    getAgentStatus()
      .then(setStatus)
      .catch(() => setError('Could not load agent status.'))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="text-brand-500" />
            Agent Status
          </h1>
          <p className="text-slate-500 mt-1">Live health summary for recommendation, pricing, and review agents.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {[
          ['recommendation_agent', 'Recommendation'],
          ['inventory_pricing_agent', 'Inventory & Pricing'],
          ['review_response_agent', 'Review Response'],
        ].map(([key, label]) => {
          const item = status?.[key as keyof AgentStatus]
          return (
            <Card key={key} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                  <Bot size={18} className="text-brand-500" />
                  {label}
                </div>
                <Badge variant={item?.status === 'healthy' ? 'success' : 'warning'}>{item?.status ?? 'unknown'}</Badge>
              </div>
              <div className="text-sm text-slate-500">
                {item?.details ?? 'No data available yet.'}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Last run: {item?.last_run ?? 'n/a'}
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 font-semibold mb-3">
          <ShieldCheck className="text-emerald-500" size={18} />
          Operator note
        </div>
        <p className="text-sm text-slate-500">
          This route mirrors the TRD&apos;s /hitl/agents surface. The backend also keeps the legacy /agent-status alias active for compatibility.
        </p>
      </Card>
    </div>
  )
}
