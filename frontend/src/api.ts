import { getAuthSession } from './auth'

const DEFAULT_API_BASE = 'http://localhost:8000'
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')
const API_TIMEOUT_MS = 10000

type ApiEnvelope<T> = {
  data: T
  error: string | null
  status: string
}

export class ApiRequestError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(`Request failed: ${status} ${detail}`)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const session = getAuthSession()
  const method = (options?.method ?? 'GET').toUpperCase()
  const shouldRetry = method === 'GET'
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    ...((options?.headers as Record<string, string> | undefined) ?? {}),
  }

  const execute = async () => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      return await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: mergedHeaders,
        signal: controller.signal,
      })
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  const fetchResponse = async () => {
    try {
      return await execute()
    } catch (error) {
      if (shouldRetry) {
        return await execute()
      }
      throw error
    }
  }

  const response = await fetchResponse()

  if (!response.ok) {
    let detail = 'Request failed'
    try {
      const errorBody = (await response.json()) as { detail?: string }
      if (errorBody.detail) {
        detail = errorBody.detail
      }
    } catch {
      // keep fallback detail
    }
    throw new ApiRequestError(response.status, detail)
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  return payload.data
}

export type Product = {
  id: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  description: string
}

export type ProductCreatePayload = {
  name: string
  category: Product['category']
  price: number
  cost: number
  stock: number
  description: string
}

export type ProductUpdatePayload = {
  name?: string
  category?: Product['category']
  price?: number
  cost?: number
  stock?: number
  description?: string
}

export type Decision = {
  id: number
  type: 'restock' | 'pricing'
  product_id: string
  product_name: string
  mode: 'autonomous' | 'advisory'
  confidence: number
  reasoning: string
  payload: Record<string, unknown>
  status: string
  created_at: string
  resolved_at?: string | null
  resolved_by?: string | null
}

export type Review = {
  id: string
  product_id: string
  stars: number
  text: string
  sentiment?: string
  sentiment_confidence?: number
  sentiment_source?: string
  escalated: boolean
  escalation_reason?: string | null
  draft_response?: string | null
  status: string
}

export type AuthSession = {
  clerk_id: string
  role: 'customer' | 'seller'
  token: string
}

export type AgentSettings = {
  restock_threshold_days: number
  restock_buffer_days: number
  price_drift_threshold_pct: number
  minimum_price_margin_pct: number
  escalation_star_threshold: number
  sentiment_confidence_min: number
  autonomous_confidence_threshold: number
  max_auto_drafts_per_run: number
}

export type CartItem = {
  id: number
  product_id: string
  name: string
  price: number
  qty: number
  subtotal: number
}

export type CustomerProfile = {
  clerk_id: string
  role: 'customer'
  display_name: string
  preferences: {
    currency: string
    language: string
  }
}

export type CustomerOrder = {
  id: string
  status: string
  total_amount: number
  items: Array<Record<string, unknown>>
  created_at: string
}

export type WishlistItem = {
  id: number
  product_id: string
  name: string
  category: string
  price: number
  stock: number
  description: string
  created_at: string
}

export type AgentStatus = {
  recommendation_agent: {
    status: string
    last_run: string
    details: string
  }
  inventory_pricing_agent: {
    status: string
    last_run: string
    details: string
  }
  review_response_agent: {
    status: string
    last_run: string
    details: string
  }
}

export type PricingRow = {
  id: string
  name: string
  category: string
  our_price: number
  competitor_price: number
  diff_pct: number
  suggested_price: number
  status: 'OK' | 'OVERPRICED' | 'UNDERPRICED'
}

export type AnalyticsData = {
  sales_velocity: Array<{
    day: string
    products: Array<{
      product_id: string
      product_name: string
      units: number
    }>
  }>
  stock_health: Array<{ status: 'Critical' | 'Warning' | 'OK'; count: number }>
  category_revenue: Array<{ category: string; revenue: number }>
  sentiment_distribution: Array<{ label: 'Positive' | 'Neutral' | 'Negative'; count: number }>
  top_products: Array<{ id: string; name: string }>
}

export function getProducts() {
  return request<Product[]>('/products')
}

export function getCart() {
  return request<CartItem[]>('/cart')
}

export function addToCart(body: { product_id: string; qty: number }) {
  return request<CartItem[]>('/cart/add', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function checkoutCart() {
  return request<{ order_id: string; total: number }>('/cart/checkout', {
    method: 'POST',
  })
}

export function removeCartItem(itemId: number) {
  return request<CartItem[]>(`/cart/${itemId}`, {
    method: 'DELETE',
  })
}

export function getMyProfile() {
  return request<CustomerProfile>('/me/profile')
}

export function getMyOrders() {
  return request<CustomerOrder[]>('/me/orders')
}

export function getMyOrder(id: string) {
  return request<CustomerOrder>(`/me/orders/${id}`)
}

export function getWishlist() {
  return request<WishlistItem[]>('/wishlist')
}

export function addToWishlist(productId: string) {
  return request<WishlistItem[]>('/wishlist', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  })
}

export function removeFromWishlist(productId: string) {
  return request<WishlistItem[]>(`/wishlist/${productId}`, {
    method: 'DELETE',
  })
}

export function getProduct(id: string) {
  return request<Product & { reviews: Array<Record<string, unknown>> }>(`/products/${id}`)
}

export function getRecommendations(userId: string) {
  return request<Array<Record<string, unknown>>>(`/recommendations/${userId}?top_n=6`)
}

export function searchProducts(q: string) {
  return request<Array<Record<string, unknown>>>(`/search?q=${encodeURIComponent(q)}&top_n=8`)
}

export function submitReview(body: {
  product_id: string
  user_id: string
  stars: number
  text: string
}) {
  return request<{ id: string; status: string }>('/reviews', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getStats() {
  return request<Record<string, number>>('/stats')
}

export function getInventory() {
  return request<Array<Record<string, unknown>>>('/inventory')
}

export function patchProduct(
  id: string,
  body: { field: 'price' | 'stock'; value: number },
) {
  return request<Product>(`/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function createProduct(body: ProductCreatePayload) {
  return request<{ id: string }>('/products', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateProduct(id: string, body: ProductUpdatePayload) {
  return request<Product>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteProduct(id: string) {
  return request<{ ok: boolean }>(`/products/${id}`, {
    method: 'DELETE',
  })
}

export function runInventoryScan() {
  return request<{ scanned: number; new_decisions: number }>('/inventory/scan', {
    method: 'POST',
  })
}

export function getPendingDecisions() {
  return request<Decision[]>('/decisions/pending')
}

export function getAllDecisions() {
  return request<Decision[]>('/decisions?limit=50')
}

export function resolveDecision(
  id: number,
  body: { action: 'approve' | 'reject'; resolved_by: string },
) {
  return request<{ ok: boolean; status: string }>(`/decisions/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function processReviews() {
  return request<{ processed: number }>('/reviews/process', {
    method: 'POST',
  })
}

export function getReviews(status?: string) {
  const qp = status ? `?status=${encodeURIComponent(status)}` : ''
  return request<Review[]>(`/reviews${qp}`)
}

export function approveReview(id: string, responseText: string) {
  return request<{ ok: boolean; status: string }>(`/reviews/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ response: responseText }),
  })
}

export function rejectReview(id: string) {
  return request<{ ok: boolean; status: string }>(`/reviews/${id}/reject`, {
    method: 'POST',
  })
}

export function registerAuth(body: { role: 'customer' | 'seller' }, clerkToken: string) {
  return request<AuthSession>('/auth/register', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkToken}`,
    },
    body: JSON.stringify(body),
  })
}

export function getAuthMe(clerkToken?: string) {
  return request<{ clerk_id: string; role: 'customer' | 'seller' }>('/auth/me', {
    headers: clerkToken
      ? {
          Authorization: `Bearer ${clerkToken}`,
        }
      : undefined,
  })
}

export function getSettings() {
  return request<AgentSettings>('/settings')
}

export function updateSettings(body: AgentSettings) {
  return request<{ ok: boolean; updated: boolean }>('/settings', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function getAgentStatus() {
  return request<AgentStatus>('/hitl/agents')
}

export function getPricingMonitor() {
  return request<PricingRow[]>('/pricing')
}

export function getAnalytics() {
  return request<AnalyticsData>('/analytics')
}
