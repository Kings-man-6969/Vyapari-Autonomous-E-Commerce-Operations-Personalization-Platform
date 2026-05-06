import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Store, ShoppingBag } from 'lucide-react'

type AuthRole = 'customer' | 'seller' | null

type AuthPageLayoutProps = {
  role: AuthRole
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

const ROLE_THEMES: Record<Exclude<AuthRole, null>, { label: string; color: string; icon: ReactNode }> = {
  customer: { label: 'Customer Portal', color: 'bg-[var(--tertiary)]/10 text-[var(--tertiary)] border border-[var(--tertiary)]/20', icon: <ShoppingBag size={16} /> },
  seller: { label: 'Seller Portal', color: 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20', icon: <Store size={16} /> },
}

export function AuthPageLayout({ role, title, subtitle, children, footer }: AuthPageLayoutProps) {
  const theme = role ? ROLE_THEMES[role] : null
  const isSeller = role === 'seller'

  return (
    <div className="flex min-h-screen w-full bg-[var(--surface-container-low)] text-[var(--on-surface)]">
      {/* Left side: branding and illustration */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between overflow-hidden bg-[var(--surface-container)] relative ghost-border border-y-0 border-l-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=2000&auto=format&fit=crop')] opacity-[0.03] bg-cover bg-center mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-container-low)]/80 via-[var(--surface-container)]/90 to-[var(--surface)] text-[var(--on-surface)]" />
        
        {/* Dynamic abstract highlight */}
        <div className={`absolute top-[-20%] left-[-10%] w-[80%] h-[60%] blur-[120px] rounded-full opacity-20 pointer-events-none ${isSeller ? 'bg-[var(--primary)]' : 'bg-[var(--tertiary)]'}`} />

        <div className="relative z-10 p-12">
          <Link to="/" className="flex items-center gap-3 w-fit group">
            <div className={`h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-[var(--on-primary)] font-bold text-xl premium-shadow group-hover:scale-105 transition-transform ${isSeller ? 'from-[var(--primary)] to-[var(--primary-container)]' : 'from-[var(--tertiary)] to-[var(--tertiary-container)]'}`}>V</div>
            <span className="font-extrabold tracking-tight text-2xl text-[var(--on-surface)]">Vyapari</span>
          </Link>
        </div>
        
        <div className="relative z-10 p-12 max-w-xl">
          {theme && (
            <div className={`mb-6 px-4 py-1.5 flex w-fit items-center gap-2 rounded-full text-label-sm ${theme.color}`}>
              {theme.icon} {theme.label}
            </div>
          )}
          <h1 className="text-[3rem] font-extrabold leading-[1.1] mb-6 tracking-tight text-[var(--on-surface)]">
            {isSeller ? "Command your local enterprise." : "Curate your local lifestyle."}
          </h1>
          <p className="text-[var(--on-surface-variant)] text-lg leading-relaxed">
            {isSeller 
              ? "Join thousands of merchants managing inventory, tracking sales, and growing their footprint with AI-driven insights."
              : "Shop the best from your neighborhood stores. Authentic, local, and delivered to your doorstep."}
          </p>
        </div>
      </div>

      {/* Right side: form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-4 py-12 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          {/* Mobile header view */}
          <div className="flex lg:hidden items-center justify-between mb-10">
             <Link to="/" className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center font-bold text-white ${isSeller ? 'from-[var(--primary)] to-[var(--primary-container)]' : 'from-[var(--tertiary)] to-[var(--tertiary-container)]'}`}>V</div>
              <span className="font-bold tracking-tight">Vyapari</span>
            </Link>
            {theme && <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider rounded border ${theme.color}`}>{theme.label.split(' ')[0]}</span>}
          </div>

          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-[var(--on-surface)]">{title}</h2>
            <p className="mt-2 text-[var(--on-surface-variant)]">{subtitle}</p>
          </div>

          <div className="mt-8">
            {children}
          </div>

          {footer && (
            <div className="mt-8 pt-6 ghost-border border-x-0 border-b-0 border-t">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
