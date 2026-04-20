import { useEffect, useState } from 'react'
import { getPendingDecisions, resolveDecision, type Decision } from '../api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Check, X, Bot, Activity, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function HitlQueue() {
  const [items, setItems] = useState<Decision[]>([])
  const [message, setMessage] = useState('')

  const load = () => getPendingDecisions().then(setItems)

  useEffect(() => {
    load()
  }, [])

  const act = async (id: number, action: 'approve' | 'reject') => {
    await resolveDecision(id, { action, resolved_by: 'operator-demo' })
    setMessage(`Decision on item #${id} was ${action}d.`)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="text-brand-500" />
            Decision Queue
          </h1>
          <p className="text-slate-500 mt-1">Review and approve AI agent actions before they execute.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 font-mono">
          {items.length} Pending Actions
        </Badge>
      </div>

      {message && (
        <div className="bg-slate-100 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-sm transition-all">
          <Check size={16} className="text-emerald-500" />
          {message}
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="text-emerald-500" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Queue is Empty</h3>
          <p className="text-slate-500">All AI operations are currently stable. No human intervention needed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AnimatePresence>
            {items.map((decision) => {
              const confPercent = decision.confidence * 100
              const isHighConfidence = confPercent > 80
              
              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={decision.id}
                >
                  <Card className="overflow-hidden h-full flex flex-col">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                          <Bot size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Requested by Agent
                          </p>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {decision.type === 'pricing' ? 'Price Adjustment' : decision.type === 'restock' ? 'Restock Order' : String(decision.type).toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <Badge variant={decision.mode === 'advisory' ? 'destructive' : 'warning'}>
                        {decision.mode}
                      </Badge>
                    </div>

                    <div className="p-6 flex-1 space-y-6">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-bold">{decision.product_name}</h3>
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {decision.product_id}
                          </span>
                        </div>
                        
                        <div className="mt-4 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/10">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                            <Bot size={14} /> AI Reasoning
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200/80 leading-relaxed italic">
                            "{decision.reasoning}"
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            Confidence Score 
                            {!isHighConfidence && <AlertTriangle size={14} className="text-amber-500 ml-1" />}
                          </span>
                          <span className={`font-bold ${isHighConfidence ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {confPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${isHighConfidence ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: `${confPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-200 dark:border-slate-800 flex gap-3">
                      <Button 
                        onClick={() => act(decision.id, 'approve')} 
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20"
                      >
                        <Check className="mr-2" size={18} /> Approve Action
                      </Button>
                      <Button 
                        onClick={() => act(decision.id, 'reject')} 
                        variant="outline" 
                        className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <X className="mr-2" size={18} /> Reject
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
