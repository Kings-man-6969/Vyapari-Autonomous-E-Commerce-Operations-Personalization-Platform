import { useEffect, useState } from 'react'
import { getRecommendations, type Product, getProducts } from '../api'
import { Link } from 'react-router-dom'
import { getAuthSession } from '../auth'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ShoppingBag, Search, Store, Sparkles, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

export function CustomerHome() {
  const [recommendations, setRecommendations] = useState<Array<Record<string, unknown>>>([])
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const clerkId = getAuthSession()?.clerkId ?? 'demo-user'
    Promise.all([getRecommendations(clerkId), getProducts()])
      .then(([recs, allProducts]) => {
        setRecommendations(recs)
        setProducts(allProducts.slice(0, 4))
      })
      .catch(() => setError('Could not load home data. Is backend running?'))
  }, [])

  return (
    <div className="space-y-12">
      {/* Hero / Welcome */}
      <section className="bg-brand-900 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-accent-500 rounded-full blur-[100px] opacity-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-brand-500 rounded-full blur-[120px] opacity-40 pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <Badge className="bg-accent-500/20 text-accent-100 hover:bg-accent-500/30 mb-6 border-accent-400/30">
            <Sparkles className="mr-2" size={14} /> Smart Recommendations Active
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-white">
            Welcome to the Modern Local Market
          </h1>
          <p className="text-brand-100 text-lg mb-8 max-w-xl">
            Discover products tailored specifically for you. Our intelligent AI engine learns your preferences to bring local goods right to your fingertips.
          </p>
          <div className="flex gap-4">
            <Button size="lg" className="bg-accent-600 hover:bg-accent-700 text-white border-0 shadow-lg" asChild>
              <Link to="/store/search"><Search className="mr-2" size={18} /> Search Catalog</Link>
            </Button>
            <Button size="lg" variant="glass" asChild>
              <Link to="/store">Browse All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {/* AI For You Strip */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 text-accent-600 flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Curated For You</h2>
            <p className="text-sm text-slate-500">AI-picked based on your shopping patterns</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recommendations.map((item, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={String(item.id)}
            >
              <Card className="h-full flex flex-col hover:shadow-lg transition-all hover:border-brand-300 dark:hover:border-brand-700 group overflow-hidden">
                <div className="h-40 bg-slate-100 dark:bg-slate-900 overflow-hidden relative">
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge variant={String(item.source) === 'Content-Based' ? 'info' : 'success'} className="shadow-sm">
                      {String(item.source ?? 'Popular')}
                    </Badge>
                  </div>
                  <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700 transform group-hover:scale-110 transition-transform duration-500">
                    <ShoppingBag size={48} />
                  </div>
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold tracking-wider uppercase text-brand-600 dark:text-brand-400">
                    {String(item.category)}
                  </CardDescription>
                  <CardTitle className="text-lg line-clamp-1">{String(item.name)}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-1">
                  <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    ₹{Number(item.price ?? 0).toFixed(2)}
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button className="w-full group-hover:bg-brand-600 transition-colors" variant="secondary" asChild>
                    <Link to={`/store/product/${item.id}`}>View Details</Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Products Layout */}
      <section className="space-y-6 pt-8 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Local Wholesale Partners</h2>
            <p className="text-sm text-slate-500">Highest rated bulk suppliers near you</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col sm:flex-row overflow-hidden hover:shadow-md transition-shadow">
              <div className="sm:w-1/3 bg-slate-50 dark:bg-slate-900 flex items-center justify-center min-h-[160px] p-6 text-slate-300">
                <Store size={40} />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline">{product.category}</Badge>
                    <span className="font-bold text-lg">₹{product.price.toFixed(2)}</span>
                  </div>
                  <h3 className="font-bold text-xl mb-2 line-clamp-1">{product.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 md:line-clamp-none mb-4">
                    {product.description || 'Verified local supplier offering premium quality goods for wholesale and retail customers.'}
                  </p>
                </div>
                <Button className="w-full sm:w-auto self-start" variant="outline" asChild>
                  <Link to={`/store/product/${product.id}`}>Check Availability</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
