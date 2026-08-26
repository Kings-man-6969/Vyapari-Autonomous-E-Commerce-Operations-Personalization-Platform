from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, UniqueConstraint, Index, ForeignKey
)
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"
    user_id      = Column(String, primary_key=True)
    email        = Column(String, unique=True, nullable=False, index=True)
    name         = Column(String, nullable=False)
    password_hash= Column(String, nullable=False)
    account_type = Column(String, nullable=False)   # customer | seller | admin
    created_at   = Column(String, nullable=False)
    last_login   = Column(String, nullable=True)
    is_active    = Column(Boolean, default=True)

    ratings      = relationship("Rating",      back_populates="user", cascade="all, delete-orphan")
    reviews      = relationship("Review",      back_populates="user", cascade="all, delete-orphan")
    orders       = relationship("Order",       back_populates="customer", cascade="all, delete-orphan")
    wishlist     = relationship("WishlistItem",back_populates="user", cascade="all, delete-orphan")
    products     = relationship("Product",     back_populates="seller")
    settings     = relationship("StoreSettings", back_populates="seller", uselist=False, cascade="all, delete-orphan")
    agent_logs   = relationship("AgentLog",    back_populates="seller", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"
    product_id   = Column(String, primary_key=True)
    seller_id    = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    name         = Column(String, nullable=False)
    category     = Column(String, nullable=False)
    description  = Column(Text, default="")
    price        = Column(Float, nullable=False)
    cost         = Column(Float, nullable=False, default=0)
    stock        = Column(Integer, nullable=False, default=0)
    sku          = Column(String, unique=True, nullable=True)
    image_url    = Column(String, default="📦")
    avg_rating   = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    created_at   = Column(String, nullable=False)
    updated_at   = Column(String, nullable=True)

    seller       = relationship("User",        back_populates="products")
    ratings      = relationship("Rating",      back_populates="product", cascade="all, delete-orphan")
    reviews      = relationship("Review",      back_populates="product", cascade="all, delete-orphan")
    order_items  = relationship("OrderItem",   back_populates="product")
    wishlist     = relationship("WishlistItem",back_populates="product", cascade="all, delete-orphan")
    competitor_price = relationship("CompetitorPrice", back_populates="product", uselist=False, cascade="all, delete-orphan")
    decisions    = relationship("Decision",    back_populates="product")
    price_history= relationship("PriceHistory",back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_products_category", "category"),)


class PriceHistory(Base):
    __tablename__ = "price_history"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False, index=True)
    old_price  = Column(Float, nullable=False)
    new_price  = Column(Float, nullable=False)
    changed_at = Column(String, nullable=False)

    product    = relationship("Product", back_populates="price_history")


class StoreSettings(Base):
    __tablename__ = "store_settings"
    seller_id        = Column(String, ForeignKey("users.user_id"), primary_key=True)
    store_name       = Column(String, default="Vyapari Store")
    store_description= Column(Text, default="")
    return_policy    = Column(Text, default="30-day return policy")
    contact_email    = Column(String, default="")
    updated_at       = Column(String, nullable=True)

    seller           = relationship("User", back_populates="settings")


class AgentLog(Base):
    __tablename__ = "agent_logs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    log_id     = Column(String, unique=True, index=True)
    seller_id  = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    action_type= Column(String, default="command")
    details    = Column(Text, nullable=False)
    created_at = Column(String, nullable=False)

    seller     = relationship("User", back_populates="agent_logs")


class Rating(Base):
    __tablename__ = "ratings"
    rating_id  = Column(String, primary_key=True)
    user_id    = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False, index=True)
    rating     = Column(Integer, nullable=False)
    created_at = Column(String, nullable=False)

    user    = relationship("User",    back_populates="ratings")
    product = relationship("Product", back_populates="ratings")

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_rating"),)


class Review(Base):
    __tablename__ = "reviews"
    review_id            = Column(String, primary_key=True)
    product_id           = Column(String, ForeignKey("products.product_id"), nullable=False, index=True)
    user_id              = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    stars                = Column(Integer, nullable=False)
    text                 = Column(Text, nullable=False)
    sentiment            = Column(String, nullable=True)   # POSITIVE|NEGATIVE|NEUTRAL
    status               = Column(String, default="pending")  # pending|published|rejected
    agent_response       = Column(Text, nullable=True)
    response_status      = Column(String, nullable=True)   # draft|published|rejected
    response_published_at= Column(String, nullable=True)
    created_at           = Column(String, nullable=False)
    processed_at         = Column(String, nullable=True)

    user    = relationship("User",    back_populates="reviews")
    product = relationship("Product", back_populates="reviews")
    decision= relationship("Decision",back_populates="review", uselist=False)


class CartItem(Base):
    __tablename__ = "cart_items"
    cart_item_id = Column(String, primary_key=True)
    session_id   = Column(String, nullable=False, index=True)
    product_id   = Column(String, ForeignKey("products.product_id"), nullable=False)
    qty          = Column(Integer, nullable=False, default=1)
    added_at     = Column(String, nullable=False)

    product = relationship("Product")


class Order(Base):
    __tablename__ = "orders"
    order_id         = Column(String, primary_key=True)
    customer_id      = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    status           = Column(String, default="placed")
    total_amount     = Column(Float, nullable=False)
    shipping_address = Column(Text, nullable=False)
    created_at       = Column(String, nullable=False)
    updated_at       = Column(String, nullable=True)

    customer = relationship("User",      back_populates="orders")
    items    = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    order_item_id = Column(String, primary_key=True)
    order_id      = Column(String, ForeignKey("orders.order_id"), nullable=False, index=True)
    product_id    = Column(String, ForeignKey("products.product_id"), nullable=False)
    product_name  = Column(String, nullable=False)
    qty           = Column(Integer, nullable=False)
    unit_price    = Column(Float, nullable=False)

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")


class WishlistItem(Base):
    __tablename__ = "wishlist_items"
    wishlist_id = Column(String, primary_key=True)
    user_id     = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    product_id  = Column(String, ForeignKey("products.product_id"), nullable=False)
    added_at    = Column(String, nullable=False)

    user    = relationship("User",    back_populates="wishlist")
    product = relationship("Product", back_populates="wishlist")

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_wishlist"),)


class CompetitorPrice(Base):
    __tablename__ = "competitor_prices"
    price_id     = Column(String, primary_key=True)
    product_id   = Column(String, ForeignKey("products.product_id"), nullable=False, unique=True)
    competitor_a = Column(Float, nullable=False)
    competitor_b = Column(Float, nullable=False)
    competitor_c = Column(Float, nullable=False)
    last_updated = Column(String, nullable=False)

    product = relationship("Product", back_populates="competitor_price")


class Decision(Base):
    __tablename__ = "decisions"
    decision_id      = Column(String, primary_key=True)
    agent_type       = Column(String, nullable=False)  # INVENTORY|PRICING|REVIEW_RESPONSE
    product_id       = Column(String, ForeignKey("products.product_id"), nullable=True, index=True)
    review_id        = Column(String, ForeignKey("reviews.review_id"), nullable=True)
    decision_type    = Column(String, nullable=False)  # RESTOCK|PRICE_ADJUST|REVIEW_DRAFT
    proposed_action  = Column(Text, nullable=False)    # JSON string
    confidence_score = Column(Float, nullable=False)
    risk_level       = Column(String, nullable=False)  # LOW|MEDIUM|HIGH
    decision_status  = Column(String, default="pending")  # pending|approved|rejected|auto_executed
    approver_id      = Column(String, ForeignKey("users.user_id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at       = Column(String, nullable=False)
    updated_at       = Column(String, nullable=True)

    product = relationship("Product", back_populates="decisions")
    review  = relationship("Review",  back_populates="decision")

    __table_args__ = (
        Index("ix_decisions_status_created", "decision_status", "created_at"),
    )
