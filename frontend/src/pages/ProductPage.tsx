import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { addToCart, addToWishlist, getProduct, getWishlist, removeFromWishlist, submitReview, type Product } from '../api'
import { useParams, Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Star, ShieldCheck, Box, MessageSquarePlus, RefreshCw, ShoppingCart, ArrowLeft, Heart } from 'lucide-react'
import { motion } from 'framer-motion'

type ProductDetails = Product & { reviews: Array<Record<string, unknown>> }

export function ProductPage() {
  const { id } = useParams()
  const [product, setProduct] = useState<ProductDetails | null>(null)
  const [stars, setStars] = useState(5)
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)

  useEffect(() => {
    if (!id) return
    getProduct(id).then(setProduct)
    getWishlist()
      .then((items) => setIsWishlisted(items.some((item) => item.product_id === id)))
      .catch(() => {
        // ignore wishlist read errors on detail page
      })
  }, [id])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!id || text.trim().length < 10) {
      setMessage('Review text must be at least 10 characters.')
      return
    }

    setIsSubmitting(true)
    try {
      await submitReview({
        product_id: id,
        user_id: 'demo-user',
        stars,
        text,
      })
      setText('')
      setMessage('Thank you. Your review is pending moderation.')
      // Optimistic upate could be done here, but we'll wait for backend refresh
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddToCart = async () => {
    if (!id) return
    await addToCart({ product_id: id, qty: 1 })
    setMessage('Added to cart.')
  }

  const toggleWishlist = async () => {
    if (!id) return
    if (isWishlisted) {
      await removeFromWishlist(id)
      setIsWishlisted(false)
      setMessage('Removed from wishlist.')
      return
    }
    await addToWishlist(id)
    setIsWishlisted(true)
    setMessage('Saved to wishlist.')
  }

  if (!product) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <RefreshCw className="animate-spin text-brand-500" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="mb-6">
        <Button variant="ghost" asChild className="pl-0 text-slate-500 hover:text-slate-900">
          <Link to="/store"><ArrowLeft size={16} className="mr-2"/> Back to Shop</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Product Image Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-slate-100 dark:bg-slate-900 rounded-3xl aspect-square flex items-center justify-center relative shadow-inner overflow-hidden"
        >
          <Box size={120} className="text-slate-300 dark:text-slate-800" />
          <div className="absolute top-4 left-4">
            <Badge variant="secondary" className="uppercase font-bold tracking-wider">{product.category}</Badge>
          </div>
        </motion.div>

        {/* Product Details Panel */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col justify-center"
        >
          <div className="mb-6">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-4 mb-6">
              <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-accent-600">
                ₹{product.price.toFixed(2)}
              </div>
              <Badge variant="outline" className="text-sm">
                <ShieldCheck size={14} className="mr-1 text-emerald-500" /> Verified Supplier
              </Badge>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
              {product.description || 'Premium quality product directly sourced from trusted local wholesalers.'}
            </p>
          </div>

          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex gap-4">
            <Button size="lg" className="flex-1 text-lg" onClick={handleAddToCart}>
              <ShoppingCart className="mr-2" /> Add to Cart
            </Button>
            <Button size="lg" variant="outline" onClick={toggleWishlist}>
              <Heart className="mr-2" fill={isWishlisted ? 'currentColor' : 'none'} />
              {isWishlisted ? 'Saved' : 'Wishlist'}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Reviews Section */}
      <div className="pt-16 border-t border-slate-200 dark:border-slate-800 grid md:grid-cols-[1fr_2fr] gap-12">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquarePlus className="text-brand-500" /> Write a Review
            </h2>
            <p className="text-sm text-slate-500 mt-2">Share your experience with the Vyapari community.</p>
          </div>
          
          <Card className="p-6">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStars(s)}
                      className={`p-2 rounded-full transition-colors ${stars >= s ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'text-slate-300 hover:text-amber-300'}`}
                    >
                      <Star fill={stars >= s ? "currentColor" : "none"} size={24} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Review Details</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full flex min-h-[120px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-950 resize-none"
                  placeholder="What did you like or dislike about this product?"
                  maxLength={500}
                />
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>Minimum 10 characters</span>
                  <span>{text.length}/500</span>
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || text.length < 10} className="w-full">
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </Button>
              
              {message && (
                <div className="p-3 rounded-md bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                  {message}
                </div>
              )}
            </form>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>
          {product.reviews.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
              <Star className="mx-auto text-slate-300 mb-2" size={32} />
              <p className="text-slate-500">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {product.reviews.map((review) => {
                const sentiment = String(review.sentiment ?? 'pending');
                const sentimentColors = {
                  positive: 'bg-emerald-100 text-emerald-800',
                  negative: 'bg-red-100 text-red-800',
                  neutral: 'bg-blue-100 text-blue-800',
                  pending: 'bg-slate-100 text-slate-800'
                }[sentiment] || 'bg-slate-100 text-slate-800';

                return (
                  <Card key={String(review.id)} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex text-amber-500">
                        {Array.from({ length: Number(review.stars) }).map((_, i) => (
                          <Star key={i} size={16} fill="currentColor" />
                        ))}
                      </div>
                      <Badge variant="outline" className={`uppercase text-[10px] font-bold ${sentimentColors} border-transparent`}>
                        {sentiment}
                      </Badge>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 italic">"{String(review.text)}"</p>
                    {Boolean(review.draft_response) && review.status === 'published' && (
                      <div className="mt-4 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-brand-100 dark:border-brand-900/50">
                        <p className="text-xs font-bold text-brand-600 uppercase mb-2">Response from Store</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{String(review.draft_response)}</p>
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
