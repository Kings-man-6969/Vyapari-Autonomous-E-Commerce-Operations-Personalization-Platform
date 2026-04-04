import React, { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Card, Badge, Button, Loader, EmptyState } from '../components/UI'

const modeColor = { autonomous: 'green', advisory: 'yellow' }
const statusColor = { pending: 'blue', approved: 'green', rejected: 'red' }

function DecisionCard({ decision, onResolve }) {
  const payload = decision.payload || {}
  const isPending = decision.status === 'pending'

  return (
    <Card className={`p-5 ${isPending ? 'border-indigo-800/50' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{decision.type === 'restock' ? '📦' : '💰'}</span>
          <div>
            <p className="text-sm font-semibold text-white">{decision.product_name}</p>
            <p className="text-xs font-mono text-gray-600">{decision.product_id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge label={decision.mode} color={modeColor[decision.mode] || 'gray'} />
          <Badge label={decision.status} color={statusColor[decision.status] || 'gray'} />
          <span className="text-xs text-gray-600 pt-0.5">
            {Math.round(decision.confidence * 100)}% conf
          </span>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg px-4 py-3 mb-4">
        <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Agent Reasoning</p>
        <p className="text-sm text-gray-300">{decision.reasoning}</p>
      </div>

      {decision.type === 'restock' && (
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Current Stock</p>
            <p className="text-xl font-bold text-red-400">{payload.current_stock}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Days Remaining</p>
            <p className="text-xl font-bold text-yellow-400">{payload.days_of_stock_remaining}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Suggested Restock</p>
            <p className="text-xl font-bold text-green-400">+{payload.suggested_restock_qty}</p>
          </div>
        </div>
      )}

      {decision.type === 'pricing' && (
        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Our Price</p>
            <p className="text-xl font-bold text-red-400">₹{payload.our_price}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Competitor</p>
            <p className="text-xl font-bold text-gray-300">₹{payload.competitor_price}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-xs text-gray-500">Suggested Price</p>
            <p className="text-xl font-bold text-green-400">₹{payload.suggested_price}</p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mb-3">{new Date(decision.created_at).toLocaleString()}</p>

      {isPending && (
        <div className="flex gap-2 justify-end">
          <Button variant="danger" onClick={() => onResolve(decision.id, 'rejected')}>
            Reject
          </Button>
          <Button variant="success" onClick={() => onResolve(decision.id, 'approved')}>
            ✓ Approve
          </Button>
        </div>
      )}

      {!isPending && (
        <p className="text-xs text-right text-gray-600">
          {decision.status} by {decision.resolved_by} · {decision.resolved_at ? new Date(decision.resolved_at).toLocaleString() : ''}
        </p>
      )}
    </Card>
  )
}

export default function Decisions() {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  const fetchDecisions = async () => {
    const { data } = await api.get('/decisions')
    setDecisions(data)
    setLoading(false)
  }

  useEffect(() => { fetchDecisions() }, [])

  const resolve = async (id, action) => {
    await api.post(`/decisions/${id}/resolve`, { action })
    await fetchDecisions()
  }

  const counts = ['pending', 'approved', 'rejected'].reduce((acc, s) => {
    acc[s] = decisions.filter(d => d.status === s).length
    return acc
  }, {})

  const filtered = filter === 'all' ? decisions : decisions.filter(d => d.status === filter)

  return (
    <div className="p-8">
      <PageHeader
        title="Decision Log"
        subtitle="Human-in-the-Loop approval queue — every agent action starts here"
      />

      <div className="flex gap-2 mb-6">
        {[['pending', 'blue'], ['approved', 'green'], ['rejected', 'red'], ['all', 'gray']].map(([s, c]) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s} ({s === 'all' ? decisions.length : counts[s] || 0})
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        filtered.length === 0
          ? <EmptyState message="No decisions here. Run an Inventory Scan from the Dashboard to generate decisions." />
          : <div className="space-y-4">
              {filtered.map(d => (
                <DecisionCard key={d.id} decision={d} onResolve={resolve} />
              ))}
            </div>
      )}
    </div>
  )
}
