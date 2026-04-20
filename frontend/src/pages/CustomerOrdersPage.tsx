import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Package, Clock, Truck, CheckCircle2, ChevronRight } from 'lucide-react'
import { getMyOrders, type CustomerOrder } from '../api'

export function CustomerOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])

  useEffect(() => {
    getMyOrders().then(setOrders)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="text-emerald-500" size={20} />
      case 'shipped': return <Truck className="text-brand-500" size={20} />
      default: return <Clock className="text-amber-500" size={20} />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered': return <Badge variant="success">Delivered</Badge>
      case 'shipped': return <Badge className="bg-brand-100 text-brand-700">Shipped</Badge>
      default: return <Badge variant="warning">Processing</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="text-brand-500" />
          Order History
        </h1>
        <p className="text-slate-500 mt-1">Track your recent shipments and past purchases.</p>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="text-center p-12 text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
             You haven't placed any orders yet.
          </div>
        ) : (
          orders.map(order => (
            <Card key={order.id} className="p-4 sm:p-6 hover:shadow-md transition-shadow group cursor-pointer flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {getStatusIcon(order.status)}
                </div>
                <div>
                  <h3 className="font-bold text-lg font-mono">{order.id}</h3>
                  <p className="text-sm text-slate-500">Ordered on {new Date(order.created_at).toLocaleDateString()} • {order.items.length} Items</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-1/3">
                <div className="text-right">
                  <div className="font-bold text-lg mb-1">₹{order.total_amount.toFixed(2)}</div>
                  {getStatusBadge(order.status)}
                </div>
                <Link to={`/store/me/orders/${order.id}`} className="text-slate-300 group-hover:text-brand-500 transition-colors">
                  <ChevronRight />
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
