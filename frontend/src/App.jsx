import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, Package, Star, ClipboardList, Store } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Recommendations from './pages/Recommendations'
import Inventory from './pages/Inventory'
import Reviews from './pages/Reviews'
import Decisions from './pages/Decisions'
import CustomerHome from './pages/CustomerHome'

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/recommendations', icon: ShoppingBag,   label: 'Recommendations' },
  { to: '/inventory',    icon: Package,          label: 'Inventory'       },
  { to: '/reviews',      icon: Star,             label: 'Reviews'         },
  { to: '/decisions',    icon: ClipboardList,    label: 'Decisions'       },
  { to: '/store',        icon: Store,            label: 'Store'           },
]

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-gray-800">
          <h1 className="text-xl font-bold text-indigo-400 tracking-wide">🛒 Vyapari</h1>
          <p className="text-xs text-gray-500 mt-0.5">The Smart Merchant</p>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-800 text-xs text-gray-600">
          MVP v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Routes>
          <Route path="/"               element={<Dashboard />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/inventory"      element={<Inventory />} />
          <Route path="/reviews"        element={<Reviews />} />
          <Route path="/decisions"      element={<Decisions />} />
          <Route path="/store"          element={<CustomerHome />} />
        </Routes>
      </main>
    </div>
  )
}
