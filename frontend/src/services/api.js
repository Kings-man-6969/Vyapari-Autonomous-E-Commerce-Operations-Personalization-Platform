const BASE_URL = 'http://localhost:8000/api/v1';
let _accessToken = null;

export function setAccessToken(token) {
  _accessToken = token;
  localStorage.setItem('vyapari_token', token);
}

export function clearAccessToken() {
  _accessToken = null;
  localStorage.removeItem('vyapari_token');
}

export function getAccessToken() {
  return _accessToken || localStorage.getItem('vyapari_token');
}

export async function bootstrapSession() {
  const token = localStorage.getItem('vyapari_token');
  if (!token) return null;
  _accessToken = token;
  try {
    const me = await apiFetch('/auth/me');
    return { access_token: token, role: me.account_type, user_id: me.user_id, name: me.name };
  } catch {
    clearAccessToken();
    return null;
  }
}

export async function apiFetch(path, options = {}, tokenOverride) {
  const token = tokenOverride || getAccessToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function getSessionId(userId) {
  if (userId) return userId;
  let id = localStorage.getItem('vyapari_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('vyapari_session_id', id);
  }
  return id;
}
