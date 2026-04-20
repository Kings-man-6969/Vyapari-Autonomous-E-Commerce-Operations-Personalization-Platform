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

const PIE_COLORS = ['#ef4444', '#f59e0b', '#22c55e']
const SENTIMENT_COLORS = ['#22c55e', '#f59e0b', '#ef4444']

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
    <Card className="p-6 space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onExport(chartRef, title)}>
          <Download size={14} className="mr-2" /> Export PNG
        </Button>
      </div>
      <div ref={chartRef} className="h-72">
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
    const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 })
    const link = document.createElement('a')
    link.download = `${label.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="text-brand-500" />
          Analytics Dashboard
        </h1>
        <p className="text-slate-500 mt-1">Recharts-powered analytics with exportable visuals for reporting.</p>
      </div>

      {error && <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/30 rounded-lg text-brand-600">
              <TrendingUp size={20} />
            </div>
            <Badge variant="success">Live</Badge>
          </div>
          <h3 className="text-slate-500 text-sm font-medium mb-1">Total Revenue</h3>
          <div className="text-3xl font-bold font-mono">₹{stats.total_revenue?.toFixed(2) ?? '0.00'}</div>
        </Card>

        <Card className="p-6">
          <h3 className="text-slate-500 text-sm font-medium mb-1">Pending Decisions</h3>
          <div className="text-3xl font-bold font-mono">{stats.pending_agent_decisions ?? 0}</div>
        </Card>

        <Card className="p-6">
          <h3 className="text-slate-500 text-sm font-medium mb-1">Escalated Reviews</h3>
          <div className="text-3xl font-bold font-mono">{stats.escalated_reviews ?? 0}</div>
        </Card>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <ChartShell
          title="Sales Velocity"
          subtitle="Last 7 days for top products"
          chartRef={salesRef}
          onExport={exportChart}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesVelocity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              {salesLines.map((line, index) => (
                <Line
                  key={line}
                  type="monotone"
                  dataKey={line}
                  stroke={['#2563eb', '#16a34a', '#f97316', '#e11d48', '#7c3aed'][index % 5]}
                  strokeWidth={2}
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
              <Pie data={analytics?.stock_health ?? []} dataKey="count" nameKey="status" innerRadius={70} outerRadius={105}>
                {(analytics?.stock_health ?? []).map((entry, index) => (
                  <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
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
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" interval={0} angle={-18} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#2563eb" radius={[8, 8, 0, 0]} />
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
              <Pie data={analytics?.sentiment_distribution ?? []} dataKey="count" nameKey="label" outerRadius={100}>
                {(analytics?.sentiment_distribution ?? []).map((entry, index) => (
                  <Cell key={entry.label} fill={SENTIMENT_COLORS[index % SENTIMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartShell>
      </div>
    </div>
  )
}
