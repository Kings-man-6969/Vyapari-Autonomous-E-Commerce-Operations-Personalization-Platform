import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useClerk, useUser } from '@clerk/react'
import { useAuth } from '@clerk/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Store, ShoppingBag, ArrowRight, ShieldCheck, Zap, BarChart3, AlertCircle } from 'lucide-react'

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Navbar */}
      <nav className="glass fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-xl">V</div>
          <span className="font-bold text-xl tracking-tight">Vyapari</span>
        </div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
          The Smart Merchant Platform
        </div>
      </nav>

      <main className="pt-24 pb-16 px-6 max-w-7xl mx-auto">
        {/* Hero Section */}
        <section className="mt-12 text-center max-w-3xl mx-auto space-y-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-950 dark:text-white"
          >
            Empowering Local Business with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-accent-500">Intelligent Commerce</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
          >
            Vyapari connects neighborhood stores directly to customers through an AI-powered, friction-free ecosystem. Choose your journey below to begin.
          </motion.p>
        </section>

        {/* Role Selection Grid */}
        <div className="mt-16 grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card 
              className={`p-8 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${selectedRole === 'seller' ? 'ring-2 ring-brand-500 shadow-xl' : 'hover:border-brand-300'}`}
              onClick={() => setSelectedRole('seller')}
            >
              <div className="w-14 h-14 rounded-xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-6">
                <Store size={28} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Merchant & Admin</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Manage your shop, track inventory with AI insights, approve automatic pricing adjustments, and monitor sales analytics.
              </p>
              <div className="flex items-center text-brand-600 font-semibold group">
                {selectedRole === 'seller' ? 'Selected' : 'Select Seller'} <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card 
              className={`p-8 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 ${selectedRole === 'customer' ? 'ring-2 ring-accent-500 shadow-xl' : 'hover:border-accent-300'}`}
              onClick={() => setSelectedRole('customer')}
            >
              <div className="w-14 h-14 rounded-xl bg-accent-100 dark:bg-accent-900/40 text-accent-600 dark:text-accent-400 flex items-center justify-center mb-6">
                <ShoppingBag size={28} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Shopper</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Discover local products, receive personalized AI recommendations, and seamlessly add items to your cart.
              </p>
              <div className="flex items-center text-accent-600 font-semibold group">
                {selectedRole === 'customer' ? 'Selected' : 'Select priority Shopper'} <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
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
              <Card className="p-8 border-t-4 shadow-xl border-t-brand-500">
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold">Sign In to {selectedRole === 'seller' ? 'Seller Portal' : 'Customer Portal'}</h3>
                  <p className="text-sm text-slate-500 mt-2">
                    {hasRoleConflict 
                      ? "Role conflict detected. Please log out first." 
                      : "Choose an authentication method to continue."}
                  </p>
                </div>

                {hasRoleConflict && (
                  <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <p className="text-sm">You are currently authenticated as <b>{conflictLabel}</b>. Log out before switching to {selectedRole.toUpperCase()}.</p>
                  </div>
                )}

                <div className="space-y-6">
                  {!isSignedIn && !hasRoleConflict && (
                    <div className="flex flex-col gap-3">
                      <Button className="w-full" size="lg" asChild>
                        <Link to={`/auth/login?role=${selectedRole}`}>Log In as {selectedRole === 'seller' ? 'Seller' : 'Customer'}</Link>
                      </Button>
                      <Button variant="outline" className="w-full" size="lg" asChild>
                        <Link to={`/auth/signup?role=${selectedRole}`}>Create an Account</Link>
                      </Button>
                    </div>
                  )}

                  {isSignedIn && (
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-sm">
                        <div className="font-medium">Signed in as</div>
                        <div className="text-slate-500">{user?.primaryEmailAddress?.emailAddress ?? user?.id}</div>
                      </div>
                      {hasRoleConflict ? (
                        <Button variant="ghost" size="sm" onClick={performLogoutForRoleSwitch}>
                          Switch Role
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/">Continue</Link>
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => logoutAndClearState()}>
                            Log out
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {isSignedIn && !hasRoleConflict && isRegistering && !error && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                      <div className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                        <Zap className="animate-bounce" size={20} />
                        Connecting Workspace...
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex gap-2 items-center">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                </div>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Feature Highlights Grid */}
        <section className="mt-32">
          <h3 className="text-center text-2xl font-bold mb-12">Built for Modern Retail</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-emerald-500">
                <ShieldCheck />
              </div>
              <h4 className="font-semibold text-lg mb-2">Verified Trust</h4>
              <p className="text-slate-500 text-sm">Every seller is vetted, ensuring shoppers get authentic local goods with secure transactions.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-brand-500">
                <BarChart3 />
              </div>
              <h4 className="font-semibold text-lg mb-2">Smart Inventory</h4>
              <p className="text-slate-500 text-sm">Predict stock-outs and automatically generate pricing decisions with our 'Human-in-the-Loop' AI agent.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-amber-500">
                <Zap />
              </div>
              <h4 className="font-semibold text-lg mb-2">Instant Discovery</h4>
              <p className="text-slate-500 text-sm">Personalized SVD-based recommendations show shoppers exactly what they want instantly.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
