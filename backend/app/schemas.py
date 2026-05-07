from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List


# ── Shared config for ORM models ─────────────────────────────────
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Products ─────────────────────────────────────────────────────
class ProductOut(ORMModel):
    product_id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    stock: int
    image_url: Optional[str] = None
    avg_rating: Optional[float] = None
    review_count: Optional[int] = None


class ProductCreateIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    category: str
    price: float = Field(..., gt=0)
    cost: float = Field(..., gt=0)
    stock: int = Field(..., ge=0)


class ProductUpdateIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    price: Optional[float] = Field(None, gt=0)
    cost: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)


class ProductsResponse(BaseModel):
    products: List[ProductOut]
    total: int
    page: int
    per_page: int


class SearchResponse(BaseModel):
    results: List[ProductOut]
    total: int


# ── Reviews ──────────────────────────────────────────────────────
class ReviewIn(BaseModel):
    product_id: str
    user_id: Optional[str] = None
    stars: int = Field(..., ge=1, le=5)
    text: str = Field(..., min_length=10, max_length=500)


class ReviewOut(ORMModel):
    review_id: str
    product_id: str
    user_id: Optional[str] = None
    stars: int
    text: str
    status: str


class ReviewResponseIn(BaseModel):
    response_text: str = Field(..., min_length=5, max_length=500)


class ReviewResponseOut(ORMModel):
    response_id: str
    review_id: str
    seller_id: str
    response_text: str
    created_at: datetime


# ── Recommendations ──────────────────────────────────────────────
class RecommendationItem(BaseModel):
    product_id: str
    name: str
    price: float
    source: str
    confidence: float


class RecommendationResponse(BaseModel):
    recommendations: List[RecommendationItem]
    generated_at: str


# ── Cart ─────────────────────────────────────────────────────────
class CartAddIn(BaseModel):
    product_id: str
    qty: int = Field(..., ge=0, le=50)


class CartItem(BaseModel):
    product_id: str
    name: str
    qty: int
    unit_price: float
    line_total: float


class CartResponse(BaseModel):
    items: List[CartItem]
    total: float


# ── Auth ─────────────────────────────────────────────────────────
class LoginIn(BaseModel):
    email: str
    password: str = Field(..., min_length=1)


class RegisterIn(BaseModel):
    email: str = Field(..., min_length=5)
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str


class UserMe(ORMModel):
    user_id: str
    email: Optional[str] = None
    name: str
    account_type: str
    is_active: int


# ── Seller Stats ─────────────────────────────────────────────────
class StatsResponse(BaseModel):
    total_products: int
    critical_stock_items: int
    stock_warning_items: int
    pending_agent_decisions: int
    pending_reviews: int
    escalated_reviews: int


class SellerStatsResponse(BaseModel):
    total_products: int
    total_stock: int
    avg_price: float
    total_revenue: float
    total_reviews: int
    avg_rating: float


class InventoryListResponse(BaseModel):
    products: List[ProductOut]
    total: int
    page: int


# ── HITL / Decisions ─────────────────────────────────────────────
class DecisionOut(ORMModel):
    decision_id: str
    agent_type: str
    product_id: str
    decision_type: str
    proposed_action: str
    confidence_score: float
    risk_level: str
    decision_status: str
    approval_reason: Optional[str] = None


class DecisionsResponse(BaseModel):
    decisions: List[DecisionOut]
    total: int


class ApproveDecisionIn(BaseModel):
    approver_id: str


class RejectDecisionIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=250)
    approver_id: str


class HitlAnalyticsResponse(BaseModel):
    approval_rate: float
    rejection_rate: float
    avg_wait_time_ms: int


class DecisionHistoryResponse(BaseModel):
    decisions: List[DecisionOut]
    total: int


# ── Price History ─────────────────────────────────────────────────
class PriceHistoryOut(ORMModel):
    price_history_id: str
    product_id: str
    old_price: float
    new_price: float
    changed_by: str
    created_at: datetime


# ── Orders ───────────────────────────────────────────────────────
class OrderItemCreateIn(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1)


class OrderCreateIn(BaseModel):
    items: List[OrderItemCreateIn]
    shipping_address: Optional[str] = None


class OrderItemOut(ORMModel):
    order_item_id: str
    order_id: str
    product_id: str
    seller_id: str
    quantity: int
    unit_price: float
    line_total: float
    status: str = "processing"
    created_at: datetime


class OrderOut(ORMModel):
    order_id: str
    user_id: str
    total_amount: float
    status: str
    shipping_address: Optional[str] = None
    created_at: datetime
    items: List[OrderItemOut] = []


# ── Wishlist ─────────────────────────────────────────────────────
class WishlistAddIn(BaseModel):
    product_id: str


class WishlistItemOut(ORMModel):
    product_id: str
    name: str
    price: float
    added_at: datetime


# ── Finance ──────────────────────────────────────────────────────
class TransactionOut(ORMModel):
    transaction_id: str
    order_id: Optional[str] = None
    amount: float
    transaction_type: str
    description: Optional[str] = None
    created_at: datetime


class FinanceDashboardOut(BaseModel):
    total_revenue: float
    pending_payout: float
    recent_transactions: List[TransactionOut]


# ── Seller Settings ───────────────────────────────────────────────
class SellerSettingsUpdateIn(BaseModel):
    store_name: Optional[str] = None
    store_description: Optional[str] = None
    return_policy: Optional[str] = None
    contact_email: Optional[str] = None


class SellerSettingsOut(ORMModel):
    store_name: Optional[str] = None
    store_description: Optional[str] = None
    return_policy: Optional[str] = None
    contact_email: Optional[str] = None


# ── Agent ────────────────────────────────────────────────────────
class AgentLogIn(BaseModel):
    action_type: str
    details: Optional[str] = None


class AgentLogOut(ORMModel):
    log_id: str
    seller_id: str
    action_type: str
    details: Optional[str] = None
    created_at: datetime


class AgentCommandIn(BaseModel):
    command: str = Field(..., min_length=3, max_length=500)


class AgentCommandOut(BaseModel):
    status: str
    message: str
    log_id: Optional[str] = None
