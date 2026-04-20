import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useClerk, useUser } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { clearAllAuthSessions } from '../auth'
import { evaluatePasswordStrength, strengthColorClass } from '../lib/password-strength'
import { User, Shield, Save, LogOut, KeyRound, MailCheck } from 'lucide-react'

function parseErrorMessage(error: unknown) {
  const maybeErrors = (error as { errors?: Array<{ message?: string }> })?.errors
  if (Array.isArray(maybeErrors) && maybeErrors.length > 0 && maybeErrors[0]?.message) {
    return maybeErrors[0].message
  }
  return 'Operation failed. Please try again.'
}

export function CustomerProfilePage() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const { isLoaded, user } = useUser()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [pendingEmailId, setPendingEmailId] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)
  const strength = evaluatePasswordStrength(newPassword)
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  useEffect(() => {
    if (!isLoaded || !user) {
      return
    }
    setFirstName(user.firstName ?? '')
    setLastName(user.lastName ?? '')
  }, [isLoaded, user])

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      return
    }

    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      await user.update({ firstName, lastName })
      setMessage('Profile updated successfully.')
    } catch {
      setError('Could not update profile at this moment.')
    } finally {
      setIsSaving(false)
    }
  }

  const onLogout = async () => {
    await signOut({ redirectUrl: '/' })
    clearAllAuthSessions()
    navigate('/', { replace: true })
  }

  const onStartEmailUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      return
    }

    setIsEmailSubmitting(true)
    setEmailError('')
    setEmailMessage('')

    try {
      const emailAddress = await user.createEmailAddress({ email: newEmail })
      await emailAddress.prepareVerification({ strategy: 'email_code' })
      setPendingEmailId(emailAddress.id)
      setEmailMessage('Verification code sent to new email address.')
    } catch (caught) {
      setEmailError(parseErrorMessage(caught))
    } finally {
      setIsEmailSubmitting(false)
    }
  }

  const onVerifyEmailUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!user || !pendingEmailId) {
      return
    }

    setIsEmailSubmitting(true)
    setEmailError('')

    try {
      const pendingAddress = user.emailAddresses.find((address) => address.id === pendingEmailId)
      if (!pendingAddress) {
        setEmailError('Pending email verification session expired. Please restart the update flow.')
        return
      }

      const verifiedAddress = await pendingAddress.attemptVerification({ code: emailCode })
      if (verifiedAddress.verification.status !== 'verified') {
        setEmailError('Could not verify code. Please retry.')
        return
      }

      await user.update({ primaryEmailAddressId: verifiedAddress.id })
      setPendingEmailId(null)
      setEmailCode('')
      setNewEmail('')
      setEmailMessage('Primary email updated successfully.')
    } catch (caught) {
      setEmailError(parseErrorMessage(caught))
    } finally {
      setIsEmailSubmitting(false)
    }
  }

  const onChangePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (!user) {
      return
    }
    if (strength.score < 4) {
      setPasswordError('Use a stronger password: include upper/lowercase letters and a number or symbol.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }

    setIsPasswordSubmitting(true)
    setPasswordError('')
    setPasswordMessage('')

    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: false,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated successfully.')
    } catch (caught) {
      setPasswordError(parseErrorMessage(caught))
    } finally {
      setIsPasswordSubmitting(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="p-8 text-slate-500">Loading profile...</Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <User className="text-brand-500" />
          Account Settings
        </h1>
        <p className="text-slate-500 mt-1">Manage your identity, security, and preferences.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Shield size={16} /> Authenticated via Clerk Security
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-slate-950 space-y-6">
          <form onSubmit={onSave} className="space-y-4 max-w-xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name</label>
                <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name</label>
                <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={user?.primaryEmailAddress?.emailAddress ?? ''} disabled />
            </div>

            {message && <p className="text-sm text-emerald-600">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isSaving}>
                <Save size={16} className="mr-2" /> {isSaving ? 'Saving...' : 'Save Profile'}
              </Button>
              <Button type="button" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={onLogout}>
                <LogOut size={16} className="mr-2" /> Logout
              </Button>
            </div>
          </form>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4 max-w-xl">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MailCheck size={18} className="text-brand-500" /> Update Email
            </h3>

            <form onSubmit={onStartEmailUpdate} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Email Address</label>
                <Input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required />
              </div>
              <Button type="submit" disabled={isEmailSubmitting}>
                Send Verification Code
              </Button>
            </form>

            {pendingEmailId && (
              <form onSubmit={onVerifyEmailUpdate} className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Verification Code</label>
                  <Input value={emailCode} onChange={(event) => setEmailCode(event.target.value)} required />
                </div>
                <Button type="submit" disabled={isEmailSubmitting}>Verify and Set Primary Email</Button>
              </form>
            )}

            {emailMessage && <p className="text-sm text-emerald-600">{emailMessage}</p>}
            {emailError && <p className="text-sm text-red-600">{emailError}</p>}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4 max-w-xl">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <KeyRound size={18} className="text-brand-500" /> Change Password
            </h3>

            <form onSubmit={onChangePassword} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
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
                <Input type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                {passwordMismatch && <p className="text-xs text-red-600">Passwords do not match.</p>}
              </div>
              <Button type="submit" disabled={isPasswordSubmitting}>Update Password</Button>
            </form>

            {passwordMessage && <p className="text-sm text-emerald-600">{passwordMessage}</p>}
            {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          </div>

          <div className="text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-4">
            Account ID: {user?.id}
          </div>
        </div>
      </Card>
    </div>
  )
}
