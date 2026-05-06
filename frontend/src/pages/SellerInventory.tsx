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
    <div className="space-y-8 max-w-[90rem] mx-auto pb-10 px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[var(--surface-container-low)] p-8 rounded-[var(--radius-3xl)] premium-shadow ghost-border">
        <div>
          <h1 className="text-[2.5rem] font-extrabold text-[var(--on-surface)] tracking-tight leading-tight">Inventory Management</h1>
          <p className="text-[var(--on-surface-variant)] mt-2 font-medium">Manage stock levels, pricing, and monitor health status.</p>
        </div>
        <div className="w-full md:w-80">
          <Input 
            icon={<Search size={16} />} 
            placeholder="Search products by ID or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-[var(--surface-container-highest)] border-transparent focus:bg-[var(--surface-container)] ghost-border"
          />
        </div>
      </div>

      {error && (
        <div className="bg-[#93000a]/20 text-[#ffb4ab] p-5 rounded-[var(--radius-xl)] ghost-border text-sm flex items-center gap-3 font-semibold shadow-inner">
          <AlertCircle size={20} /> {error}
        </div>
      )}

      <div className="bg-[var(--surface-container-low)] ghost-border rounded-[var(--radius-3xl)] overflow-hidden premium-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[var(--surface-container-highest)]/50 text-[var(--on-surface-variant)] font-semibold ghost-border border-x-0 border-t-0">
              <tr>
                <th className="px-6 py-5 uppercase tracking-[0.05em] text-[0.6875rem]">ID / Product</th>
                <th className="px-6 py-5 uppercase tracking-[0.05em] text-[0.6875rem]">Category</th>
                <th className="px-6 py-5 uppercase tracking-[0.05em] text-[0.6875rem]">Price (₹)</th>
                <th className="px-6 py-5 uppercase tracking-[0.05em] text-[0.6875rem] font-medium opacity-60">Cost (₹)</th>
                <th className="px-6 py-5 uppercase tracking-[0.05em] text-[0.6875rem]">Stock</th>
                <th className="px-6 py-5 text-center uppercase tracking-[0.05em] text-[0.6875rem]">Velocity</th>
                <th className="px-6 py-5 text-center uppercase tracking-[0.05em] text-[0.6875rem]">Days Left</th>
                <th className="px-6 py-5 uppercase tracking-[0.05em] text-[0.6875rem]">Status</th>
                <th className="px-6 py-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--outline-variant)]/10">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-container)] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-[var(--on-surface)] text-base">{row.name}</div>
                    <div className="text-[0.6875rem] text-[var(--on-surface-variant)] uppercase tracking-wider font-mono mt-1">{row.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[var(--surface-container-highest)] text-[var(--on-surface)] ghost-border">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <input
                        className="w-24 bg-transparent border border-transparent hover:border-[var(--outline-variant)]/40 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 rounded-[var(--radius-xl)] px-4 py-2 outline-none font-bold transition-all text-[var(--on-surface)] bg-[var(--surface-container)] shadow-inner"
                        type="number"
                        defaultValue={row.price}
                        onBlur={(e) => onQuickPatch(row.id, 'price', e.target.value)}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[var(--on-surface-variant)] font-medium">₹{row.cost.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <input
                      className={`w-24 border border-transparent hover:border-[var(--outline-variant)]/40 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 rounded-[var(--radius-xl)] px-4 py-2 outline-none font-bold transition-all shadow-inner ${row.stock < 10 ? 'text-[#ffb4ab] bg-[#93000a]/20' : 'text-[var(--on-surface)] bg-[var(--surface-container)]'}`}
                      type="number"
                      defaultValue={row.stock}
                      onBlur={(e) => onQuickPatch(row.id, 'stock', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 text-center text-[var(--on-surface-variant)] font-medium">{row.avg_sales_day.toFixed(1)}/d</td>
                  <td className="px-6 py-4 text-center font-mono font-medium text-[var(--on-surface)]">{row.days_stock_remaining > 900 ? 'INF' : row.days_stock_remaining}</td>
                  <td className="px-6 py-4">
                    <Badge 
                      variant={row.status === 'CRITICAL' ? 'destructive' : row.status === 'WARNING' ? 'warning' : 'success'}
                      className="shadow-[inset_0_1px_rgba(255,255,255,0.1)] font-bold uppercase tracking-widest text-[10px]"
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="secondary" size="sm" className="h-9 shadow-sm px-4" asChild>
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
            <div className="p-16 text-center text-[var(--on-surface-variant)] bg-[var(--surface-container)]/50">
              <div className="w-16 h-16 mx-auto bg-[var(--surface-container-highest)] rounded-full flex items-center justify-center mb-6 ghost-border">
                <Search className="text-[var(--on-surface-variant)]" size={24} />
              </div>
              <p className="font-bold text-xl text-[var(--on-surface)] mb-2">No products found</p>
              <p className="text-lg">Try adjusting your search query.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
