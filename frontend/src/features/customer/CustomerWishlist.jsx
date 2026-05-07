import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '@/services/api'
import { useToast } from '@/shared/components/Toast'
import Spinner from '@/shared/components/Spinner'
import EmptyState from '@/shared/components/EmptyState'

export default function CustomerWishlist({ token, onAddToCart }) {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(null)

  async function loadWishlist() {
    try {
      const data = await apiFetch('/wishlist', {}, token)
      setItems(data)
    } catch (err) {
      toast.error("Failed to load wishlist")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadWishlist() }, [token])

  async function handleRemove(productId) {
    try {
      await apiFetch(`/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' }, token)
      toast.info("Removed from wishlist")
      loadWishlist()
    } catch (e) {
      toast.error("Failed to remove item")
    }
  }

  async function handleAddToCart(productId) {
    setAddingToCart(productId)
    try {
      await onAddToCart(productId, 1)
      toast.success("Added to cart!")
    } catch (e) {
      toast.error("Failed to add to cart")
    } finally {
      setAddingToCart(null)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size="lg" /></div>

  if (items.length === 0) {
    return (
      <div className="customer-content animate-fade-in">
        <div className="customer-page">
          <EmptyState
            title="Your Wishlist is Empty"
            description="Save items you love and keep track of them here."
            icon="❤️"
            action={<Link to="/shop" className="cust-btn-primary">Browse Products</Link>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="customer-content animate-fade-in">
      <div className="customer-page">
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 900, color: '#ecfdf5', marginBottom: 24 }}>Your Wishlist</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 24 }}>
          {items.map(item => (
            <div key={item.product_id} className="cust-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 160, background: 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, marginBottom: 16 }}>
                🎁
              </div>
              <Link to={`/shop/product/${item.product_id}`} style={{ fontSize: 16, fontWeight: 'bold', color: '#ecfdf5', textDecoration: 'none', marginBottom: 8, display: 'block' }}>
                {item.name}
              </Link>
              <div style={{ fontSize: 18, color: '#34d399', fontWeight: 'bold', marginBottom: 16 }}>
                ₹{item.price.toFixed(2)}
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                <button 
                  onClick={() => handleAddToCart(item.product_id)} 
                  className="cust-btn-primary" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  disabled={addingToCart === item.product_id}
                >
                  {addingToCart === item.product_id ? <Spinner size="sm" /> : "Add to Cart"}
                </button>
                <button 
                  onClick={() => handleRemove(item.product_id)} 
                  className="btn btn-secondary" 
                  style={{ padding: '0 12px' }}
                  title="Remove"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
