import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui/Badge'

type AuthRole = 'customer' | 'seller' | null

type AuthPageLayoutProps = {
  role: AuthRole
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

const ROLE_THEMES: Record<Exclude<AuthRole, null>, { label: string; color: string }> = {
  customer: { label: 'Customer Portal', color: 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300' },
  seller: { label: 'Seller Portal', color: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' },
}

function HeroIllustration() {
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-brand-50 via-white to-accent-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute -top-10 -right-8 h-36 w-36 rounded-full bg-brand-200/70 blur-xl dark:bg-brand-700/40" />
      <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-accent-200/70 blur-xl dark:bg-accent-700/40" />

      <div className="relative h-full w-full p-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-brand-600 text-white font-bold flex items-center justify-center">V</div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Vyapari Identity</span>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="h-20 rounded-lg border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70" />
          <div className="h-28 rounded-lg border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70" />
          <div className="h-16 rounded-lg border border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70" />
        </div>
      </div>
    </div>
  )
}

export function AuthPageLayout({ role, title, subtitle, children, footer }: AuthPageLayoutProps) {
  const theme = role ? ROLE_THEMES[role] : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-brand-600 text-white font-bold flex items-center justify-center">V</div>
            <span className="font-bold tracking-tight">Vyapari</span>
          </Link>
          {theme && <Badge className={theme.color}>{theme.label}</Badge>}
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <section className="space-y-4">
            <h1 className="text-4xl font-extrabold leading-tight">{title}</h1>
            <p className="text-slate-600 dark:text-slate-400">{subtitle}</p>
            <HeroIllustration />
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 shadow-sm">
            {children}
            {footer && <div className="mt-6 border-t border-slate-200 dark:border-slate-800 pt-4">{footer}</div>}
          </section>
        </div>
      </div>
    </div>
  )
}
