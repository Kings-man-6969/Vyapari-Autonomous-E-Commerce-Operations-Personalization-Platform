import { useEffect, useState } from 'react'
import { getStats, processReviews, runInventoryScan } from '../api'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Package, AlertTriangle, AlertCircle, PlayCircle, Clock, Star, TrendingUp, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
    { label: 'Total Products', value: stats.total_products ?? 0, icon: Package, color: 'text-[var(--primary)]', bg: 'bg-[var(--primary)]/10' },
    { label: 'Critical Stock', value: stats.critical_stock_items ?? 0, icon: AlertCircle, color: 'text-[#ffb4ab]', bg: 'bg-[#93000a]/20', alert: true },
    { label: 'Stock Warning', value: stats.stock_warning_items ?? 0, icon: AlertTriangle, color: 'text-[var(--tertiary)]', bg: 'bg-[var(--tertiary)]/10' },
    { label: 'Pending Decisions', value: stats.pending_agent_decisions ?? 0, icon: Clock, color: 'text-[var(--primary-container)]', bg: 'bg-[var(--primary)]/10' },
    { label: 'Pending Reviews', value: stats.pending_reviews ?? 0, icon: Star, color: 'text-[var(--on-surface-variant)]', bg: 'bg-[var(--surface-container-highest)]' },
    { label: 'Escalated Reviews', value: stats.escalated_reviews ?? 0, icon: AlertCircle, color: 'text-[#ffb4ab]', bg: 'bg-[#93000a]/20', alert: true },
  ]

  return (
    <div className="space-y-12 max-w-7xl mx-auto pb-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-[2.5rem] font-extrabold text-[var(--on-surface)] tracking-tight leading-tight">Store Overview</h1>
          <p className="text-[var(--on-surface-variant)] mt-2 font-medium">Real-time metrics and agent activities.</p>
        </div>
        <div className="flex gap-4">
          <Button onClick={triggerScan} disabled={isLoading} className="shadow-[0_0_20px_rgba(192,193,255,0.2)] hover:shadow-[0_0_30px_rgba(192,193,255,0.4)] transition-shadow">
            {isLoading ? <RefreshCw className="mr-2 animate-spin" size={18}/> : <PlayCircle className="mr-2" size={18}/>} 
            Run Inventory Scan
          </Button>
          <Button onClick={triggerReviewProcess} disabled={isLoading} variant="secondary" className="ghost-border">
            Process Reviews
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }} 
            animate={{ opacity: 1, height: 'auto', marginTop: 32 }} 
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[var(--primary)]/10 text-[var(--primary)] p-5 rounded-[var(--radius-xl)] ghost-border flex items-center gap-4 shadow-inner">
              <TrendingUp size={20} />
              <span className="font-semibold">{message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="h-full">
            <Card className={`relative overflow-hidden h-full group border-none bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] transition-colors ${kpi.alert && kpi.value > 0 ? 'ring-1 ring-[#93000a] shadow-[0_0_30px_rgba(147,0,10,0.2)]' : 'shadow-[inset_0_1px_rgba(255,255,255,0.02)]'}`}>
              {kpi.alert && kpi.value > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-[#93000a]/20 blur-[40px] pointer-events-none" />}
              <CardContent className="p-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-4">
                    <p className="text-label-sm text-[var(--on-surface-variant)]">{kpi.label}</p>
                    <div className="text-[3rem] font-extrabold text-[var(--on-surface)] tracking-tight leading-none">{kpi.value}</div>
                  </div>
                  <div className={`p-4 rounded-2xl ${kpi.bg} shadow-inner`}>
                    <kpi.icon className={kpi.color} size={28} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Simulated Alerts Ribbon */}
      {(stats.critical_stock_items > 0 || stats.escalated_reviews > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[var(--surface-container-highest)] text-[var(--on-surface)] rounded-[var(--radius-3xl)] p-10 ghost-border overflow-hidden relative shadow-inner mt-12"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#93000a]/10 blur-[80px] pointer-events-none" />
          
          <h3 className="font-extrabold text-2xl mb-8 flex items-center gap-3 text-[#ffb4ab] relative z-10">
            <AlertTriangle size={28} /> Action Required
          </h3>
          <ul className="space-y-4 relative z-10">
            {stats.critical_stock_items > 0 && (
              <li className="flex flex-col sm:flex-row gap-6 justify-between sm:items-center bg-[var(--surface-container-low)]/80 backdrop-blur-md p-6 rounded-[var(--radius-xl)] ghost-border hover:bg-[var(--surface-container)] transition-colors shadow-sm">
                <span className="text-[var(--on-surface-variant)] text-lg"><b className="text-[var(--on-surface)]">Critical Stock:</b> You have {stats.critical_stock_items} products with critically low stock waiting for agent decisions.</span>
                <Button variant="secondary" size="lg" className="whitespace-nowrap font-bold">View Inventory</Button>
              </li>
            )}
            {stats.escalated_reviews > 0 && (
              <li className="flex flex-col sm:flex-row gap-6 justify-between sm:items-center bg-[var(--surface-container-low)]/80 backdrop-blur-md p-6 rounded-[var(--radius-xl)] ghost-border hover:bg-[var(--surface-container)] transition-colors shadow-sm">
                <span className="text-[var(--on-surface-variant)] text-lg"><b className="text-[var(--on-surface)]">Escalated Reviews:</b> You have {stats.escalated_reviews} reviews that require manual intervention.</span>
                <Button variant="secondary" size="lg" className="whitespace-nowrap font-bold">View HITL Queue</Button>
              </li>
            )}
          </ul>
        </motion.div>
      )}
    </div>
  )
}
