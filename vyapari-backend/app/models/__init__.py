"""
Vyapari — Models Package
Imports all models so Alembic can detect them during autogenerate.
"""
from app.models.user import User, UserRole  # noqa: F401
from app.models.customer_profile import CustomerProfile  # noqa: F401
from app.models.seller_profile import SellerProfile, KYCStatus  # noqa: F401
from app.models.product import (  # noqa: F401
    Category,
    Product,
    ProductImage,
    ProductVariant,
    ProductStatus,
)
from app.models.order import (  # noqa: F401
    Address,
    Cart,
    CartItem,
    Wishlist,
    WishlistItem,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentStatus,
    PaymentMethod,
    Payout,
    PayoutStatus,
    Coupon,
    DiscountType,
)
from app.models.review import Review  # noqa: F401
from app.models.embedding import ProductEmbedding, UserEmbedding, ModelRegistry  # noqa: F401
from app.models.ml_event import UserEvent, SearchQuery, EventType  # noqa: F401
from app.models.notification import Notification, NotificationType  # noqa: F401
