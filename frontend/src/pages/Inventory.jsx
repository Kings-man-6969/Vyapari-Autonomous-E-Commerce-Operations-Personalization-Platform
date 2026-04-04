import React, { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Card, Badge, Button, Loader, EmptyState } from '../components/UI'

const healthColor = { critical: 'red', warning: 'yellow', ok: 'green' }

export default function Inventory() {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState('all')

  const fetchInventory = async () => {
    const { data } = await api.get('/inventory')
    setInventory(data)
    setLoading(false)
  }

  useEffect(() => { fetchInventory() }, [])

  const runScan = async () => {
    setScanning(true)
    await api.post('/inventory/scan')
    await fetchInventory()
    setScanning(false)
  }

  const filtered = filter === 'all' ? inventory : inventory.filter(p => p.health === filter)

  return (
    <div className="p-8">
      <PageHeader
        title="Inventory & Pricing"
        subtitle="Real-time stock levels and pricing health"
        action={
          <Button onClick={runScan} disabled={scanning}>
            {scanning ? 'Scanning...' : '🔍 Run Agent Scan'}
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['all', 'critical', 'warning', 'ok'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f} {f !== 'all' && `(${inventory.filter(p => p.health === f).length})`}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        filtered.length === 0 ? <EmptyState message="No products in this category." /> :
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="pb-3 pr-4">Product</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Price (₹)</th>
                <th className="pb-3 pr-4">Stock</th>
                <th className="pb-3 pr-4">Avg Sales/Day</th>
                <th className="pb-3 pr-4">Days Left</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-900/50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="font-medium text-white">{p.name}</div>
                    <div className="text-xs text-gray-600 font-mono">{p.id}</div>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{p.category}</td>
                  <td className="py-3 pr-4 text-indigo-400 font-semibold">₹{p.price.toFixed(0)}</td>
                  <td className="py-3 pr-4">
                    <span className={p.stock < 10 ? 'text-red-400 font-bold' : 'text-gray-300'}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{p.avg_daily_sales}</td>
                  <td className="py-3 pr-4">
                    <span className={
                      p.days_of_stock < 5 ? 'text-red-400 font-bold' :
                      p.days_of_stock < 10 ? 'text-yellow-400' : 'text-green-400'
                    }>
                      {p.days_of_stock >= 999 ? '∞' : `${p.days_of_stock}d`}
                    </span>
                  </td>
                  <td className="py-3">
                    <Badge label={p.health.toUpperCase()} color={healthColor[p.health]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
