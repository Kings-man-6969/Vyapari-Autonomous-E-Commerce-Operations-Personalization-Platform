import React, { useEffect, useState } from 'react'
import api from '../api'
import { PageHeader, Card, Badge, Loader, Button } from '../components/UI'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function PricingMonitor() {
  const [pricing, setPricing] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPricing()
  }, [])

  const fetchPricing = async () => {
    const { data } = await api.get('/pricing')
    setPricing(data)
    setLoading(false)
  }

  const applySuggestion = async (productId, suggestedPrice) => {
    await api.patch(`/products/${productId}`, { field: 'price', value: suggestedPrice })
    fetchPricing() // refresh
  }

  if (loading) return <div className="p-8"><Loader /></div>

  return (
    <div className="p-8">
      <PageHeader
        title="Pricing Monitor"
        subtitle="Competitor price comparison & agent recommendations"
        action={
          <Button onClick={fetchPricing} variant="ghost">
            Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Product</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Our Price (₹)</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Competitor (₹)</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Diff %</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Suggested Price (₹)</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {pricing.map((item) => (
              <tr key={item.product_id} className="hover:bg-gray-900/50">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-white">{item.product_name}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="font-bold text-lg">₹{item.our_price.toFixed(2)}</span>
                </td>
                <td className="py-3 px-4">
                  {item.competitor_price ? (
                    <span className="text-gray-300">₹{item.competitor_price.toFixed(2)}</span>
                  ) : (
                    <span className="text-gray-500 text-sm">No data</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {item.diff_pct !== null ? (
                    <div className="flex items-center gap-1">
                      {item.diff_pct > 0 ? <TrendingUp size={14} className="text-red-400" /> :
                       item.diff_pct < 0 ? <TrendingDown size={14} className="text-green-400" /> :
                       <Minus size={14} className="text-gray-400" />}
                      <span className={item.diff_pct > 10 ? 'text-red-400 font-semibold' :
                                     item.diff_pct < -5 ? 'text-green-400 font-semibold' : 'text-gray-300'}>
                        {item.diff_pct > 0 ? '+' : ''}{item.diff_pct}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="font-bold text-indigo-400">₹{item.suggested_price.toFixed(2)}</span>
                </td>
                <td className="py-3 px-4">
                  <Badge
                    color={
                      item.status === 'OVERPRICED' ? 'red' :
                      item.status === 'UNDERPRICED' ? 'green' :
                      item.status === 'OK' ? 'blue' : 'gray'
                    }
                    label={item.status}
                  />
                </td>
                <td className="py-3 px-4">
                  {item.status === 'OVERPRICED' && (
                    <Button
                      size="sm"
                      onClick={() => applySuggestion(item.product_id, item.suggested_price)}
                    >
                      Apply
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-6 text-sm text-gray-500">
        <p>
          <span className="inline-block w-3 h-3 bg-red-900 rounded-full mr-2"></span>
          <strong>OVERPRICED</strong> — Our price is more than 10% above competitor.
        </p>
        <p className="mt-1">
          <span className="inline-block w-3 h-3 bg-green-900 rounded-full mr-2"></span>
          <strong>UNDERPRICED</strong> — Our price is more than 5% below competitor (good for customers).
        </p>
        <p className="mt-1">
          <span className="inline-block w-3 h-3 bg-blue-900 rounded-full mr-2"></span>
          <strong>OK</strong> — Price difference within acceptable range.
        </p>
      </div>
    </div>
  )
}