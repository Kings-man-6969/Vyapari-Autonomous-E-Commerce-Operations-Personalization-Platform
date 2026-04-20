import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { AuthPageLayout } from '../components/auth/AuthPageLayout'

function parseRoleParam(value: string | null): 'customer' | 'seller' | null {
  if (value === 'customer' || value === 'seller') {
    return value
  }
  return null
}

export function ResetPasswordConfirmationPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const role = parseRoleParam(searchParams.get('role'))
  const loginPath = `/auth/login${role ? `?role=${role}` : ''}`
  const fromPasswordReset = Boolean((location.state as { fromPasswordReset?: boolean } | null)?.fromPasswordReset)

  return (
    <AuthPageLayout
      role={role}
      title="Password Updated"
      subtitle="Your password was changed successfully. Use your new password to sign in securely."
      footer={
        <p className="text-sm text-center text-slate-500">
          Need another reset?{' '}
          <Link className="text-brand-600 hover:underline" to={`/auth/forgot-password${role ? `?role=${role}` : ''}`}>
            Start again
          </Link>
        </p>
      }
    >
      <div className="space-y-6">
        {fromPasswordReset ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={18} /> Reset complete
            </p>
            <p className="mt-2 text-sm text-emerald-700/90 dark:text-emerald-300/90">
              Your account is protected with the new password. Please sign in to continue.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/40">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
              <AlertCircle size={18} /> Confirmation page
            </p>
            <p className="mt-2 text-sm text-amber-700/90 dark:text-amber-300/90">
              If you recently reset your password, continue to login. Otherwise, you can start the reset flow from here.
            </p>
          </div>
        )}

        <Link
          to={loginPath}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
        >
          Continue to Login
        </Link>
      </div>
    </AuthPageLayout>
  )
}
