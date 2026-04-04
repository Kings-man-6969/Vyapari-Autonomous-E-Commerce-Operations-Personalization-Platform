import React, { useEffect, useState } from 'react'
import api from '../api'
import { Card, Badge, Loader } from '../components/UI'
import { ShoppingBag, Star, Search, X, AlertCircle } from 'lucide-react'

export default function CustomerHome() {
  const [products, setProducts] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)
  const [searchActive, setSearchActive] = useState(false)
  const [cart, setCart] = useState([])
  const [userId, setUserId] = useState('U001')
  const [showCart, setShowCart] = useState(false)

  useEffect(() => {
    fetchData()
  }, [userId])

  const fetchData = async () => {
    try {
      setError(null)
      setLoading(true)
      const [productsRes, recRes] = await Promise.all([
        api.get('/products'),
        api.get(`/recommendations/${userId}`)
      ])
      setProducts(productsRes.data)
      setRecommendations(recRes.data)
    } catch (err) {
      setError('Failed to load data. Please check your connection.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    try {
      setError(null)
      const { data } = await api.get('/search', { params: { q: searchQuery } })
      setProducts(data)
      setSearchActive(true)
    } catch (err) {
      setError('Search failed. Please try again.')
      console.error(err)
    }
  }

  const resetSearch = () => {
    fetchData()
    setSearchQuery('')
    setSearchActive(false)
  }

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        return [...prev, { ...product, quantity: 1 }]
      }
    })
  }

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId))
  }

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  if (loading) return <div className="p-8"><Loader /></div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="text-indigo-400" size={24} />
            <h1 className="text-2xl font-bold">Vyapari Store</h1>
            <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-1 rounded-full">Customer Dashboard</span>
            <div className="ml-4 flex items-center gap-2">
              <span className="text-sm text-gray-400">User:</span>
              <select
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                {['U001', 'U002', 'U003', 'U004', 'U005', 'U006', 'U007'].map(id => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search products (e.g., 'electronics')"
                className="pl-10 pr-4 py-2 w-80 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium"
            >
              Search
            </button>
            {searchActive && (
              <button
                type="button"
                onClick={resetSearch}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium flex items-center gap-2"
              >
                <X size={16} />
                Reset
              </button>
            )}
          </form>
          <div className="flex items-center gap-4">
            <button
              className="text-gray-400 hover:text-white relative"
              onClick={() => setShowCart(true)}
            >
              Cart ({cartCount})
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button className="text-gray-400 hover:text-white">Account</button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <span className="text-red-300">{error}</span>
            <button
              className="ml-auto text-red-300 hover:text-white"
              onClick={() => setError(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Hero */}
        <section className="mb-12 text-center">
          <h2 className="text-4xl font-bold mb-4">Discover Products Tailored for You</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Vyapari's AI recommends items based on your taste. Browse, search, and shop with confidence.
          </p>
        </section>

        {/* Recommendations */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <Star size={20} className="text-yellow-500" />
              Recommended For You
            </h3>
            <span className="text-sm text-gray-500">Based on your past ratings</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {recommendations.slice(0, 6).map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
            ))}
          </div>
        </section>

        {/* All Products */}
        <section>
          <h3 className="text-2xl font-bold mb-6">All Products</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={addToCart} />
            ))}
          </div>
        </section>
      </main>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-2xl font-bold">Your Cart</h3>
              <button
                onClick={() => setShowCart(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Your cart is empty</p>
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          <p className="text-sm text-gray-400">₹{item.price.toFixed(2)} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-indigo-400">₹{(item.price * item.quantity).toFixed(2)}</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Total</span>
                      <span>₹{cartTotal.toFixed(2)}</span>
                    </div>
                    <button className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold">
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-gray-800 py-8 text-center text-gray-500 text-sm">
        <p>Vyapari Customer Dashboard — Part of the Autonomous E‑Commerce Platform</p>
        <p className="mt-2">This is a demo. Products and ratings are simulated.</p>
      </footer>
    </div>
  )
}

function ProductCard({ product, onAddToCart }) {
  const stockColor = product.stock > 20 ? 'green' : product.stock > 5 ? 'yellow' : 'red'
  const colorMap = {
    green: 'bg-green-900 text-green-300',
    yellow: 'bg-yellow-900 text-yellow-300',
    red: 'bg-red-900 text-red-300',
  }

  const handleViewDetails = () => {
    alert(`Product: ${product.name}\nCategory: ${product.category}\nPrice: ₹${product.price.toFixed(2)}\nStock: ${product.stock}\nID: ${product.id}`)
  }

  return (
    <Card className="hover:scale-[1.02] transition-transform duration-300">
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <Badge color="gray">{product.category}</Badge>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colorMap[stockColor]}`}>
            {product.stock} in stock
          </span>
        </div>
        <h4 className="font-bold text-lg mb-2 truncate">{product.name}</h4>
        <p className="text-2xl font-bold text-indigo-400 mb-4">₹{product.price.toFixed(2)}</p>
        <div className="flex justify-between items-center">
          <button
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm"
            onClick={() => onAddToCart(product)}
          >
            Add to Cart
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm"
            onClick={handleViewDetails}
          >
            View Details
          </button>
        </div>
      </div>
    </Card>
  )
}