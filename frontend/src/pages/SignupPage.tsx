import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useClerk, useSignUp, useUser } from '@clerk/react'
import { AuthPageLayout } from '../components/auth/AuthPageLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useRoleContext } from '../role-context'
import { evaluatePasswordStrength, strengthColorClass } from '../password-strength'
import { Lock, Mail, User } from 'lucide-react'

function parseRoleParam(value: string | null): 'customer' | 'seller' | null {
  if (value === 'customer' || value === 'seller') {
    return value
  }
  return null
}

function parseErrorMessage(error: unknown) {
  const maybeErrors = (error as { errors?: Array<{ message?: string }> })?.errors
  if (Array.isArray(maybeErrors) && maybeErrors.length > 0 && maybeErrors[0]?.message) {
    return maybeErrors[0].message
  }
  return 'Signup failed. Please verify the input and try again.'
}

function isAlreadyVerifiedMessage(message?: string) {
  return typeof message === 'string' && message.toLowerCase().includes('already been verified')
}

function generateUsername(firstName: string, lastName: string, email: string) {
  const emailLocal = email.split('@')[0] ?? ''
  const base = `${firstName}${lastName}`.trim() || emailLocal.trim() || 'user'
  const normalized = base.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const safeBase = normalized.length >= 3 ? normalized : `user${normalized}`
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${safeBase.slice(0, 20)}${suffix}`
}

export function SignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { selectedRole, setSelectedRole } = useRoleContext()
  const { signUp, fetchStatus } = useSignUp()
  const { setActive } = useClerk()
  const { isSignedIn } = useUser()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [step, setStep] = useState<'credentials' | 'verify'>('credentials')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const strength = evaluatePasswordStrength(password)
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password

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

  const onCreateAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!signUp) return

    setIsSubmitting(true)
    setError('')

    if (strength.score < 4) {
      setError('Use a stronger password: include upper/lowercase letters and a number or symbol.')
      setIsSubmitting(false)
      return
    }

    if (passwordMismatch) {
      setError('Passwords do not match.')
      setIsSubmitting(false)
      return
    }

    try {
      const createResult = await signUp.create({
        firstName,
        lastName,
        username: generateUsername(firstName, lastName, email),
        emailAddress: email.trim(),
        password,
        legalAccepted: true,
      })
      if (createResult.error) {
        setError(createResult.error.longMessage || createResult.error.message)
        return
      }

      if (signUp.status === 'complete' && signUp.createdSessionId) {
        const finalizeResult = await signUp.finalize()
        if (finalizeResult.error) {
          setError(finalizeResult.error.longMessage || finalizeResult.error.message)
          return
        }

        await setActive({ session: signUp.createdSessionId })
        navigate('/', { replace: true })
        return
      }

      const sendCodeResult = await signUp.verifications.sendEmailCode()
      if (sendCodeResult.error) {
        setError(sendCodeResult.error.longMessage || sendCodeResult.error.message)
        return
      }

      setStep('verify')
    } catch (caught) {
      setError(parseErrorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onVerifyCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!signUp) return

    setIsSubmitting(true)
    setError('')

    try {
      const verifyResult = await signUp.verifications.verifyEmailCode({
        code: verificationCode.trim(),
      })
      if (verifyResult.error) {
        const errorMessage = verifyResult.error.longMessage || verifyResult.error.message
        if (isAlreadyVerifiedMessage(errorMessage)) {
          navigate(`/auth/login?role=${selectedRole}`, { replace: true })
          return
        }

        setError(errorMessage)
        return
      }

      if (signUp.status !== 'complete' && signUp.missingFields.includes('legal_accepted')) {
        const updateResult = await signUp.update({ legalAccepted: true })
        if (updateResult.error) {
          setError(updateResult.error.longMessage || updateResult.error.message)
          return
        }
      }

      if (signUp.status !== 'complete' && signUp.missingFields.includes('username')) {
        const updateResult = await signUp.update({
          username: generateUsername(firstName, lastName, email),
        })
        if (updateResult.error) {
          setError(updateResult.error.longMessage || updateResult.error.message)
          return
        }
      }

      if (signUp.status === 'complete' && signUp.createdSessionId) {
        const finalizeResult = await signUp.finalize()
        if (finalizeResult.error) {
          setError(finalizeResult.error.longMessage || finalizeResult.error.message)
          return
        }

        await setActive({ session: signUp.createdSessionId })
        navigate('/', { replace: true })
        return
      }

      const missing = signUp.missingFields.join(', ')
      const unverified = signUp.unverifiedFields.join(', ')
      const details = [
        missing ? `missing: ${missing}` : '',
        unverified ? `unverified: ${unverified}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      setError(
        details
          ? `Verification succeeded, but sign-up is still incomplete (${details}).`
          : 'Verification succeeded, but sign-up is still incomplete. Please restart signup or sign in.',
      )
    } catch (caught) {
      setError(parseErrorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!selectedRole) {
    return (
      <div className="min-h-screen bg-[var(--surface)] text-[var(--on-surface)] flex items-center justify-center px-4">
        <div className="p-10 max-w-md text-center space-y-6 rounded-[var(--radius-2xl)] ghost-border glass-card premium-shadow">
          <h1 className="text-3xl font-extrabold tracking-tight">Choose Your Role First</h1>
          <p className="text-[var(--on-surface-variant)] text-sm">Role selection defines your workspace and authorization scope.</p>
          <Button asChild className="w-full mt-4">
            <Link to="/">Back to Role Selection</Link>
          </Button>
        </div>
      </div>
    )
  }

  const roleColor = selectedRole === 'seller' ? 'text-[var(--primary)]' : 'text-[var(--tertiary)]'

  return (
    <AuthPageLayout
      role={selectedRole}
      title="Create Your Workspace Account"
      subtitle="Set up your account once, then continue through your selected role journey."
      footer={
        <p className="text-sm font-medium text-center text-[var(--on-surface-variant)]">
          Already have an account?{' '}
          <Link className={`${roleColor} hover:underline font-bold`} to={`/auth/login?role=${selectedRole}`}>
            Sign in
          </Link>
        </p>
      }
    >
      <div className="space-y-6 bg-[var(--surface-container-high)] p-8 rounded-[var(--radius-2xl)] ghost-border premium-shadow">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[var(--on-surface)]">Create Account</h2>
          <p className="text-sm font-medium text-[var(--on-surface-variant)] mt-1">Sign up for your {selectedRole === 'seller' ? 'Seller' : 'Customer'} portal.</p>
        </div>

        {step === 'credentials' ? (
          <form className="space-y-5" onSubmit={onCreateAccount}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--on-surface)] tracking-wide">First name</label>
                <Input
                  icon={<User size={16} className="text-[var(--on-surface-variant)]"/>}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[var(--on-surface)] tracking-wide">Last name</label>
                <Input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--on-surface)] tracking-wide">Email</label>
              <Input
                icon={<Mail size={16} className="text-[var(--on-surface-variant)]"/>}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@business.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--on-surface)] tracking-wide">Password</label>
              <Input
                icon={<Lock size={16} className="text-[var(--on-surface-variant)]"/>}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
              <div className="space-y-3 mt-2">
                <div className="h-1.5 w-full rounded-full bg-[var(--surface-container-highest)] shadow-inner overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${strengthColorClass(strength.score)}`}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-[var(--on-surface)] tracking-wider uppercase">Strength: {strength.label}</p>
                <ul className="space-y-2 text-xs font-medium">
                  {strength.requirements.map((rule) => (
                    <li key={rule.id} className={rule.met ? roleColor : 'text-[var(--on-surface-variant)]'}>
                      {rule.met ? '✓' : '•'} {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--on-surface)] tracking-wide">Confirm Password</label>
              <Input
                icon={<Lock size={16} className="text-[var(--on-surface-variant)]"/>}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your password"
                minLength={8}
                required
              />
              {passwordMismatch && <p className="text-xs text-[#ffb4ab] mt-1">Passwords do not match.</p>}
            </div>

            {error && (
              <p className="text-sm text-[#ffb4ab] border border-[#93000a]/50 bg-[#93000a]/20 p-3 rounded-[var(--radius-lg)] shadow-inner">
                {error}
              </p>
            )}

            <Button className="w-full h-12 text-lg shadow-[0_0_20px_rgba(192,193,255,0.15)] mt-2" type="submit" disabled={isSubmitting || fetchStatus === 'fetching'}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>
        ) : (
          <form className="space-y-5" onSubmit={onVerifyCode}>
            <div className="space-y-2">
              <label className="text-sm font-bold text-[var(--on-surface)] tracking-wide">Verification Code</label>
              <Input
                value={verificationCode}
                onChange={(event) => setVerificationCode(event.target.value)}
                placeholder="Enter the email verification code"
                required
              />
              <p className="text-xs font-medium text-[var(--on-surface-variant)] mt-2">We sent a verification code to your email address.</p>
            </div>

            {error && (
              <p className="text-sm text-[#ffb4ab] border border-[#93000a]/50 bg-[#93000a]/20 p-3 rounded-[var(--radius-lg)] shadow-inner">
                {error}
              </p>
            )}

            <Button className="w-full h-12 text-lg shadow-[0_0_20px_rgba(192,193,255,0.15)] mt-2" type="submit" disabled={isSubmitting || fetchStatus === 'fetching'}>
              {isSubmitting ? 'Verifying...' : 'Verify Email'}
            </Button>
          </form>
        )}

        <div id="clerk-captcha" />
      </div>
    </AuthPageLayout>
  )
}
