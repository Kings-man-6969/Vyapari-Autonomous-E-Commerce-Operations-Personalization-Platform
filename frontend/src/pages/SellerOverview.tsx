import { useEffect, useState } from 'react'
import { getStats, processReviews, runInventoryScan } from '../api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Package, AlertTriangle, AlertCircle, PlayCircle, Clock, Star, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function SellerOverview() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const load = () => getStats().then(setStats)

  useEffect(() => {
    load()
    const timer = setInterval(load, 60000)
    return () => clearInterval(timer)
  }, [])

  const triggerScan = async () => {
    setIsLoading(true)
    try {
      const result = await runInventoryScan()
      setMessage(`Inventory Scan Complete: Scanned ${result.scanned} products, created ${result.new_decisions} decisions.`)
      load()
    } finally {
      setIsLoading(false)
    }
  }

  const triggerReviewProcess = async () => {
    setIsLoading(true)
    try {
      const result = await processReviews()
      setMessage(`Processed ${result.processed} reviews.`)
      load()
    } finally {
      setIsLoading(false)
    }
  }

  const kpis = [
    { label: 'Total Products', value: stats.total_products ?? 0, icon: Package, color: 'text-brand-500' },
    { label: 'Critical Stock', value: stats.critical_stock_items ?? 0, icon: AlertCircle, color: 'text-red-500', alert: true },
    { label: 'Stock Warning', value: stats.stock_warning_items ?? 0, icon: AlertTriangle, color: 'text-amber-500' },
    { label: 'Pending Decisions', value: stats.pending_agent_decisions ?? 0, icon: Clock, color: 'text-brand-400' },
    { label: 'Pending Reviews', value: stats.pending_reviews ?? 0, icon: Star, color: 'text-slate-500' },
    { label: 'Escalated Reviews', value: stats.escalated_reviews ?? 0, icon: AlertCircle, color: 'text-red-500', alert: true },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Store Overview</h1>
          <p className="text-slate-500 mt-1">Real-time metrics and agent activities.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={triggerScan} disabled={isLoading} className="bg-brand-600 hover:bg-brand-700 text-white">
            <PlayCircle className="mr-2" size={18}/> Run Inventory Scan
          </Button>
          <Button onClick={triggerReviewProcess} disabled={isLoading} variant="secondary">
            Process Reviews
          </Button>
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3"
        >
          <TrendingUp size={20} />
          {message}
        </motion.div>
      )}

      {/* KPI Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`relative overflow-hidden ${kpi.alert && kpi.value > 0 ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] dark:shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}`}>
              {kpi.alert && kpi.value > 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full pointer-events-none" />}
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </CardTitle>
                <kpi.icon className={kpi.color} size={20} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Simulated Alerts Ribbon */}
      {(stats.critical_stock_items > 0 || stats.escalated_reviews > 0) && (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xl border border-slate-800">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-red-400">
            <AlertTriangle /> Attention Required
          </h3>
          <ul className="space-y-3">
            {stats.critical_stock_items > 0 && (
              <li className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <span>You have {stats.critical_stock_items} products with critically low stock. Agent decisions are pending.</span>
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white">View Inventory</Button>
              </li>
            )}
            {stats.escalated_reviews > 0 && (
              <li className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <span>You have {stats.escalated_reviews} reviews that require manual intervention.</span>
                <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:text-white">View HITL Queue</Button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
