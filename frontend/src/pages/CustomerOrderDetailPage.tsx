import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyOrder, type CustomerOrder } from '../api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ArrowLeft, Receipt } from 'lucide-react'

type OrderItem = {
  product_id: string
  name: string
  price: number
  qty: number
  subtotal: number
}

export function CustomerOrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState<CustomerOrder | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) {
      return
    }

    getMyOrder(id)
      .then(setOrder)
      .catch(() => setError('Could not load order details.'))
  }, [id])

  if (error) {
    return <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>
  }

  if (!order) {
    return <Card className="p-8 text-center text-slate-500">Loading order details...</Card>
  }

  const items = order.items as unknown as OrderItem[]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Receipt className="text-brand-500" />
            Order {order.id}
          </h1>
          <p className="text-slate-500 mt-1">Placed on {new Date(order.created_at).toLocaleString()}</p>
        </div>
        <Button variant="ghost" asChild>
          <Link to="/store/me/orders">
            <ArrowLeft size={16} className="mr-2" /> Back
          </Link>
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex justify-between">
          <div className="text-sm text-slate-500">Status</div>
          <div className="font-semibold capitalize">{order.status}</div>
        </div>
        <div className="flex justify-between">
          <div className="text-sm text-slate-500">Total Amount</div>
          <div className="font-bold text-lg">₹{order.total_amount.toFixed(2)}</div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
            <tr>
              <th className="px-6 py-4 text-left">Item</th>
              <th className="px-6 py-4 text-left">Qty</th>
              <th className="px-6 py-4 text-left">Price</th>
              <th className="px-6 py-4 text-left">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={`${order.id}-${item.product_id}`}>
                <td className="px-6 py-4">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{item.product_id}</div>
                </td>
                <td className="px-6 py-4">{item.qty}</td>
                <td className="px-6 py-4">₹{item.price.toFixed(2)}</td>
                <td className="px-6 py-4">₹{item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
