export type DemoRole = 'guest' | 'customer' | 'seller'

export type DemoSession = {
  clerkId: string
  role: Exclude<DemoRole, 'guest'>
  token: string
  issuedAt: number
  expiresAt: number
}

type DemoSessionInput = Omit<DemoSession, 'issuedAt' | 'expiresAt'> &
  Partial<Pick<DemoSession, 'issuedAt' | 'expiresAt'>>

const AUTH_KEY_PREFIX = 'vyapari-auth-session'
const ACTIVE_ROLE_KEY = 'vyapari-active-role'
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000

function parseJwtExpiry(token: string): number | null {
  const parts = token.split('.')
  if (parts.length < 3) {
    return null
  }

  try {
    const decoded = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    if (typeof decoded.exp !== 'number') {
      return null
    }
    return decoded.exp * 1000
  } catch {
    return null
  }
}

export function createDemoClerkId() {
  return `clerk_${crypto.randomUUID()}`
}

export function createDemoToken(clerkId: string, role: Exclude<DemoRole, 'guest'>) {
  return `vyapari-demo-jwt.${clerkId}.${role}.${Date.now()}`
}

function getSessionExpiry(issuedAt: number) {
  return issuedAt + DEFAULT_SESSION_TTL_MS
}

function sessionKey(role: Exclude<DemoRole, 'guest'>) {
  return `${AUTH_KEY_PREFIX}-${role}`
}

export function setActiveRole(role: Exclude<DemoRole, 'guest'> | null) {
  if (!role) {
    localStorage.removeItem(ACTIVE_ROLE_KEY)
    return
  }
  localStorage.setItem(ACTIVE_ROLE_KEY, role)
}

export function getActiveRole(): Exclude<DemoRole, 'guest'> | null {
  const role = localStorage.getItem(ACTIVE_ROLE_KEY)
  return role === 'customer' || role === 'seller' ? role : null
}

export function getAuthSession(targetRole?: Exclude<DemoRole, 'guest'>): DemoSession | null {
  const role = targetRole ?? getActiveRole()
  if (!role) {
    return null
  }

  const raw = localStorage.getItem(sessionKey(role))
  if (!raw) {
    return null
  }

  try {
    const session = JSON.parse(raw) as Partial<DemoSession>
    if (
      !session.clerkId ||
      !session.role ||
      !session.token ||
      typeof session.issuedAt !== 'number'
    ) {
      clearAuthSession(role)
      return null
    }

    const expiresAt = typeof session.expiresAt === 'number' ? session.expiresAt : getSessionExpiry(session.issuedAt)
    if (Date.now() >= expiresAt) {
      clearAuthSession(role)
      return null
    }

    return {
      clerkId: session.clerkId,
      role: session.role,
      token: session.token,
      issuedAt: session.issuedAt,
      expiresAt,
    }
  } catch {
    clearAuthSession(role)
    return null
  }
}

export function setAuthSession(session: DemoSessionInput | null) {
  if (!session) {
    setActiveRole(null)
    return
  }
  const tokenExpiry = parseJwtExpiry(session.token)
  const now = Date.now()
  const normalizedSession: DemoSession = {
    ...session,
    issuedAt: typeof session.issuedAt === 'number' ? session.issuedAt : now,
    expiresAt:
      typeof session.expiresAt === 'number' ? session.expiresAt : tokenExpiry ?? getSessionExpiry(now),
  }
  localStorage.setItem(sessionKey(session.role), JSON.stringify(normalizedSession))
  setActiveRole(session.role)
}

export function refreshAuthToken(role: Exclude<DemoRole, 'guest'>, token: string) {
  const current = getAuthSession(role)
  if (!current) {
    return
  }

  setAuthSession({
    clerkId: current.clerkId,
    role,
    token,
    issuedAt: Date.now(),
    expiresAt: parseJwtExpiry(token) ?? getSessionExpiry(Date.now()),
  })
}

export function clearAuthSession(role: Exclude<DemoRole, 'guest'>) {
  localStorage.removeItem(sessionKey(role))
  if (getActiveRole() === role) {
    setActiveRole(null)
  }
}

export function clearAllAuthSessions() {
  clearAuthSession('customer')
  clearAuthSession('seller')
}

export function getAuthRole(): DemoRole {
  return getAuthSession()?.role ?? 'guest'
}

export function getAuthLabel(role: DemoRole) {
  return role === 'guest' ? 'Guest mode' : `${role.toUpperCase()} authenticated`
}
