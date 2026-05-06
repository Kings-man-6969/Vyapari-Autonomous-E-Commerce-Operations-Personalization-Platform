import { useEffect, useState } from 'react'
import { getRecommendations, type Product, getProducts } from '../api'
import { Link, useNavigate } from 'react-router-dom'
import { getAuthSession } from '../auth'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { ShoppingBag, Search, Store, Sparkles, ArrowRight, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

export function CustomerHome() {
  const [recommendations, setRecommendations] = useState<Array<Record<string, unknown>>>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const clerkId = getAuthSession()?.clerkId ?? 'demo-user'
    Promise.all([getRecommendations(clerkId), getProducts()])
      .then(([recs, allProducts]) => {
        setRecommendations(recs)
        setProducts(allProducts.slice(0, 4))
      })
      .catch(() => setError('Could not load home data. Is backend running?'))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/store/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <div className="space-y-16 pb-20">
      {/* Hero / Smart Search */}
      <section className="relative rounded-[var(--radius-3xl)] p-10 md:p-16 premium-shadow overflow-hidden bg-[var(--surface-container-low)] text-[var(--on-surface)] ghost-border">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-[var(--tertiary)] rounded-full blur-[120px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-[var(--primary)] rounded-full blur-[120px] opacity-20 pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full ghost-border bg-[var(--surface-container-highest)]/30 backdrop-blur-md text-label-sm text-[var(--tertiary)] mb-2"
          >
            <Sparkles size={16} />
            AI-Powered Local Discovery
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-display-lg"
          >
            What can we find for you today?
          </motion.h1>
          
          {/* Smart Search Bar */}
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSearch}
            className="relative max-w-2xl mx-auto group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--tertiary)] to-[var(--primary)] rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative flex items-center bg-[var(--surface-container)] backdrop-blur-xl ghost-border rounded-2xl p-2 premium-shadow">
              <Search className="ml-4 mr-2 text-[var(--on-surface-variant)]" size={24} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask for groceries, electronics, hardware..."
                className="flex-1 bg-transparent border-none outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)] text-lg py-3 px-2"
              />
              <Button type="submit" size="lg" className="bg-[var(--tertiary-container)] hover:bg-[var(--tertiary)] text-[var(--on-tertiary-container)] rounded-xl premium-shadow px-8 font-bold">
                Search
              </Button>
            </div>
            
            <div className="flex gap-3 justify-center mt-6 text-sm text-[var(--on-surface-variant)] font-medium tracking-wide">
              <span>Trending:</span>
              <button type="button" onClick={() => setSearchQuery('Organic Milk')} className="hover:text-[var(--tertiary)] transition-colors">Organic Milk</button>
              <button type="button" onClick={() => setSearchQuery('USB C Cable')} className="hover:text-[var(--primary)] transition-colors">USB C Cable</button>
              <button type="button" onClick={() => setSearchQuery('Aashirvaad Atta')} className="hover:text-[var(--tertiary)] transition-colors">Aashirvaad Atta</button>
            </div>
          </motion.form>
        </div>
      </section>

      {error && (
        <div className="bg-red-900/20 text-[#ffb4ab] p-4 rounded-[var(--radius-xl)] ghost-border">
          {error}
        </div>
      )}

      {/* AI For You Strip */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--tertiary)]/10 text-[var(--tertiary)] flex items-center justify-center premium-shadow">
              <Zap size={24} />
            </div>
            <div>
              <h2 className="text-[2rem] font-extrabold tracking-tight text-[var(--on-surface)]">Curated For You</h2>
              <p className="text-[var(--on-surface-variant)] font-medium mt-1">SVD-based personalized recommendations</p>
            </div>
          </div>
          <Button variant="ghost" className="text-[var(--tertiary)] font-semibold" asChild>
            <Link to="/store">View all <ArrowRight size={16} className="ml-2" /></Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {recommendations.map((item, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={String(item.id)}
              className="h-full"
            >
              <Card className="h-full flex flex-col hover:-translate-y-2 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(255,183,131,0.2)] group overflow-hidden glass-card">
                <div className="h-56 bg-[var(--surface-container-highest)] overflow-hidden relative p-6">
                  {/* Abstract placeholder image generator using SVG */}
                  <svg className="absolute inset-0 w-full h-full text-[var(--on-surface-variant)] opacity-20 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-3" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <rect width="100" height="100" fill="currentColor" />
                    <circle cx="50" cy="50" r="30" fill="transparent" stroke="currentColor" strokeWidth="2" />
                    <path d="M 20 80 Q 50 20 80 80" fill="transparent" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge variant={String(item.source) === 'Content-Based' ? 'info' : 'warning'} className="shadow-sm font-bold uppercase tracking-wider text-[10px]">
                      {String(item.source ?? 'Popular')}
                    </Badge>
                  </div>
                  <div className="w-full h-full relative z-10 flex items-center justify-center text-[var(--on-surface)] transform group-hover:scale-110 transition-transform duration-500">
                    <ShoppingBag size={48} className="drop-shadow-xl text-[var(--tertiary)]" />
                  </div>
                </div>
                <CardHeader className="p-5 pb-2">
                  <CardDescription className="text-label-sm text-[var(--tertiary)] mb-2">
                    {String(item.category)}
                  </CardDescription>
                  <CardTitle className="text-xl font-bold line-clamp-1 text-[var(--on-surface)] leading-tight">{String(item.name)}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 flex-1">
                  <div className="text-2xl font-extrabold text-[var(--on-surface)]">
                    ₹{Number(item.price ?? 0).toFixed(2)}
                  </div>
                </CardContent>
                <CardFooter className="p-5 pt-0 ghost-border border-t border-x-0 border-b-0 space-x-0">
                  <Button className="w-full text-sm py-5 mt-4" variant="secondary" asChild>
                    <Link to={`/store/product/${item.id}`}>View Details</Link>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Products Layout */}
      <section className="space-y-8 pt-12 ghost-border border-t border-x-0 border-b-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center premium-shadow">
            <Store size={24} />
          </div>
          <div>
            <h2 className="text-[2rem] font-extrabold tracking-tight text-[var(--on-surface)]">Verified Local Partners</h2>
            <p className="text-[var(--on-surface-variant)] font-medium mt-1">Premium products from trusted sellers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col sm:flex-row overflow-hidden hover:shadow-[0_10px_40px_-10px_rgba(192,193,255,0.15)] transition-shadow duration-300 glass-card">
              <div className="sm:w-2/5 bg-[var(--surface-container-highest)] flex items-center justify-center min-h-[200px] p-8 text-[var(--on-surface-variant)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-[var(--primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Store size={48} className="transform group-hover:scale-110 transition-transform duration-500 text-[var(--primary)] drop-shadow-md" />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="outline" className="text-label-sm text-[var(--on-surface-variant)]">{product.category}</Badge>
                    <span className="font-extrabold text-xl text-[var(--on-surface)]">₹{product.price.toFixed(2)}</span>
                  </div>
                  <h3 className="font-extrabold text-2xl mb-3 line-clamp-1 text-[var(--on-surface)]">{product.name}</h3>
                  <p className="text-[var(--on-surface-variant)] line-clamp-2 md:line-clamp-none mb-6 font-medium leading-relaxed text-sm">
                    {product.description || 'Verified local supplier offering premium quality goods for wholesale and retail customers.'}
                  </p>
                </div>
                <Button className="w-full sm:w-auto self-start bg-transparent border-[var(--outline-variant)]/20 hover:bg-[var(--surface-container-highest)]" variant="outline" asChild>
                  <Link to={`/store/product/${product.id}`}>Check Availability <ArrowRight size={16} className="ml-2" /></Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
