import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getInventory, patchProduct } from '../api'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Search, AlertCircle, Pencil } from 'lucide-react'

type InventoryRow = {
  id: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  avg_sales_day: number
  days_stock_remaining: number
  status: 'CRITICAL' | 'WARNING' | 'OK'
}

export function SellerInventory() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    getInventory()
      .then((items) => setRows(items as InventoryRow[]))
      .catch(() => setError('Could not load inventory'))
  }

  useEffect(() => {
    load()
  }, [])

  const onQuickPatch = async (id: string, field: 'price' | 'stock', rawValue: string) => {
    const value = Number(rawValue)
    if (Number.isNaN(value)) return

    try {
      await patchProduct(id, { field, value })
      load()
    } catch {
      setError('Update rejected by guardrails. Check margin requirement and try again.')
    }
  }

  const filteredRows = rows.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Manage stock levels, pricing, and monitor health status.</p>
        </div>
        <div className="w-full md:w-72">
          <Input 
            icon={<Search size={16} />} 
            placeholder="Search products by ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-4">ID / Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price (₹)</th>
                <th className="px-6 py-4 text-slate-400">Cost (₹)</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4 text-center">Velocity</th>
                <th className="px-6 py-4 text-center">Days Left</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{row.id}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{row.category}</td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <input
                        className="w-24 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded px-2 py-1 outline-none font-semibold transition-all"
                        type="number"
                        defaultValue={row.price}
                        onBlur={(e) => onQuickPatch(row.id, 'price', e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400">{row.cost.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <input
                      className={`w-20 bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded px-2 py-1 outline-none font-semibold transition-all ${row.stock < 10 ? 'text-red-500' : ''}`}
                      type="number"
                      defaultValue={row.stock}
                      onBlur={(e) => onQuickPatch(row.id, 'stock', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 text-center text-slate-500">{row.avg_sales_day.toFixed(1)}/d</td>
                  <td className="px-6 py-4 text-center font-mono">{row.days_stock_remaining > 900 ? 'INF' : row.days_stock_remaining}</td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant={row.status === 'CRITICAL' ? 'destructive' : row.status === 'WARNING' ? 'warning' : 'success'}
                      className="shadow-sm"
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/seller/products/${row.id}/edit`}>
                        <Pencil size={14} className="mr-2" /> Edit
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRows.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No products found matching your search.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
