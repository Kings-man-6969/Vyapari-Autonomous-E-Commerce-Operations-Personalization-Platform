import React, { useEffect, useState } from 'react'
import api from '../api'
import { StatCard, Card, Loader, Button } from '../components/UI'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)

  const fetchData = async () => {
    const [s, inv] = await Promise.all([api.get('/stats'), api.get('/inventory')])
    setStats(s.data)
    setInventory(inv.data)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const runScan = async () => {
    setScanning(true)
    await api.post('/inventory/scan')
    await fetchData()
    setScanning(false)
  }

  const runReviews = async () => {
    setProcessing(true)
    await api.post('/reviews/process')
    await fetchData()
    setProcessing(false)
  }

  if (loading) return <div className="p-8"><Loader /></div>

  const stockChartData = inventory
    .filter(p => p.health !== 'ok')
    .slice(0, 8)
    .map(p => ({ name: p.name.split(' ').slice(0, 2).join(' '), days: p.days_of_stock, health: p.health }))

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-gray-400 mt-1">Vyapari Operations Overview</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={runScan} disabled={scanning} variant="ghost">
            {scanning ? 'Scanning...' : '🔍 Run Inventory Scan'}
          </Button>
          <Button onClick={runReviews} disabled={processing}>
            {processing ? 'Processing...' : '⚡ Process Reviews'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Products"   value={stats.total_products}      color="indigo" />
        <StatCard label="Critical Stock"   value={stats.critical_stock_items} color="red"    sub="< 5 days" />
        <StatCard label="Stock Warnings"   value={stats.warning_stock_items}  color="yellow" sub="< 10 days" />
        <StatCard label="Pending Decisions" value={stats.pending_decisions}   color="blue"   />
        <StatCard label="Pending Reviews"  value={stats.pending_reviews}      color="purple" />
        <StatCard label="Escalated"        value={stats.escalated_reviews}    color="red"    sub="need attention" />
      </div>

      {/* Chart */}
      {stockChartData.length > 0 && (
        <Card className="p-5 mb-8">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Products Needing Attention (Days of Stock)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stockChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                {stockChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.health === 'critical' ? '#ef4444' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Quick tips */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">How to use Vyapari</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>🔍 <b className="text-gray-200">Run Inventory Scan</b> — agent checks stock levels and competitor prices, queues decisions for approval</li>
          <li>⚡ <b className="text-gray-200">Process Reviews</b> — agent classifies sentiment and drafts responses for all pending reviews</li>
          <li>✅ <b className="text-gray-200">Decisions tab</b> — approve or reject every agent action before it executes</li>
          <li>🛍️ <b className="text-gray-200">Recommendations tab</b> — enter a User ID to see personalized suggestions</li>
        </ul>
      </Card>
    </div>
  )
}
