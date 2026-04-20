import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useClerk, useSignIn, useUser } from '@clerk/react'
import { AuthPageLayout } from '../components/auth/AuthPageLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useRoleContext } from '../role-context'
import { Lock, Mail } from 'lucide-react'

function parseRoleParam(value: string | null): 'customer' | 'seller' | null {
  if (value === 'customer' || value === 'seller') {
    return value
  }
  return null
}

function parseErrorMessage(error: unknown) {
  const maybeErrors = (error as { errors?: Array<{ longMessage?: string; message?: string }> })?.errors
  if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
    return maybeErrors[0]?.longMessage || maybeErrors[0]?.message || 'Login failed. Please verify your credentials and try again.'
  }
  return 'Login failed. Please verify your credentials and try again.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { selectedRole, setSelectedRole } = useRoleContext()
  const { signIn, fetchStatus } = useSignIn()
  const { setActive } = useClerk()
  const { isSignedIn } = useUser()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const roleFromQuery = parseRoleParam(searchParams.get('role'))
    if (roleFromQuery) {
      setSelectedRole(roleFromQuery)
    }
  }, [searchParams, setSelectedRole])

  useEffect(() => {
    if (isSignedIn) {
      navigate('/', { replace: true })
    }
  }, [isSignedIn, navigate])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!signIn) return

    setIsSubmitting(true)
    setError('')

    try {
      const identifier = email.trim()

      // In Clerk Future API, create() initializes the sign-in attempt, then password() verifies first factor.
      const createResult = await signIn.create({ identifier })
      if (createResult.error) {
        setError(createResult.error.longMessage || createResult.error.message)
        return
      }

      const passwordResult = await signIn.password({ identifier, password })
      if (passwordResult.error) {
        setError(passwordResult.error.longMessage || passwordResult.error.message)
        return
      }

      if (signIn.status === 'complete' && signIn.createdSessionId) {
        const finalizeResult = await signIn.finalize()
        if (finalizeResult.error) {
          setError(finalizeResult.error.longMessage || finalizeResult.error.message)
          return
        }

        await setActive({ session: signIn.createdSessionId })
        navigate('/', { replace: true })
        return
      }

      if (signIn.status === 'needs_second_factor') {
        setError('This account has MFA enabled. Complete second-factor verification in Clerk or use an account without MFA for this custom login flow.')
        return
      }

      if (signIn.status === 'needs_client_trust') {
        setError('Clerk requires client trust verification for this sign-in. Please retry from the same browser session.')
        return
      }

      setError('Login could not be completed. Please try again or reset your password.')
    } catch (caught) {
      setError(parseErrorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="p-8 max-w-md text-center space-y-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
          <h1 className="text-2xl font-bold">Choose Your Role First</h1>
          <p className="text-slate-500 text-sm">Role selection defines your workspace and authorization scope.</p>
          <Button asChild>
            <Link to="/">Back to Role Selection</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <AuthPageLayout
      role={selectedRole}
      title="Welcome Back"
      subtitle="Sign in to your workspace with your role-scoped account."
      footer={
        <div className="space-y-2 text-center text-sm text-slate-500">
          <p>
            Need an account?{' '}
            <Link className="text-brand-600 hover:underline" to={`/auth/signup?role=${selectedRole}`}>
              Create one
            </Link>
          </p>
          <p>
            <Link className="text-brand-600 hover:underline" to={`/auth/forgot-password?role=${selectedRole}`}>
              Forgot password?
            </Link>
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Sign In</h2>
          <p className="text-sm text-slate-500 mt-1">Access your {selectedRole === 'seller' ? 'Seller' : 'Customer'} portal.</p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              icon={<Mail size={16} />}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@business.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input
              icon={<Lock size={16} />}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button className="w-full" type="submit" disabled={isSubmitting || fetchStatus === 'fetching'}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div id="clerk-captcha" />
      </div>
    </AuthPageLayout>
  )
}
