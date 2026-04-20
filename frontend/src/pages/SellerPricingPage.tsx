import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPricingMonitor, type PricingRow } from '../api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ArrowRightLeft, Tags } from 'lucide-react'

export function SellerPricingPage() {
  const [rows, setRows] = useState<PricingRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getPricingMonitor()
      .then(setRows)
      .catch(() => setError('Could not load pricing monitor data.'))
  }, [])

  const totals = useMemo(() => {
    const over = rows.filter((row) => row.status === 'OVERPRICED').length
    const under = rows.filter((row) => row.status === 'UNDERPRICED').length
    const ok = rows.filter((row) => row.status === 'OK').length
    return { over, under, ok }
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Tags className="text-brand-500" />
            Pricing Monitor
          </h1>
          <p className="text-slate-500 mt-1">Compare our live pricing against simulated market signals.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="success">OK {totals.ok}</Badge>
          <Badge variant="warning">Underpriced {totals.under}</Badge>
          <Badge variant="destructive">Overpriced {totals.over}</Badge>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Our Price</th>
                <th className="px-6 py-4">Competitor Price</th>
                <th className="px-6 py-4">Diff %</th>
                <th className="px-6 py-4">Suggested Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {row.id} · {row.category}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono">₹{row.our_price.toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono">₹{row.competitor_price.toFixed(2)}</td>
                  <td className={`px-6 py-4 font-semibold ${row.diff_pct > 10 ? 'text-red-600' : row.diff_pct <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {row.diff_pct.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 font-mono">₹{row.suggested_price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={row.status === 'OVERPRICED' ? 'destructive' : row.status === 'UNDERPRICED' ? 'warning' : 'success'}
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/hitl?pricing=${row.id}`}>
                        Apply <ArrowRightLeft size={14} className="ml-2" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && !error && (
          <div className="p-8 text-center text-slate-500">No pricing signals available.</div>
        )}
      </Card>

      <div className="text-sm text-slate-500">
        Product edits can be made from the inventory or product form screens. <Link to="/seller/products/add" className="text-brand-600 hover:underline">Add a new product</Link> or open the inventory table for inline updates.
      </div>
    </div>
  )
}
