import React, { useEffect, useState } from 'react'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import PageHeader from '@/shared/components/PageHeader'
import { SpinnerPage } from '@/shared/components/Spinner'

export default function SellerOrders({ token }) {
  const toast = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  async function loadOrders() {
    setLoading(true)
    try {
      const data = await apiFetch('/seller/orders', {}, token)
      setOrders(data || [])
    } catch (e) {
      toast.error(e.message || "Failed to load orders")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [token])

  async function handleStatusChange(orderItemId, newStatus) {
    try {
      await apiFetch(`/seller/orders/${orderItemId}/status?status=${newStatus}`, { method: 'PUT' }, token)
      toast.success(`Order status updated to ${newStatus}`)
      loadOrders() // Refresh orders after changing status
    } catch (e) {
      toast.error(e.message || "Failed to update status")
    }
  }

  if (loading) return <SpinnerPage message="Loading orders..." />

  return (
    <div className="animate-fade-in">
      <PageHeader 
        title="Order Management" 
        description="View and update the status of your orders."
      />

      <div className="surface-card">
        {orders.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No orders found.
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order Item ID</th>
                  <th>Product ID</th>
                  <th>Quantity</th>
                  <th>Line Total</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.order_item_id}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{o.order_item_id}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{o.product_id}</td>
                    <td>{o.quantity}</td>
                    <td>₹{o.line_total.toFixed(2)}</td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <select 
                        style={{ padding: '6px 12px', background: 'var(--color-bg-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--r-md)' }}
                        onChange={(e) => handleStatusChange(o.order_item_id, e.target.value)}
                        value={o.status || ""}
                      >
                        <option value="" disabled>Update Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
