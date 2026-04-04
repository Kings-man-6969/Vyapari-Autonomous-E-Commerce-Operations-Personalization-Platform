import React, { useState } from 'react'
import api from '../api'
import { PageHeader, Card, Loader, Button, Badge, EmptyState } from '../components/UI'

function ProductCard({ product }) {
  const srcLabel = {
    collaborative_filtering: { text: 'For You', color: 'indigo' },
    popularity_fallback:     { text: 'Popular',  color: 'blue'   },
    semantic_search:         { text: 'Search',   color: 'green'  },
  }[product.recommendation_source] || { text: 'Suggested', color: 'gray' }

  return (
    <Card className="p-4 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500 font-mono">{product.id}</span>
        <Badge label={srcLabel.text} color={srcLabel.color} />
      </div>
      <h4 className="text-sm font-semibold text-white mb-1 leading-tight">{product.name}</h4>
      <p className="text-xs text-gray-500 mb-3">{product.category}</p>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-indigo-400">₹{product.price.toFixed(2)}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${product.stock < 10 ? 'bg-red-900/50 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
          {product.stock} in stock
        </span>
      </div>
    </Card>
  )
}

export default function Recommendations() {
  const [userId, setUserId] = useState('U001')
  const [query, setQuery] = useState('')
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(null)

  const fetchRecs = async () => {
    setLoading(true)
    setMode('recs')
    const { data } = await api.get(`/recommendations/${userId}`)
    setRecs(data)
    setLoading(false)
  }

  const fetchSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setMode('search')
    const { data } = await api.get('/search', { params: { q: query } })
    setRecs(data)
    setLoading(false)
  }

  return (
    <div className="p-8">
      <PageHeader title="Recommendations" subtitle="Personalized product suggestions & semantic search" />

      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Personalized Recs */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Personalized Recommendations</h3>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder="User ID (e.g. U001)"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchRecs()}
            />
            <Button onClick={fetchRecs} disabled={loading}>Get Recs</Button>
          </div>
          <p className="text-xs text-gray-600 mt-2">Try U001 – U050</p>
        </Card>

        {/* Semantic Search */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Semantic Product Search</h3>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              placeholder='e.g. "comfortable workout gear"'
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchSearch()}
            />
            <Button onClick={fetchSearch} disabled={loading}>Search</Button>
          </div>
          <p className="text-xs text-gray-600 mt-2">Natural language queries supported</p>
        </Card>
      </div>

      {loading && <Loader />}

      {!loading && recs.length === 0 && (
        <EmptyState message="Enter a User ID or search query to see recommendations." />
      )}

      {!loading && recs.length > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-4">
            {mode === 'recs' ? `Showing personalized results for ${userId}` : `Search results for "${query}"`}
            {' '}— {recs.length} products
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recs.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </>
      )}
    </div>
  )
}
