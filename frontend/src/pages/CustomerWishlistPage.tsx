import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addToCart, getWishlist, removeFromWishlist, type WishlistItem } from '../api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Heart, ShoppingCart, Trash2 } from 'lucide-react'

export function CustomerWishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [error, setError] = useState('')

  const load = () => {
    getWishlist()
      .then(setItems)
      .catch(() => setError('Could not load wishlist.'))
  }

  useEffect(() => {
    load()
  }, [])

  const remove = async (productId: string) => {
    await removeFromWishlist(productId)
    load()
  }

  const moveToCart = async (productId: string) => {
    await addToCart({ product_id: productId, qty: 1 })
    await removeFromWishlist(productId)
    load()
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Heart className="text-brand-500" />
          Wishlist
        </h1>
        <p className="text-slate-500 mt-1">Saved products you might want to buy later.</p>
      </div>

      {error && <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">{error}</div>}

      {items.length === 0 ? (
        <Card className="p-10 text-center text-slate-500">
          Wishlist is empty. Explore the <Link className="text-brand-600 hover:underline" to="/store/search">catalog</Link> and save products.
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-semibold text-lg">{item.name}</h3>
                  <p className="text-sm text-slate-500">{item.category}</p>
                </div>
                <Badge variant={item.stock > 0 ? 'success' : 'warning'}>{item.stock > 0 ? 'In stock' : 'Low stock'}</Badge>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">{item.description || 'Saved from your browsing history.'}</p>
              <div className="flex justify-between items-center">
                <div className="font-bold text-xl">₹{item.price.toFixed(2)}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => remove(item.product_id)}>
                    <Trash2 size={14} className="mr-2" /> Remove
                  </Button>
                  <Button size="sm" onClick={() => moveToCart(item.product_id)}>
                    <ShoppingCart size={14} className="mr-2" /> Move to cart
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
