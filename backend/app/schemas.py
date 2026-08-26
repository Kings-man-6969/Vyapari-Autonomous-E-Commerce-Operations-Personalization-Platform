from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    account_type: str  # customer | seller

    @field_validator("account_type")
    @classmethod
    def validate_type(cls, v):
        if v not in ("customer", "seller"):
            raise ValueError("account_type must be 'customer' or 'seller'")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    name: str


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str
    account_type: str
    created_at: str


# ─── Products ────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = ""
    price: float
    cost: float
    stock: int
    sku: Optional[str] = None
    image_url: Optional[str] = "📦"

    @field_validator("price")
    @classmethod
    def validate_price(cls, v, info):
        return v

    @field_validator("stock")
    @classmethod
    def validate_stock(cls, v):
        if v < 0:
            raise ValueError("Stock cannot be negative")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None


class ProductOut(BaseModel):
    product_id: str
    name: str
    category: str
    description: Optional[str] = ""
    price: float
    cost: Optional[float] = None
    stock: int
    sku: Optional[str] = None
    image_url: str
    avg_rating: float
    review_count: int
    in_stock: bool
    created_at: str

    model_config = {"from_attributes": True}


class ReviewPublic(BaseModel):
    review_id: str
    stars: int
    text: str
    sentiment: Optional[str] = None
    agent_response: Optional[str] = None
    response_published_at: Optional[str] = None
    created_at: str
    user_name: str

    model_config = {"from_attributes": True}


class ProductDetailOut(ProductOut):
    reviews: List[ReviewPublic] = []


class ProductListResponse(BaseModel):
    products: List[ProductOut]
    total: int
    page: int
    per_page: int
    total_pages: int


class SearchResult(BaseModel):
    product_id: str
    name: str
    category: str
    price: float
    avg_rating: float
    image_url: str
    match_reason: str
    in_stock: bool
    stock: int


class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    query: str


class RecommendationItem(BaseModel):
    product_id: str
    name: str
    category: str
    price: float
    avg_rating: float
    image_url: str
    source: str
    confidence: float
    in_stock: bool


class RecommendationResponse(BaseModel):
    recommendations: List[RecommendationItem]
    source: str
    generated_at: str


# ─── Cart ────────────────────────────────────────────────────────────────────

class CartItemAdd(BaseModel):
    product_id: str
    qty: int = 1

    @field_validator("qty")
    @classmethod
    def validate_qty(cls, v):
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class CartItemUpdate(BaseModel):
    qty: int

    @field_validator("qty")
    @classmethod
    def validate_qty(cls, v):
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class CartItemOut(BaseModel):
    cart_item_id: str
    product_id: str
    name: str
    price: float
    qty: int
    image_url: str
    subtotal: float
    in_stock: bool
    available_stock: int


class CartResponse(BaseModel):
    items: List[CartItemOut]
    item_count: int
    total: float


# ─── Orders ──────────────────────────────────────────────────────────────────

class ShippingAddress(BaseModel):
    name: str
    street: str
    city: str
    state: str
    pincode: str
    phone: str


class CheckoutRequest(BaseModel):
    shipping_address: ShippingAddress


class OrderItemOut(BaseModel):
    product_id: str
    product_name: str
    qty: int
    unit_price: float


class OrderOut(BaseModel):
    order_id: str
    status: str
    total_amount: float
    item_count: int = 0
    items: Optional[List[OrderItemOut]] = []
    shipping_address: Optional[Any] = None
    created_at: str

    model_config = {"from_attributes": True}


class OrderDetailOut(BaseModel):
    order_id: str
    status: str
    total_amount: float
    shipping_address: Any
    items: List[OrderItemOut]
    created_at: str
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderListResponse(BaseModel):
    orders: List[OrderOut]
    total: int


# ─── Reviews ─────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    product_id: str
    stars: int
    text: str

    @field_validator("stars")
    @classmethod
    def validate_stars(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Stars must be between 1 and 5")
        return v

    @field_validator("text")
    @classmethod
    def validate_text(cls, v):
        if len(v) < 10:
            raise ValueError("Review must be at least 10 characters")
        if len(v) > 500:
            raise ValueError("Review must be at most 500 characters")
        return v


class ReviewOut(BaseModel):
    review_id: str
    product_id: str
    product_name: Optional[str] = None
    user_name: Optional[str] = None
    stars: int
    text: str
    sentiment: Optional[str] = None
    status: str
    agent_response: Optional[str] = None
    response_status: Optional[str] = None
    response_published_at: Optional[str] = None
    created_at: str
    processed_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ReviewListResponse(BaseModel):
    reviews: List[ReviewOut]
    total: int
    pending_count: int
    positive_count: int
    negative_count: int
    neutral_count: int


class RespondRequest(BaseModel):
    response: str


# ─── Wishlist ────────────────────────────────────────────────────────────────

class WishlistItemOut(BaseModel):
    product_id: str
    name: str
    price: float
    image_url: str
    in_stock: bool
    added_at: str


class WishlistResponse(BaseModel):
    items: List[WishlistItemOut]
    total: int


# ─── Seller ──────────────────────────────────────────────────────────────────

class SellerStatsResponse(BaseModel):
    total_products: int
    critical_stock: int
    warning_stock: int
    total_orders_today: int
    revenue_today: float
    revenue_this_month: float
    pending_decisions: int
    pending_reviews: int
    escalated_reviews: int
    approval_rate: float


class InventoryProductOut(BaseModel):
    product_id: str
    name: str
    category: str
    price: float
    cost: float
    stock: int
    sku: Optional[str] = None
    image_url: str
    avg_rating: float
    review_count: int
    avg_daily_sales: float
    days_remaining: float
    status: str  # CRITICAL|WARNING|OK


class InventoryListResponse(BaseModel):
    products: List[InventoryProductOut]
    total: int
    critical_count: int
    warning_count: int
    ok_count: int


class PricingProductOut(BaseModel):
    product_id: str
    name: str
    our_price: float
    competitor_a: float
    competitor_b: float
    competitor_c: float
    min_competitor: float
    price_diff_pct: float
    suggested_price: float
    status: str  # OVERPRICED|COMPETITIVE|UNDERPRICED
    last_updated: str


class PricingListResponse(BaseModel):
    products: List[PricingProductOut]
    total: int


class ScanResponse(BaseModel):
    message: str
    decisions_created: int
    auto_executed: int
    pending_review: int
    escalated: int = 0
    scan_duration_ms: Optional[int] = None


class CategoryRevenue(BaseModel):
    category: str
    revenue: float
    pct: float


class TopProduct(BaseModel):
    product_id: str
    name: str
    revenue: float
    units_sold: int


class DailyRevenue(BaseModel):
    date: str
    revenue: float
    orders: int


class AnalyticsResponse(BaseModel):
    period: str
    total_revenue: float
    total_orders: int
    avg_order_value: float
    top_products: List[TopProduct]
    revenue_by_category: List[CategoryRevenue]
    daily_revenue: List[DailyRevenue]


# ─── HITL ─────────────────────────────────────────────────────────────────────

class DecisionOut(BaseModel):
    decision_id: str
    agent_type: str
    decision_type: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    review_id: Optional[str] = None
    proposed_action: Any
    confidence_score: float
    risk_level: str
    decision_status: str
    created_at: str

    model_config = {"from_attributes": True}


class DecisionDetailOut(DecisionOut):
    approver_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    updated_at: Optional[str] = None
    review_text: Optional[str] = None
    related_product: Optional[Any] = None
    previous_decisions: List[Any] = []


class DecisionListResponse(BaseModel):
    decisions: List[DecisionOut]
    total: int
    pending_count: int
    auto_executed_today: int


class ApproveRequest(BaseModel):
    notes: Optional[str] = None


class RejectRequest(BaseModel):
    reason: str
    notes: Optional[str] = None


class HITLAnalyticsResponse(BaseModel):
    period: str
    total_decisions: int
    approved: int
    rejected: int
    auto_executed: int
    approval_rate: float
    avg_processing_time_hours: float
    by_type: Any
    by_risk: Any


class OrderStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        allowed = ("placed", "processing", "shipped", "delivered", "cancelled", "pending")
        if v not in allowed:
            raise ValueError(f"Status must be one of {allowed}")
        return v


# ─── Admin / User Me ─────────────────────────────────────────────────────────

class UserMe(BaseModel):
    user_id: str
    email: str
    name: str
    account_type: str
    is_active: bool = True
    created_at: Optional[str] = None
    model_config = {"from_attributes": True}


# ─── Agent ───────────────────────────────────────────────────────────────────

class AgentCommandIn(BaseModel):
    command: str


class AgentCommandOut(BaseModel):
    status: str
    message: str
    log_id: str


class AgentLogOut(BaseModel):
    log_id: str
    action_type: str
    details: str
    created_at: str
    model_config = {"from_attributes": True}


# ─── Store Settings ──────────────────────────────────────────────────────────

class StoreSettingsIn(BaseModel):
    store_name: Optional[str] = ""
    store_description: Optional[str] = ""
    return_policy: Optional[str] = ""
    contact_email: Optional[str] = ""


class StoreSettingsOut(BaseModel):
    store_name: str
    store_description: str
    return_policy: str
    contact_email: str
    model_config = {"from_attributes": True}


# ─── Price History ───────────────────────────────────────────────────────────

class PriceHistoryItem(BaseModel):
    old_price: float
    new_price: float
    changed_at: str
    model_config = {"from_attributes": True}


class PriceHistoryResponse(BaseModel):
    product_id: str
    price_history: List[PriceHistoryItem]


# ─── Finance ─────────────────────────────────────────────────────────────────

class FinanceTransaction(BaseModel):
    transaction_id: str
    transaction_type: str
    amount: float
    order_id: Optional[str] = None
    created_at: str
    description: str


class FinanceResponse(BaseModel):
    total_revenue: float
    pending_payout: float
    recent_transactions: List[FinanceTransaction]


# ─── Wishlist Add ────────────────────────────────────────────────────────────

class WishlistAddIn(BaseModel):
    product_id: str

