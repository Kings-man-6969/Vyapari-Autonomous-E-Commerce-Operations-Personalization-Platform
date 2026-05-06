import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import html2canvas from 'html2canvas'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getAnalytics, getStats, type AnalyticsData } from '../api'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { BarChart3, Download, TrendingUp } from 'lucide-react'

// Derived from Digital Curator token variables for Recharts
const CHART_COLORS = ['#c0c1ff', '#ffb783', '#c5c4dd', '#5c5d72', '#ffdad6']
const PIE_COLORS = ['#c0c1ff', '#ffb783', '#c5c4dd']
const SENTIMENT_COLORS = ['#c0c1ff', '#c5c4dd', '#ffb4ab'] // Positive, Neutral, Negative

function ChartShell({
  title,
  subtitle,
  chartRef,
  onExport,
  children,
}: {
  title: string
  subtitle: string
  chartRef: React.RefObject<HTMLDivElement | null>
  onExport: (chartRef: React.RefObject<HTMLDivElement | null>, label: string) => void
  children: ReactNode
}) {
  return (
    <Card className="p-8 space-y-6 premium-shadow border-none bg-[var(--surface-container-low)]">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-[var(--on-surface)]">{title}</h3>
          <p className="text-sm font-medium text-[var(--on-surface-variant)] mt-1">{subtitle}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onExport(chartRef, title)} className="shadow-sm ghost-border">
          <Download size={14} className="mr-2" /> Export
        </Button>
      </div>
      <div ref={chartRef} className="h-80 bg-[var(--surface-container-highest)]/50 rounded-[var(--radius-xl)] p-4 ghost-border">
        {children}
      </div>
    </Card>
  )
}

export function SellerAnalyticsPage() {
  const [stats, setStats] = useState<Record<string, number>>({})
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')

  const salesRef = useRef<HTMLDivElement>(null)
  const stockRef = useRef<HTMLDivElement>(null)
  const revenueRef = useRef<HTMLDivElement>(null)
  const sentimentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getStats(), getAnalytics()])
      .then(([summary, details]) => {
        setStats(summary)
        setAnalytics(details)
      })
      .catch(() => setError('Could not load analytics.'))
  }, [])

  const salesVelocity = useMemo(() => {
    if (!analytics) return []
    return analytics.sales_velocity.map((entry) => {
      const row: Record<string, string | number> = { day: new Date(entry.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
      entry.products.forEach((product) => {
        row[product.product_name] = product.units
      })
      return row
    })
  }, [analytics])

  const salesLines = useMemo(() => {
    if (!analytics || analytics.sales_velocity.length === 0) return []
    return analytics.sales_velocity[0].products.map((product) => product.product_name)
  }, [analytics])

  const exportChart = async (chartRef: React.RefObject<HTMLDivElement | null>, label: string) => {
    if (!chartRef.current) return
    const canvas = await html2canvas(chartRef.current, { backgroundColor: 'var(--surface)', scale: 2 })
    const link = document.createElement('a')
    link.download = `${label.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-8 max-w-[90rem] mx-auto pb-10 px-6">
      <div>
        <h1 className="text-[2.5rem] font-extrabold flex items-center gap-4 tracking-tight text-[var(--on-surface)]">
          <div className="p-3 bg-[var(--primary)]/10 rounded-[var(--radius-xl)] text-[var(--primary)] shadow-sm">
            <BarChart3 size={28} />
          </div>
          Analytics Dashboard
        </h1>
        <p className="text-[var(--on-surface-variant)] mt-2 font-medium">Recharts-powered analytics with exportable visuals for reporting.</p>
      </div>

      {error && <div className="p-5 rounded-[var(--radius-xl)] ghost-border bg-[#93000a]/20 text-[#ffb4ab] font-bold shadow-inner">{error}</div>}

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="p-8 premium-shadow relative overflow-hidden glass-card group hover:shadow-[0_0_30px_rgba(192,193,255,0.15)] transition-shadow">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-[var(--primary)]/20 transition-colors" />
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 bg-[var(--primary)]/20 rounded-2xl text-[var(--primary)] shadow-inner">
              <TrendingUp size={24} />
            </div>
            <Badge variant="success" className="shadow-[inset_0_1px_rgba(255,255,255,0.2)] bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20 font-bold uppercase tracking-widest text-[10px]">Live</Badge>
          </div>
          <h3 className="text-[var(--on-surface-variant)] text-xs font-bold mb-2 tracking-[0.1em] uppercase">Total Revenue</h3>
          <div className="text-[2.5rem] font-extrabold text-[var(--on-surface)] tracking-tight">₹{stats.total_revenue?.toFixed(2) ?? '0.00'}</div>
        </Card>

        <Card className="p-8 premium-shadow glass-card relative overflow-hidden group hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-shadow">
          <div className="flex justify-between items-start mb-6">
             <div className="p-4 bg-[var(--surface-container-highest)] rounded-2xl text-[var(--on-surface-variant)] shadow-inner ghost-border">
              <BarChart3 size={24} />
            </div>
          </div>
          <h3 className="text-[var(--on-surface-variant)] text-xs font-bold mb-2 tracking-[0.1em] uppercase">Pending Decisions</h3>
          <div className="text-[2.5rem] font-extrabold text-[var(--on-surface)] tracking-tight">{stats.pending_agent_decisions ?? 0}</div>
        </Card>

        <Card className="p-8 premium-shadow glass-card relative overflow-hidden group hover:shadow-[0_0_30px_rgba(147,0,10,0.15)] transition-shadow ring-1 ring-transparent hover:ring-[#93000a]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#93000a]/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-[#93000a]/20 transition-colors" />
          <div className="flex justify-between items-start mb-6">
             <div className="p-4 bg-[#93000a]/20 rounded-2xl text-[#ffb4ab] shadow-inner">
              <TrendingUp size={24} className="rotate-180" />
            </div>
          </div>
          <h3 className="text-[var(--on-surface-variant)] text-xs font-bold mb-2 tracking-[0.1em] uppercase">Escalated Reviews</h3>
          <div className="text-[2.5rem] font-extrabold text-[var(--on-surface)] tracking-tight">{stats.escalated_reviews ?? 0}</div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-8">
        <ChartShell
          title="Sales Velocity"
          subtitle="Last 7 days for top products"
          chartRef={salesRef}
          onExport={exportChart}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesVelocity}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#e2e2e9', fontSize: 12, fontWeight: 500}} dy={10} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#e2e2e9', fontSize: 12, fontWeight: 500}} dx={-10} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1b1b1f', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
                itemStyle={{ fontWeight: 600, color: '#e2e2e9' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              {salesLines.map((line, index) => (
                <Line
                  key={line}
                  type="monotone"
                  dataKey={line}
                  stroke={CHART_COLORS[index % CHART_COLORS.length]}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: CHART_COLORS[index % CHART_COLORS.length] }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Stock Health"
          subtitle="Critical / Warning / OK distribution"
          chartRef={stockRef}
          onExport={exportChart}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={analytics?.stock_health ?? []} 
                dataKey="count" 
                nameKey="status" 
                innerRadius={80} 
                outerRadius={120}
                paddingAngle={5}
                stroke="none"
              >
                {(analytics?.stock_health ?? []).map((entry, index) => (
                  <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1b1b1f', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', fontWeight: 600 }}
                itemStyle={{color: '#e2e2e9'}}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Category Revenue"
          subtitle="Revenue by product category"
          chartRef={revenueRef}
          onExport={exportChart}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics?.category_revenue ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fill: '#e2e2e9', fontSize: 12, fontWeight: 500}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#e2e2e9', fontSize: 12, fontWeight: 500}} dx={-10} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1b1b1f', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', fontWeight: 600 }}
                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                itemStyle={{color: '#e2e2e9'}}
              />
              <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell
          title="Review Sentiment"
          subtitle="Positive / Neutral / Negative breakdown"
          chartRef={sentimentRef}
          onExport={exportChart}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={analytics?.sentiment_distribution ?? []} 
                dataKey="count" 
                nameKey="label" 
                outerRadius={110}
                stroke="transparent"
                strokeWidth={3}
              >
                {(analytics?.sentiment_distribution ?? []).map((entry, index) => (
                  <Cell key={entry.label} fill={SENTIMENT_COLORS[index % SENTIMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1b1b1f', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', fontWeight: 600 }}
                itemStyle={{color: '#e2e2e9'}}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  )
}
