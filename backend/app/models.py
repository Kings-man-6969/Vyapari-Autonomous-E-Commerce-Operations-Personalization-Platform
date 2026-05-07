from sqlalchemy import CheckConstraint, Column, Integer, String, Float, Text, DateTime, ForeignKey
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("account_type in ('customer', 'seller', 'admin')", name="ck_users_account_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    account_type = Column(String, nullable=False, default="customer")
    password_hash = Column(String, nullable=False)
    is_active = Column(Integer, nullable=False, default=1)
    refresh_token = Column(String, nullable=True)
    refresh_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("stock >= 0", name="ck_products_stock_nonnegative"),
        CheckConstraint("price >= 0", name="ck_products_price_nonnegative"),
        CheckConstraint("cost >= 0", name="ck_products_cost_nonnegative"),
        CheckConstraint("price >= (cost * 1.10)", name="ck_products_price_guardrail"),
        CheckConstraint(
            "category in ('Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports')",
            name="ck_products_category_enum",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, unique=True, index=True, nullable=False)
    seller_id = Column(String, ForeignKey("users.user_id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    cost = Column(Float, nullable=False, default=0.0)
    stock = Column(Integer, nullable=False, default=0)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("stars >= 1 and stars <= 5", name="ck_reviews_stars_range"),
        CheckConstraint("length(text) >= 10 and length(text) <= 500", name="ck_reviews_text_length"),
    )

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(String, unique=True, index=True, nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    user_id = Column(String, nullable=True)
    stars = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    status = Column(String, default="pending")
    sentiment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Decision(Base):
    __tablename__ = "decisions"
    __table_args__ = (
        CheckConstraint("confidence_score >= 0 and confidence_score <= 1", name="ck_decisions_confidence_range"),
        CheckConstraint("risk_level in ('LOW', 'MEDIUM', 'HIGH')", name="ck_decisions_risk_level"),
        CheckConstraint(
            "decision_status in ('pending', 'approved', 'rejected', 'auto_executed')",
            name="ck_decisions_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    decision_id = Column(String, unique=True, index=True, nullable=False)
    agent_type = Column(String, nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    decision_type = Column(String, nullable=False)
    proposed_action = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)
    decision_status = Column(String, nullable=False, default="pending")
    approval_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    price_history_id = Column(String, unique=True, index=True, nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    old_price = Column(Float, nullable=False)
    new_price = Column(Float, nullable=False)
    changed_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewResponse(Base):
    __tablename__ = "review_responses"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(String, unique=True, index=True, nullable=False)
    review_id = Column(String, ForeignKey("reviews.review_id"), nullable=False)
    seller_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    response_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class InventoryLog(Base):
    __tablename__ = "inventory_log"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String, unique=True, index=True, nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    old_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    reason = Column(String, nullable=True)
    changed_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')", name="ck_orders_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    total_amount = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="pending")
    shipping_address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(String, unique=True, index=True, nullable=False)
    order_id = Column(String, ForeignKey("orders.order_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    seller_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    line_total = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="processing")
    created_at = Column(DateTime, default=datetime.utcnow)

class WishlistItem(Base):
    __tablename__ = "wishlist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    product_id = Column(String, ForeignKey("products.product_id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("transaction_type in ('sale', 'payout', 'fee', 'refund')", name="ck_transactions_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, unique=True, index=True, nullable=False)
    seller_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    order_id = Column(String, ForeignKey("orders.order_id"), nullable=True)
    amount = Column(Float, nullable=False)
    transaction_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SellerSettings(Base):
    __tablename__ = "seller_settings"

    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(String, ForeignKey("users.user_id"), unique=True, nullable=False)
    store_name = Column(String, nullable=True)
    store_description = Column(Text, nullable=True)
    return_policy = Column(Text, nullable=True)
    contact_email = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(String, unique=True, index=True, nullable=False)
    seller_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    action_type = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

