import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'

export default function CustomerOrders({ token }) {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await apiFetch('/orders', {}, token)
        setOrders(data)
      } catch (err) {
        toast.error("Failed to load orders")
      } finally {
        setLoading(false)
      }
    }
    loadOrders()
  }, [token, toast])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size="lg" /></div>

  if (orders.length === 0) {
    return (
      <div className="customer-content animate-fade-in">
        <div className="customer-page">
          <EmptyState
            title="No orders yet"
            description="You haven't placed any orders. Start exploring our catalog!"
            icon="📦"
            action={<Link to="/shop" className="cust-btn-primary">Browse Products</Link>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page">
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 900, color: '#ecfdf5', marginBottom: 24 }}>Your Orders</h1>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {orders.map(order => (
            <div key={order.order_id} className="cust-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#a7f3d0', marginBottom: 4 }}>Order #{order.order_id}</div>
                  <div style={{ fontSize: 12, color: 'rgba(167,243,208,0.5)' }}>Placed on {new Date(order.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#34d399', marginBottom: 4 }}>₹{order.total_amount.toFixed(2)}</div>
                  <span style={{ 
                    padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase',
                    background: order.status === 'delivered' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                    color: order.status === 'delivered' ? '#34d399' : '#fcd34d'
                  }}>
                    {order.status}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {order.items.map(item => (
                  <div key={item.order_item_id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 16, alignItems: 'center' }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      📦
                    </div>
                    <div>
                      <div style={{ color: '#ecfdf5', fontSize: 14 }}>{item.quantity}x Product ID: {item.product_id}</div>
                    </div>
                    <div style={{ color: '#a7f3d0', fontSize: 14 }}>₹{item.line_total.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
