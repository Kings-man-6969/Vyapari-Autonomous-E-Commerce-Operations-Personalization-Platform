import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { clearAllAuthSessions, getAuthLabel, getAuthSession, type DemoRole } from '../auth'
import { useClerk, useUser } from '@clerk/react'
import { useRoleContext } from '../role-context'
import { Store, Search, ShoppingCart, User, Package, LayoutDashboard, Boxes, Star, BarChart3, Activity, Settings, LogOut, Menu, X, ShieldAlert, Tags, PlusCircle, Radar, Heart } from 'lucide-react'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { motion, AnimatePresence } from 'framer-motion'

type Portal = 'customer' | 'seller'

type AppLayoutProps = {
  portal: Portal
}

const customerNav = [
  { to: '/store', label: 'Store', icon: Store },
  { to: '/store/search', label: 'Search', icon: Search },
  { to: '/store/cart', label: 'Cart', icon: ShoppingCart },
  { to: '/store/me/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/store/me/profile', label: 'Profile', icon: User },
  { to: '/store/me/orders', label: 'Orders', icon: Package },
]

const sellerNav = [
  { to: '/seller', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/seller/inventory', label: 'Inventory', icon: Boxes },
  { to: '/seller/pricing', label: 'Pricing', icon: Tags },
  { to: '/seller/reviews', label: 'Reviews', icon: Star },
  { to: '/seller/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/seller/products/add', label: 'Add Product', icon: PlusCircle },
]

const hitlNav = [
  { to: '/hitl', label: 'Action Queue', icon: Activity },
  { to: '/hitl/log', label: 'Audit Log', icon: ShieldAlert },
  { to: '/hitl/agents', label: 'Agent Status', icon: Radar },
  { to: '/hitl/reviews', label: 'Approvals', icon: Star },
  { to: '/hitl/settings', label: 'Settings', icon: Settings },
]

export function AppLayout({ portal }: AppLayoutProps) {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { isLoaded, isSignedIn, user } = useUser()
  const { setSelectedRole } = useRoleContext()
  const [role, setRole] = useState<DemoRole>('guest')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const location = useLocation()
  const userLabel = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Authenticated user'
  const userInitial = (userLabel[0] ?? 'U').toUpperCase()

  useEffect(() => {
    setRole(getAuthSession()?.role ?? 'guest')
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      clearAllAuthSessions()
      setSelectedRole(null)
      setRole('guest')
      navigate('/', { replace: true })
    }
  }, [isLoaded, isSignedIn, navigate, setSelectedRole])

  const authLabel = useMemo(() => getAuthLabel(role), [role])

  const logout = async () => {
    await signOut({ redirectUrl: '/' })
    clearAllAuthSessions()
    setSelectedRole(null)
    setRole('guest')
    navigate('/', { replace: true })
  }

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [location.pathname])

  const CustomerHeader = () => (
    <header className="glass sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/store" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center text-white font-bold text-xl">V</div>
          <span className="font-bold text-xl tracking-tight hidden sm:block">Vyapari</span>
        </Link>
        <nav className="hidden md:flex flex-1 items-center justify-center gap-6">
          {customerNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm font-medium transition-colors hover:text-accent-600 ${
                    isActive ? 'text-accent-600 border-b-2 border-accent-600 pb-1' : 'text-slate-600 dark:text-slate-400'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="hidden sm:inline-flex">{authLabel}</Badge>
          {isSignedIn && (
            <div title={userLabel} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center">
              {userInitial}
            </div>
          )}
          <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {/* Mobile Customer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 overflow-hidden"
          >
            <nav className="flex flex-col p-4 gap-4">
              {customerNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-2 rounded-md font-medium ${
                      isActive ? 'bg-accent-50 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400' : 'text-slate-600 dark:text-slate-400'
                    }`
                  }
                >
                  <item.icon size={20} />
                  {item.label}
                </NavLink>
              ))}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout}>
                  <LogOut size={20} className="mr-3" />
                  Sign Out
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )

  const SellerSidebar = () => (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform hidden lg:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <Link to="/seller" className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-xl shadow-[0_0_15px_rgba(37,99,235,0.5)]">V</div>
          <span className="font-bold text-xl tracking-tight">Merchant OS</span>
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
        <div>
          <h4 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Store Management</h4>
          <nav className="space-y-1">
            {sellerNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/seller'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-brand-900/50 text-brand-400 shadow-[inset_2px_0_0_0_rgb(59,130,246)]' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <h4 className="px-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Autonomous Agents</h4>
          <nav className="space-y-1">
            {hitlNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive ? 'bg-emerald-900/30 text-emerald-400 shadow-[inset_2px_0_0_0_rgb(16,185,129)]' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-4 px-2">
          <Badge variant="outline" className="border-slate-700 text-slate-400">{authLabel}</Badge>
          {isSignedIn && (
            <div title={userLabel} className="w-8 h-8 rounded-full bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center">
              {userInitial}
            </div>
          )}
        </div>
        <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-900" onClick={logout}>
          <LogOut size={18} className="mr-3" />
          Disconnect
        </Button>
      </div>
    </aside>
  )

  const SellerMobileHeader = () => (
    <header className="lg:hidden glass sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950 text-white">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-xl">V</div>
          <span className="font-bold tracking-tight">Merchant OS</span>
        </div>
        <button className="p-2 text-slate-300" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-800 bg-slate-950 overflow-hidden"
          >
            <nav className="flex flex-col p-4 gap-2">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Store</div>
              {sellerNav.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 p-2 rounded-md text-sm ${isActive ? 'bg-brand-900/50 text-brand-400' : 'text-slate-400'}`}>
                  <item.icon size={18} />{item.label}
                </NavLink>
              ))}
              <div className="text-xs font-semibold text-slate-500 uppercase mb-1 mt-4">Agents</div>
              {hitlNav.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 p-2 rounded-md text-sm ${isActive ? 'bg-emerald-900/30 text-emerald-400' : 'text-slate-400'}`}>
                  <item.icon size={18} />{item.label}
                </NavLink>
              ))}
              <Button variant="ghost" className="mt-4 text-slate-400 justify-start" onClick={logout}>
                <LogOut size={18} className="mr-2" /> Sign Out
              </Button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )

  if (portal === 'customer') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
        <CustomerHeader />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Outlet />
        </main>
      </div>
    )
  }

  // Seller Portal Layout
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0e0e10] text-slate-900 dark:text-slate-200 font-sans lg:pl-64">
      <SellerSidebar />
      <SellerMobileHeader />
      <main className="p-4 md:p-8 max-w-400 mx-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
