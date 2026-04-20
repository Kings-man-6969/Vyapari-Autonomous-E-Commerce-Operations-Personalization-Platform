import { useEffect, useMemo, useState } from 'react'
import { addToCart, checkoutCart, getCart, getProducts, removeCartItem, type CartItem, type Product } from '../api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ShoppingCart, Plus, Check, ArrowRight, Package, Loader2, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function CustomerCartPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [message, setMessage] = useState('')

  const loadCart = () => getCart().then(setCart)

  useEffect(() => {
    loadCart()
    getProducts().then((items) => setProducts(items.slice(0, 4)))
  }, [])

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart])
  const tax = total * 0.18
  const finalTotal = total + tax

  const quickAdd = async (productId: string) => {
    setAddingId(productId)
    await addToCart({ product_id: productId, qty: 1 })
    await loadCart()
    setAddingId(null)
  }

  const removeItem = async (itemId: number) => {
    await removeCartItem(itemId)
    await loadCart()
  }

  const handleCheckout = async () => {
    setIsCheckingOut(true)
    try {
      const res = await checkoutCart()
      setMessage(`Success! Order ${res.order_id} placed.`)
      await loadCart()
    } catch {
      setMessage('Failed to checkout. Items may be out of stock.')
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="text-brand-500" />
          Your Shopping Cart
        </h1>
        <p className="text-slate-500 mt-1">Review your items and proceed securely to checkout.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${message.includes('Success') ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'} border`}>
          {message.includes('Success') ? <Check size={18} /> : <ShoppingCart size={18} />} {message}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-semibold px-2">Cart Items ({cart.length})</h2>
            </div>
            
            {cart.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Package size={48} className="mb-4 text-slate-300 dark:text-slate-700" />
                <p>Your cart is empty.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      key={item.id} 
                      className="p-6 flex items-center justify-between"
                    >
                      <div className="flex gap-4 items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center text-brand-600 font-bold border border-slate-200 dark:border-slate-700">
                          <span className="text-xl leading-none">V</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</h3>
                          <p className="text-sm text-slate-500">Qty: {item.qty} × ₹{item.price.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-slate-900 dark:text-white">
                          ₹{item.subtotal.toFixed(2)}
                        </p>
                        <Button variant="ghost" size="sm" className="mt-2 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(item.id)}>
                          <Trash2 size={14} className="mr-2" /> Remove
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Card>

          <div>
            <h2 className="text-xl font-bold mb-4">Quick Add Recommended</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {products.map((product) => (
                <Card key={product.id} className="p-4 flex items-center justify-between hover:border-brand-300 transition-colors">
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="font-bold text-brand-600 dark:text-brand-400">₹{product.price.toFixed(2)}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="shrink-0"
                    onClick={() => quickAdd(product.id)}
                    disabled={addingId === product.id}
                  >
                    {addingId === product.id ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div>
          <Card className="p-6 sticky top-24">
            <h2 className="font-bold text-lg mb-6">Order Summary</h2>
            <div className="space-y-4 text-sm mb-6">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Estimated Tax (18%)</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Shipping</span>
                <span className="text-emerald-500 font-medium tracking-tight">FREE</span>
              </div>
              
              <hr className="border-slate-200 dark:border-slate-800" />
              
              <div className="flex justify-between items-center">
                <span className="font-bold text-base">Total</span>
                <span className="font-bold text-xl text-brand-600 dark:text-brand-400">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
            
            <Button 
               className="w-full relative" 
               size="lg" 
               disabled={cart.length === 0 || isCheckingOut}
               onClick={handleCheckout}
            >
              {isCheckingOut ? <Loader2 className="animate-spin" size={18} /> : <>Proceed to Checkout <ArrowRight className="ml-2" size={18} /></>}
            </Button>
            
            <div className="mt-6 flex flex-col items-center gap-2 text-xs text-slate-500">
              <div className="flex gap-2">
                <div className="flex items-center gap-1"><Check size={14} className="text-emerald-500"/> Secure SSL</div>
                <div className="flex items-center gap-1"><Check size={14} className="text-emerald-500"/> Local Delivery</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
