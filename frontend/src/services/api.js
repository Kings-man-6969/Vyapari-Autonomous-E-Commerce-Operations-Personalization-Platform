export const API_BASE = import.meta.env.VITE_API_BASE || ''

let accessToken = ''

export function setAccessToken(token) {
  accessToken = token || ''
}

export function getAccessToken() {
  return accessToken
}

export function clearAccessToken() {
  accessToken = ''
}

async function parseError(response) {
  let message = `Request failed (${response.status})`
  try {
    const payload = await response.json()
    message = payload.detail || payload.message || message
  } catch {
    // keep fallback message
  }
  return new Error(message)
}

export async function refreshSession() {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  const payload = await response.json()
  setAccessToken(payload.access_token)
  return payload
}

export async function bootstrapSession() {
  try {
    return await refreshSession()
  } catch {
    clearAccessToken()
    return null
  }
}

export async function apiFetch(path, options = {}, token = accessToken, retry = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })

  if (response.status === 401 && retry && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshed = await refreshSession()
    return apiFetch(path, options, refreshed.access_token, false)
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return null
}
