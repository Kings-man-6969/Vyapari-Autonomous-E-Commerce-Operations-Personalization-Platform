import { useEffect, useMemo, useState } from 'react'
import { getProducts, searchProducts, type Product } from '../api'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Search, MapPin, Store, Sparkles, Filter, PackageOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function ShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    getProducts().then(setProducts).catch(() => setError('Could not load products'))
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      if (query.length === 0) {
        getProducts().then(setProducts)
      }
      return
    }
    const timer = setTimeout(() => {
      setIsSearching(true)
      searchProducts(query)
        .then((results) => {
          const normalized: Product[] = results.map((item) => ({
            id: String(item.id),
            name: String(item.name),
            category: String(item.category),
            price: Number(item.price),
            cost: 0,
            stock: 0,
            description: '',
          }))
          setProducts(normalized)
        })
        .catch(() => setError('Search failed'))
        .finally(() => setIsSearching(false))
    }, 400)

    return () => clearTimeout(timer)
  }, [query])

  const inStock = useMemo(() => products.filter((p) => p.stock === 0 || p.stock > 0), [products])

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <Store className="text-brand-500" />
            Local Marketplace
          </h1>
          <p className="text-slate-500 mt-2 flex items-center gap-2">
            <MapPin size={16} /> Delivering near you
          </p>
        </div>

        <div className="w-full md:w-96 relative group">
          <div className="absolute inset-0 bg-brand-500/20 rounded-xl blur-md group-hover:bg-brand-500/30 transition-colors" />
          <div className="relative bg-white dark:bg-slate-900 flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-brand-500">
            {isSearching ? <Sparkles className="animate-pulse text-brand-500" /> : <Search className="text-slate-400" />}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Vyapari AI to find anything..."
              className="flex-1 bg-transparent border-0 focus:ring-0 text-sm outline-none placeholder:text-slate-400"
            />
            {query.length > 2 && <Badge variant="secondary" className="text-[10px]">AI Search</Badge>}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {query ? `Search Results for "${query}"` : 'All Products'}
          <span className="text-slate-400 text-sm font-normal">({inStock.length})</span>
        </h2>
        <Button variant="outline" size="sm"><Filter size={16} className="mr-2"/> Filters</Button>
      </div>

      {inStock.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center text-slate-500">
          <PackageOpen size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-900 dark:text-slate-100">No products found</p>
          <p className="text-sm">Try searching for generic terms like 'rice', 'oil', or 'electronics'.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <AnimatePresence>
            {inStock.map((product, idx) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                key={product.id}
              >
                <Card className="h-full flex flex-col hover:border-brand-500/50 transition-colors">
                  <div className="h-48 bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative rounded-t-xl overflow-hidden">
                    <Store className="text-slate-300 dark:text-slate-700" size={48} />
                    <div className="absolute top-3 right-3">
                      {product.stock > 0 ? (
                        <Badge variant={product.stock < 10 ? 'warning' : 'success'}>
                          {product.stock} in stock
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">In Stock</Badge>
                      )}
                    </div>
                  </div>
                  
                  <CardHeader className="p-4 pb-0 flex-1">
                    <CardDescription className="uppercase tracking-wider text-[10px] font-bold text-brand-600">
                      {product.category}
                    </CardDescription>
                    <CardTitle className="text-lg leading-tight mt-1 line-clamp-2">{product.name}</CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-4 pt-2">
                    <div className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-accent-600">
                      ₹{product.price.toFixed(2)}
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-4 pt-0">
                    <Button className="w-full" asChild>
                      <Link to={`/store/product/${product.id}`}>View Product</Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
