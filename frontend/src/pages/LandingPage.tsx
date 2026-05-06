import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/react'
import { useAuth } from '@clerk/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Store, ShoppingBag, ArrowRight, ShieldCheck, Zap, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react'

import { ApiRequestError, getAuthMe, registerAuth } from '../api'
import {
  clearAllAuthSessions,
  getActiveRole,
  getAuthSession,
  setAuthSession,
} from '../auth'
import { useRoleContext } from '../role-context'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function LandingPage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { getToken } = useAuth()
  const { user, isSignedIn, isLoaded } = useUser()
  const { selectedRole, setSelectedRole } = useRoleContext()
  const [error, setError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)

  const activeRole = getActiveRole()
  const hasRoleConflict = !!(selectedRole && activeRole && selectedRole !== activeRole)
  const conflictLabel = activeRole ? activeRole.toUpperCase() : 'UNKNOWN'

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn || !user) {
      clearAllAuthSessions()
      return
    }

    const session = getAuthSession()
    if (session) {
      getAuthMe()
        .then((me) => {
          navigate(me.role === 'customer' ? '/store' : '/seller', { replace: true })
        })
        .catch(() => {
          clearAllAuthSessions()
        })
      return
    }

    if (!isRegistering && !hasRoleConflict) {
      setIsRegistering(true)
      ;(async () => {
        const clerkToken = await getToken()
        if (!clerkToken) {
          throw new Error('missing Clerk token')
        }

        try {
          const me = await getAuthMe(clerkToken)
          setAuthSession({
            clerkId: me.clerk_id,
            role: me.role,
            token: clerkToken,
          })

          if (selectedRole && me.role !== selectedRole) {
            setError(`This Clerk account is already registered as ${me.role.toUpperCase()}. Log out to switch accounts.`)
            return
          }

          navigate(me.role === 'customer' ? '/store' : '/seller', { replace: true })
          return
        } catch (caught) {
          if (!(caught instanceof ApiRequestError) || caught.status !== 401) {
            throw caught
          }
        }

        if (!selectedRole) {
          setError('Select a role to continue.')
          return
        }

        const newSession = await registerAuth({ role: selectedRole }, clerkToken)
        setAuthSession({
          clerkId: newSession.clerk_id,
          role: newSession.role,
          token: clerkToken,
        })

        navigate(newSession.role === 'customer' ? '/store' : '/seller', { replace: true })
      })()
        .catch((caught) => {
          if (caught instanceof ApiRequestError && caught.status === 409) {
            setError('This Clerk account is already registered with another role. Log out and use a separate account.')
          } else {
            setError('Could not register the session. Check the backend and try again.')
          }
        })
        .finally(() => {
          setIsRegistering(false)
        })
    }
  }, [getToken, hasRoleConflict, isLoaded, isRegistering, isSignedIn, navigate, selectedRole, user])

  const logoutAndClearState = async (message = 'Logged out. Select your role and sign in again.') => {
    await signOut({ redirectUrl: '/' })
    clearAllAuthSessions()
    setSelectedRole(null)
    setError(message)
  }

  const performLogoutForRoleSwitch = async () => {
    await logoutAndClearState('Logged out. Select your role and sign in again.')
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] font-sans text-[var(--on-surface)] selection:bg-[var(--primary)] selection:text-[var(--on-primary)] pb-20">
      {/* Navbar Minimal */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center glass-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-container)] flex items-center justify-center text-[var(--on-primary)] font-bold text-xl shadow-[0_0_20px_rgba(192,193,255,0.2)]">V</div>
          <span className="font-extrabold text-xl tracking-tight text-[var(--on-surface)]">Vyapari</span>
        </div>
        <div className="text-label-sm text-[var(--on-surface-variant)] tracking-[0.1em]">
          Digital Commerce Platform
        </div>
      </nav>

      {/* Modern Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden bg-[var(--surface-container-low)] text-[var(--on-surface)] rounded-b-[var(--radius-3xl)] premium-shadow mb-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-container-low)] opacity-90" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1601598851547-4302969d0614?q=80&w=2000&auto=format&fit=crop')] opacity-5 bg-cover bg-center mix-blend-overlay" />
        
        <div className="relative max-w-5xl mx-auto text-center space-y-8 z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full ghost-border bg-[var(--surface-container)] backdrop-blur-md text-label-sm text-[var(--primary)] mb-4 shadow-[0_0_20px_rgba(192,193,255,0.1)]"
          >
            <Zap size={16} className="text-[var(--tertiary)]" />
            Empowering Local Neighborhood Stores
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-display-lg"
          >
            The Operating System for <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--primary-container)]">Local Commerce</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-[var(--on-surface-variant)] max-w-2xl mx-auto font-light"
          >
            Vyapari connects neighborhood stores directly to customers through an AI-powered, friction-free ecosystem. Choose your journey below.
          </motion.p>
        </div>

        {/* Decorative divider */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--surface)] to-transparent opacity-50" />
      </section>

      <main className="px-6 max-w-6xl mx-auto relative z-20">
        {/* Role Selection Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card 
              className={`p-10 cursor-pointer transition-all duration-300 glass-card relative overflow-hidden ${selectedRole === 'seller' ? 'ring-2 ring-[var(--primary)] shadow-[0_0_40px_rgba(192,193,255,0.2)] -translate-y-2' : 'hover:ring-1 hover:ring-[var(--primary)] hover:shadow-xl hover:-translate-y-1'}`}
              onClick={() => setSelectedRole('seller')}
            >
              {selectedRole === 'seller' && <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-[var(--primary-container)]/5 pointer-events-none" />}
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-container-highest)] text-[var(--primary)] flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(192,193,255,0.1)]">
                <Store size={32} />
              </div>
              <h2 className="text-3xl font-extrabold mb-3 text-[var(--on-surface)]">Merchant & Admin</h2>
              <p className="text-[var(--on-surface-variant)] mb-8 text-lg leading-relaxed">
                Manage your shop, track inventory with AI insights, approve automatic pricing adjustments, and monitor sales analytics.
              </p>
              
              <ul className="space-y-3 mb-8">
                 <li className="flex items-center text-sm text-[var(--on-surface-variant)]"><CheckCircle2 className="text-[var(--primary)] mr-2" size={16}/> AI Inventory Tracking</li>
                 <li className="flex items-center text-sm text-[var(--on-surface-variant)]"><CheckCircle2 className="text-[var(--primary)] mr-2" size={16}/> Automated Pricing Guardrails</li>
              </ul>

              <div className="flex items-center text-[var(--on-surface)] font-bold group text-lg">
                {selectedRole === 'seller' ? <span className="text-[var(--primary)]">Selected</span> : 'Select Seller'} <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" size={20} />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card 
              className={`p-10 cursor-pointer transition-all duration-300 glass-card relative overflow-hidden ${selectedRole === 'customer' ? 'ring-2 ring-[var(--tertiary)] shadow-[0_0_40px_rgba(255,183,131,0.2)] -translate-y-2' : 'hover:ring-1 hover:ring-[var(--tertiary)] hover:shadow-xl hover:-translate-y-1'}`}
              onClick={() => setSelectedRole('customer')}
            >
              {selectedRole === 'customer' && <div className="absolute inset-0 bg-gradient-to-br from-[var(--tertiary)]/5 to-[var(--tertiary-container)]/5 pointer-events-none" />}
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-container-highest)] text-[var(--tertiary)] flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(255,183,131,0.1)]">
                <ShoppingBag size={32} />
              </div>
              <h2 className="text-3xl font-extrabold mb-3 text-[var(--on-surface)]">Shopper</h2>
              <p className="text-[var(--on-surface-variant)] mb-8 text-lg leading-relaxed">
                Discover local products, receive personalized AI recommendations, and seamlessly add items to your cart.
              </p>

              <ul className="space-y-3 mb-8">
                 <li className="flex items-center text-sm text-[var(--on-surface-variant)]"><CheckCircle2 className="text-[var(--tertiary)] mr-2" size={16}/> Hyper-local Product Discovery</li>
                 <li className="flex items-center text-sm text-[var(--on-surface-variant)]"><CheckCircle2 className="text-[var(--tertiary)] mr-2" size={16}/> SVD Personalized Recommendations</li>
              </ul>
              
              <div className="flex items-center text-[var(--on-surface)] font-bold group text-lg">
                {selectedRole === 'customer' ? <span className="text-[var(--tertiary)]">Selected</span> : 'Select priority Shopper'} <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" size={20} />
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Auth Panel */}
        <AnimatePresence>
          {selectedRole && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="mt-16 max-w-xl mx-auto"
            >
              <Card className="p-8 premium-shadow glass-card relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1 ${selectedRole === 'seller' ? 'bg-gradient-to-r from-[var(--primary)] to-[var(--primary-container)]' : 'bg-gradient-to-r from-[var(--tertiary)] to-[var(--tertiary-container)]'}`} />
                <div className="text-center mb-8 mt-2">
                  <h3 className="text-2xl font-bold text-[var(--on-surface)]">Sign In to {selectedRole === 'seller' ? 'Seller Portal' : 'Customer Portal'}</h3>
                  <p className="text-[var(--on-surface-variant)] mt-2">
                    {hasRoleConflict 
                      ? "Role conflict detected. Please log out first." 
                      : "Choose an authentication method to continue."}
                  </p>
                </div>

                {hasRoleConflict && (
                  <div className="mb-6 p-4 bg-amber-900/20 text-[#ffb783] rounded-[var(--radius-xl)] flex items-start gap-3 shadow-inner ghost-border">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <p className="text-sm">You are currently authenticated as <b className="font-bold">{conflictLabel}</b>. Log out before switching to {selectedRole.toUpperCase()}.</p>
                  </div>
                )}

                <div className="space-y-6">
                  {!isSignedIn && !hasRoleConflict && (
                    <div className="flex flex-col gap-4">
                      <Button className="w-full shadow-md hover:shadow-[0_0_30px_rgba(192,193,255,0.4)] transition-shadow" size="lg" asChild>
                        <Link to={`/auth/login?role=${selectedRole}`}>Log In as {selectedRole === 'seller' ? 'Seller' : 'Customer'}</Link>
                      </Button>
                      <Button variant="secondary" className="w-full text-lg ghost-border" size="lg" asChild>
                        <Link to={`/auth/signup?role=${selectedRole}`}>Create a secure account</Link>
                      </Button>
                    </div>
                  )}

                  {isSignedIn && (
                    <div className="flex items-center justify-between p-5 bg-[var(--surface-container)] rounded-[var(--radius-xl)] ghost-border premium-shadow">
                      <div className="text-sm">
                        <div className="font-semibold text-[var(--on-surface)]">Active Session</div>
                        <div className="text-[var(--on-surface-variant)] mt-1">{user?.primaryEmailAddress?.emailAddress ?? user?.id}</div>
                      </div>
                      {hasRoleConflict ? (
                        <Button variant="secondary" size="sm" onClick={performLogoutForRoleSwitch}>
                          Switch Role
                        </Button>
                      ) : (
                        <div className="flex gap-3">
                          <Button size="sm" asChild>
                            <Link to="/">Enter Portal <ArrowRight size={14} className="ml-1" /></Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => logoutAndClearState()}>
                            Log out
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {isSignedIn && !hasRoleConflict && isRegistering && !error && (
                    <div className="pt-6 text-center">
                      <div className="inline-flex items-center gap-2 text-[var(--on-surface)] bg-[var(--surface-container-highest)] px-6 py-3 rounded-full ghost-border text-sm font-semibold shadow-inner">
                        <Zap className="animate-pulse text-[var(--primary)]" size={18} />
                        Securing your workspace...
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-900/20 text-[#ffb4ab] rounded-[var(--radius-xl)] text-sm flex gap-3 items-center ghost-border inset-shadow">
                      <AlertCircle size={18} className="shrink-0" />
                      <span className="font-medium">{error}</span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Feature Highlights Grid */}
        <section className="mt-32 mb-20">
          <div className="text-center mb-16">
            <h3 className="text-[2.5rem] font-extrabold tracking-tight text-[var(--on-surface)]">Enterprise Infrastructure for Local Commerce</h3>
            <p className="text-[var(--on-surface-variant)] mt-4 max-w-2xl mx-auto text-lg">Vyapari bridges the gap between traditional retail and modern consumer expectations using AI curation.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border-none bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] transition-colors relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/10 rounded-full blur-[40px] group-hover:bg-[var(--primary)]/20 transition-all" />
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container-highest)] flex items-center justify-center mb-6 text-[var(--primary)] shadow-[0_0_20px_rgba(192,193,255,0.05)]">
                <ShieldCheck size={28} />
              </div>
              <h4 className="font-bold text-xl mb-3 text-[var(--on-surface)]">Verified Local Trust</h4>
              <p className="text-[var(--on-surface-variant)] leading-relaxed">Every seller is vetted, ensuring shoppers get authentic local goods with secure, transparent transactions.</p>
            </Card>
            <Card className="p-8 border-none bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] transition-colors relative overflow-hidden group shadow-[inset_0_1px_rgba(255,255,255,0.02)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--tertiary)]/10 rounded-full blur-[40px] group-hover:bg-[var(--tertiary)]/20 transition-all" />
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container-highest)] flex items-center justify-center mb-6 text-[var(--tertiary)] shadow-[0_0_20px_rgba(255,183,131,0.05)]">
                <BarChart3 size={28} />
              </div>
              <h4 className="font-bold text-xl mb-3 text-[var(--on-surface)]">Smart Guardrails</h4>
              <p className="text-[var(--on-surface-variant)] leading-relaxed">Predict stock-outs and automatically generate pricing decisions with our integrated 'Human-in-the-Loop' AI agent.</p>
            </Card>
            <Card className="p-8 border-none bg-[var(--surface-container-low)] hover:bg-[var(--surface-container)] transition-colors relative overflow-hidden group shadow-[inset_0_1px_rgba(255,255,255,0.02)]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--primary)]/10 rounded-full blur-[40px] group-hover:bg-[var(--primary)]/20 transition-all" />
              <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container-highest)] flex items-center justify-center mb-6 text-[var(--primary)] shadow-[0_0_20px_rgba(192,193,255,0.05)]">
                <Zap size={28} />
              </div>
              <h4 className="font-bold text-xl mb-3 text-[var(--on-surface)]">Instant Discovery</h4>
              <p className="text-[var(--on-surface-variant)] leading-relaxed">Personalized SVD-based recommendations push products directly to the shoppers who want them most.</p>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
