import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useClerk } from '@clerk/react'
import { useSignIn, useUser } from '@clerk/react'
import { AuthPageLayout } from '../components/auth/AuthPageLayout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useRoleContext } from '../role-context'
import { evaluatePasswordStrength, strengthColorClass } from '../lib/password-strength'
import { KeyRound, Lock, Mail } from 'lucide-react'

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
  return 'Password reset failed. Please try again.'
}

function isAlreadyVerifiedMessage(message?: string) {
  return typeof message === 'string' && message.toLowerCase().includes('already been verified')
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { selectedRole, setSelectedRole } = useRoleContext()
  const { signIn, fetchStatus } = useSignIn()
  const { setActive } = useClerk()
  const { isSignedIn } = useUser()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState<'request' | 'verify' | 'newPassword'>('request')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const strength = evaluatePasswordStrength(newPassword)
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword

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

  const onRequestReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!signIn) {
      return
    }

    setIsSubmitting(true)
    setError('')
    setMessage('')

    try {
      await signIn.reset()

      const createResult = await signIn.create({
        identifier: email.trim(),
      })
      if (createResult.error) {
        setError(createResult.error.longMessage || createResult.error.message)
        return
      }

      const sendCodeResult = await signIn.resetPasswordEmailCode.sendCode()
      if (sendCodeResult.error) {
        setError(sendCodeResult.error.longMessage || sendCodeResult.error.message)
        return
      }

      setStep('verify')
      setMessage('Reset code sent. Check your email inbox.')
    } catch (caught) {
      setError(parseErrorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onVerifyCode = async (event: FormEvent) => {
    event.preventDefault()
    if (!signIn) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() })
      if (verifyResult.error) {
        const errorMessage = verifyResult.error.longMessage || verifyResult.error.message
        if (isAlreadyVerifiedMessage(errorMessage) && signIn.status === 'needs_new_password') {
          setStep('newPassword')
          setMessage('Code was already verified. Set your new password.')
          return
        }

        setError(errorMessage)
        return
      }

      if (signIn.status === 'needs_new_password') {
        setStep('newPassword')
        setMessage('Code verified. Set your new password.')
        return
      }

      setError('Could not verify the code. Please request a new code.')
    } catch (caught) {
      setError(parseErrorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSetPassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!signIn) {
      return
    }

    if (strength.score < 4) {
      setError('Use a stronger password: include upper/lowercase letters and a number or symbol.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const submitResult = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      })
      if (submitResult.error) {
        setError(submitResult.error.longMessage || submitResult.error.message)
        return
      }

      if (signIn.status === 'complete') {
        const finalizeResult = await signIn.finalize()
        if (finalizeResult.error) {
          setError(finalizeResult.error.longMessage || finalizeResult.error.message)
          return
        }

        if (!signIn.createdSessionId) {
          setError('Password updated but Clerk did not provide a session. Please login again.')
          return
        }

        await setActive({ session: signIn.createdSessionId })
        const query = selectedRole ? `?role=${selectedRole}` : ''
        navigate(`/auth/reset-confirmation${query}`, {
          replace: true,
          state: { fromPasswordReset: true },
        })
        return
      }

      setError('Password updated but session was not completed. Please login again.')
    } catch (caught) {
      setError(parseErrorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageLayout
      role={selectedRole}
      title="Recover Your Account"
      subtitle="Use a secure email code flow to verify your identity and set a new password."
      footer={
        <p className="text-sm text-slate-500 text-center">
          Remembered your password?{' '}
          <Link className="text-brand-600 hover:underline" to={`/auth/login${selectedRole ? `?role=${selectedRole}` : ''}`}>
            Go to login
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Forgot Password</h2>
          <p className="text-sm text-slate-500 mt-1">Step {step === 'request' ? '1' : step === 'verify' ? '2' : '3'} of 3</p>
        </div>

        {step === 'request' && (
          <form className="space-y-4" onSubmit={onRequestReset}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input icon={<Mail size={16} />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting || fetchStatus === 'fetching'}>
              {isSubmitting ? 'Sending code...' : 'Send Reset Code'}
            </Button>
          </form>
        )}

        {step === 'verify' && (
          <form className="space-y-4" onSubmit={onVerifyCode}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input icon={<KeyRound size={16} />} value={code} onChange={(event) => setCode(event.target.value)} required />
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting || fetchStatus === 'fetching'}>
              {isSubmitting ? 'Verifying...' : 'Verify Code'}
            </Button>
          </form>
        )}

        {step === 'newPassword' && (
          <form className="space-y-4" onSubmit={onSetPassword}>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input icon={<Lock size={16} />} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${strengthColorClass(strength.score)}`}
                    style={{ width: `${(strength.score / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Strength: {strength.label}</p>
                <ul className="space-y-1 text-xs">
                  {strength.requirements.map((rule) => (
                    <li key={rule.id} className={rule.met ? 'text-emerald-600' : 'text-slate-500'}>
                      {rule.met ? '✓' : '•'} {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input icon={<Lock size={16} />} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required />
              {passwordMismatch && <p className="text-xs text-red-600">Passwords do not match.</p>}
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting || fetchStatus === 'fetching'}>
              {isSubmitting ? 'Updating...' : 'Set New Password'}
            </Button>
          </form>
        )}

        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div id="clerk-captcha" />
      </div>
    </AuthPageLayout>
  )
}
