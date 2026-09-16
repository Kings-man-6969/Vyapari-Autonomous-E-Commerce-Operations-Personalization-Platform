"""
Vyapari — Order Service
Cart management, checkout, and order lifecycle.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.customer_profile import CustomerProfile
from app.models.order import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.models.product import Product
from app.schemas.order import (
    CartItemAdd,
    CartItemUpdate,
    CartRead,
    CheckoutRequest,
    OrderRead,
    OrderStatusUpdate,
)

logger = get_logger(__name__)


class OrderService:

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Cart ──────────────────────────────────────────────────────────────────

    async def _get_or_create_cart(self, customer_profile_id: UUID) -> Cart:
        result = await self.db.execute(
            select(Cart)
            .where(Cart.customer_id == customer_profile_id)
            .options(selectinload(Cart.items))
        )
        cart = result.scalar_one_or_none()
        if not cart:
            cart = Cart(customer_id=customer_profile_id)
            self.db.add(cart)
            await self.db.flush()
        return cart

    async def get_cart(self, user_id: UUID) -> CartRead:
        profile = await self._get_customer_profile(user_id)
        cart = await self._get_or_create_cart(profile.id)
        # Build enriched response
        items_out = []
        subtotal = 0.0
        for item in cart.items:
            if item.saved_for_later:
                continue
            product_result = await self.db.execute(
                select(Product).where(Product.id == item.product_id)
            )
            product = product_result.scalar_one_or_none()
            price = float(product.price) if product else 0.0
            subtotal += price * item.qty
            items_out.append({
                "id": item.id,
                "product_id": item.product_id,
                "variant_id": item.variant_id,
                "qty": item.qty,
                "saved_for_later": item.saved_for_later,
                "product_name": product.name if product else None,
                "product_price": price,
            })
        return CartRead(id=cart.id, items=items_out, subtotal=subtotal)

    async def add_to_cart(self, user_id: UUID, data: CartItemAdd) -> None:
        profile = await self._get_customer_profile(user_id)
        cart = await self._get_or_create_cart(profile.id)

        # Check if item already in cart
        result = await self.db.execute(
            select(CartItem).where(
                CartItem.cart_id == cart.id,
                CartItem.product_id == data.product_id,
                CartItem.variant_id == data.variant_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.qty += data.qty
        else:
            self.db.add(CartItem(
                cart_id=cart.id,
                product_id=data.product_id,
                variant_id=data.variant_id,
                qty=data.qty,
            ))

    async def update_cart_item(self, user_id: UUID, item_id: UUID, data: CartItemUpdate) -> None:
        item = await self._get_cart_item(user_id, item_id)
        if data.qty is not None:
            if data.qty == 0:
                await self.db.delete(item)
                return
            item.qty = data.qty
        if data.saved_for_later is not None:
            item.saved_for_later = data.saved_for_later

    async def remove_cart_item(self, user_id: UUID, item_id: UUID) -> None:
        item = await self._get_cart_item(user_id, item_id)
        await self.db.delete(item)

    async def _get_cart_item(self, user_id: UUID, item_id: UUID) -> CartItem:
        profile = await self._get_customer_profile(user_id)
        cart = await self._get_or_create_cart(profile.id)
        result = await self.db.execute(
            select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        )
        item = result.scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found.")
        return item

    # ── Checkout ──────────────────────────────────────────────────────────────

    async def checkout(self, user_id: UUID, data: CheckoutRequest) -> Order:
        """
        Converts the user's cart into an Order.
        Razorpay order creation is triggered by payment_service.
        """
        from app.models.order import Address  # local to avoid circular import

        profile = await self._get_customer_profile(user_id)
        cart = await self._get_or_create_cart(profile.id)

        active_items = [i for i in cart.items if not i.saved_for_later]
        if not active_items:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart is empty.",
            )

        # Fetch address snapshot
        addr_result = await self.db.execute(
            select(Address).where(Address.id == data.shipping_address_id, Address.user_id == user_id)
        )
        address = addr_result.scalar_one_or_none()
        if not address:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Address not found.")

        address_snapshot = {
            "full_name": address.full_name,
            "phone": address.phone,
            "line1": address.line1,
            "line2": address.line2,
            "city": address.city,
            "state": address.state,
            "pincode": address.pincode,
            "country": address.country,
        }

        # Build order items & total
        total = 0.0
        order_items: list[OrderItem] = []
        for cart_item in active_items:
            product_result = await self.db.execute(
                select(Product).where(Product.id == cart_item.product_id)
            )
            product = product_result.scalar_one_or_none()
            if not product or product.stock_qty < cart_item.qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for product: {product.name if product else cart_item.product_id}",
                )
            unit_price = float(product.price)
            total += unit_price * cart_item.qty
            order_items.append(OrderItem(
                product_id=product.id,
                seller_id=product.seller_id,
                variant_id=cart_item.variant_id,
                qty=cart_item.qty,
                unit_price=unit_price,
                product_name=product.name,
            ))
            # Reserve stock
            product.stock_qty -= cart_item.qty

        # Calculate discount from coupon if provided
        discount_amount = 0.0
        applied_coupon_code = None
        if data.coupon_code:
            from datetime import datetime, timezone
            from app.models.order import Coupon, DiscountType
            now = datetime.now(tz=timezone.utc)
            coupon_res = await self.db.execute(
                select(Coupon).where(
                    Coupon.code == data.coupon_code.strip().upper(),
                    Coupon.is_active == True,
                )
            )
            coupon = coupon_res.scalar_one_or_none()
            if coupon:
                valid_time = True
                if coupon.valid_from and coupon.valid_to:
                    valid_time = coupon.valid_from <= now <= coupon.valid_to
                valid_usage = (coupon.usage_limit is None or coupon.usage_count < coupon.usage_limit)
                valid_min = total >= float(coupon.min_order_value or 0)
                if valid_time and valid_usage and valid_min:
                    if coupon.discount_type == DiscountType.percentage:
                        discount = total * (float(coupon.value) / 100.0)
                        if coupon.max_discount is not None:
                            discount = min(discount, float(coupon.max_discount))
                        discount_amount = round(discount, 2)
                    elif coupon.discount_type == DiscountType.flat:
                        discount_amount = min(float(coupon.value), total)
                    coupon.usage_count += 1
                    applied_coupon_code = coupon.code

        final_total = max(0.0, round(total - discount_amount, 2))

        order = Order(
            customer_id=profile.id,
            status=OrderStatus.pending,
            total_amount=final_total,
            discount_amount=discount_amount,
            shipping_address=address_snapshot,
            coupon_code=applied_coupon_code,
        )
        self.db.add(order)
        await self.db.flush()

        for oi in order_items:
            oi.order_id = order.id
            self.db.add(oi)

        payment = Payment(
            order_id=order.id,
            status=PaymentStatus.pending,
            amount=final_total,
            method=data.payment_method,
        )
        self.db.add(payment)

        # Clear cart active items
        for item in active_items:
            await self.db.delete(item)

        await self.db.flush()
        logger.info("checkout", order_id=str(order.id), total=final_total, discount=discount_amount)
        return order

    # ── Order Queries ─────────────────────────────────────────────────────────

    async def get_customer_orders(self, user_id: UUID) -> list[Order]:
        profile = await self._get_customer_profile(user_id)
        result = await self.db.execute(
            select(Order)
            .where(Order.customer_id == profile.id)
            .options(selectinload(Order.items), selectinload(Order.payment))
            .order_by(Order.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_order(self, user_id: UUID, order_id: UUID) -> Order:
        profile = await self._get_customer_profile(user_id)
        result = await self.db.execute(
            select(Order)
            .where(Order.id == order_id, Order.customer_id == profile.id)
            .options(selectinload(Order.items), selectinload(Order.payment))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        return order

    async def cancel_order(self, user_id: UUID, order_id: UUID) -> Order:
        order = await self.get_order(user_id, order_id)
        if order.status not in (OrderStatus.pending, OrderStatus.confirmed):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel order in current status.",
            )
        order.status = OrderStatus.cancelled
        return order

    async def update_order_status(self, seller_user_id: UUID, order_id: UUID, data: OrderStatusUpdate) -> Order:
        """Seller updates order status (accept, pack, ship)."""
        result = await self.db.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.items), selectinload(Order.payment))
        )
        order = result.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")
        order.status = data.status
        if data.tracking_number:
            order.tracking_number = data.tracking_number
        if data.logistics_provider:
            order.logistics_provider = data.logistics_provider
        return order

    # ── Profile Helper ────────────────────────────────────────────────────────

    async def _get_customer_profile(self, user_id: UUID) -> CustomerProfile:
        result = await self.db.execute(
            select(CustomerProfile).where(CustomerProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Customer profile not found.",
            )
        return profile
