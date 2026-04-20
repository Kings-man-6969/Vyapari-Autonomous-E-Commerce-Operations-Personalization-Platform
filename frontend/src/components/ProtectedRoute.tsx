import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getAuthMe } from '../api'
import { clearAllAuthSessions, getAuthSession, refreshAuthToken, type DemoRole } from '../auth'
import type { ReactNode } from 'react'
import { useAuth } from '@clerk/react'

interface ProtectedRouteProps {
  role: Exclude<DemoRole, 'guest'>
  children: ReactNode
}

export function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [status, setStatus] = useState<'loading' | 'allowed' | 'blocked'>('loading')

  useEffect(() => {
    if (!isLoaded) {
      setStatus('loading')
      return
    }

    if (!isSignedIn) {
      clearAllAuthSessions()
      setStatus('blocked')
      return
    }

    const session = getAuthSession()
    if (!session) {
      clearAllAuthSessions()
      setStatus('blocked')
      return
    }

    getToken()
      .then((clerkToken) => {
        if (!clerkToken) {
          clearAllAuthSessions()
          setStatus('blocked')
          return
        }

        refreshAuthToken(session.role, clerkToken)
        return getAuthMe()
      })
      .then((me) => {
        if (!me) {
          return
        }
        setStatus(me.role === role ? 'allowed' : 'blocked')
      })
      .catch(() => {
        clearAllAuthSessions()
        setStatus('blocked')
      })
  }, [getToken, isLoaded, isSignedIn, role])

  if (status === 'loading') {
    return <section className="auth-panel">Verifying session...</section>
  }

  if (status !== 'allowed') {
    return <Navigate to="/" replace />
  }
  return children
}
