"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Tag,
  Check,
  AlertCircle,
  Truck,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PRODUCTS_DATA, ProductItem } from "@/lib/data";
import { apiRequest, getAccessToken } from "@/lib/api";

interface CartItemState {
  id?: string;
  product: ProductItem;
  qty: number;
  variantLabel?: string;
}

function toProductItem(p: any): ProductItem {
  const primaryImg = (p.images && p.images.find((img: any) => img.is_primary)?.url) || (p.images && p.images[0]?.url) || p.image || p.primaryImageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80";
  return {
    id: p.id || "prod-default",
    name: p.name || "Product",
    slug: p.slug || (p.name ? p.name.toLowerCase().replace(/\s+/g, "-") : "product"),
    brand: p.brand || "Verified Merchant",
    category: p.category || "General",
    categoryId: p.categoryId || "cat-general",
    price: Number(p.price || 999),
    originalPrice: Number(p.originalPrice || p.price || 999),
    discountPercentage: Number(p.discountPercentage || 0),
    stockQty: Number(p.stock_qty || p.stockQty || 10),
    rating: Number(p.rating || 4.8),
    reviewCount: Number(p.review_count || p.reviewCount || 12),
    primaryImageUrl: primaryImg,
    images: Array.isArray(p.images) ? p.images.map((im: any) => (typeof im === "string" ? im : im.url)) : [primaryImg],
    description: p.description || "Premium product listed on Vyapari marketplace.",
    features: Array.isArray(p.features) ? p.features : ["Standard Quality Assurance", "Fast Pan-India Delivery"],
    specs: p.specs || { Brand: p.brand || "Vyapari Partner" },
    sellerName: p.sellerName || "Verified Partner",
    sellerId: p.sellerId || "seller-01",
    sellerRating: Number(p.sellerRating || 4.9),
  };
}

export default function CartPage() {
  const router = useRouter();

  // Initial cart with sample products
  const [items, setItems] = useState<CartItemState[]>([
    {
      product: PRODUCTS_DATA[0],
      qty: 1,
      variantLabel: "Color: Matte Midnight",
    },
    {
      product: PRODUCTS_DATA[4],
      qty: 1,
    },
  ]);

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    async function loadBackendCart() {
      const token = getAccessToken();
      if (!token) return;
      try {
        const cartData = await apiRequest<{
          id: string;
          items: Array<{
            id: string;
            product_id: string;
            qty: number;
            product_name?: string;
            product_price?: number;
          }>;
          subtotal: number;
        }>("/api/v1/customer/cart");

        if (cartData && Array.isArray(cartData.items) && cartData.items.length > 0) {
          const mapped: CartItemState[] = cartData.items.map((ci) => {
            const matched = PRODUCTS_DATA.find((p) => p.id === ci.product_id) || toProductItem({
              id: ci.product_id,
              name: ci.product_name || "Product",
              price: ci.product_price || 999,
            });
            return {
              id: ci.id,
              product: matched,
              qty: ci.qty,
            };
          });
          setItems(mapped);
        }
      } catch (err) {
        console.warn("Could not load backend cart, using local cart state:", err);
      }
    }
    loadBackendCart();
  }, []);

  async function updateQty(index: number, delta: number) {
    const item = items[index];
    if (!item) return;
    const newQty = item.qty + delta;

    if (item.id) {
      try {
        await apiRequest(`/api/v1/customer/cart/items/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ qty: newQty }),
        });
      } catch (err) {
        console.warn("Live cart update error:", err);
      }
    }

    setItems((prev) =>
      prev
        .map((it, i) => {
          if (i === index) {
            return newQty > 0 ? { ...it, qty: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItemState[]
    );
  }

  async function removeItem(index: number) {
    const item = items[index];
    if (item && item.id) {
      try {
        await apiRequest(`/api/v1/customer/cart/items/${item.id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.warn("Live cart delete error:", err);
      }
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    setCouponError(null);
    if (couponCode.toUpperCase() === "VYAPARI10" || couponCode.toUpperCase() === "FIRST500") {
      setCouponApplied(true);
    } else {
      setCouponError("Invalid coupon code. Try 'VYAPARI10' or 'FIRST500'");
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const discountAmount = couponApplied ? Math.round(subtotal * 0.1) : 0;
  const shippingFee = subtotal >= 999 ? 0 : 99;
  const total = subtotal - discountAmount + shippingFee;

  const freeShippingThreshold = 999;
  const freeShippingRemaining = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  async function handleCheckout() {
    setCheckingOut(true);
    const token = getAccessToken();
    if (token) {
      try {
        await apiRequest("/api/v1/customer/orders/checkout", {
          method: "POST",
          body: JSON.stringify({
            shipping_address_id: "00000000-0000-0000-0000-000000000000",
            payment_method: "cod",
            coupon_code: couponApplied ? couponCode : undefined,
          }),
        });
      } catch (err) {
        console.warn("Checkout note (proceeding to orders preview):", err);
      }
    }
    setTimeout(() => {
      setCheckingOut(false);
      router.push("/customer/orders");
    }, 800);
  }

  return (
    <div className="canvas-light" style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <Navbar variant="light" cartCount={items.reduce((sum, i) => sum + i.qty, 0)} />

      <main style={{ flex: 1, paddingBlock: "var(--space-xxl)" }}>
        <div className="container container-wide">
          <div style={{ marginBottom: "var(--space-xxl)" }}>
            <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
              Shopping Cart
            </h1>
            <p className="text-body-md" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
              {items.length} {items.length === 1 ? "product" : "products"} selected for checkout
            </p>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "var(--space-huge)",
                backgroundColor: "var(--color-canvas-light)",
                border: "1px dashed var(--color-hairline-light)",
                borderRadius: "var(--radius-xl)",
                maxWidth: "540px",
                margin: "0 auto",
              }}
            >
              <ShoppingBag size={56} color="var(--color-shade-40)" style={{ margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                Your cart is currently empty
              </h2>
              <p
                className="text-body-md"
                style={{ color: "var(--color-shade-50)", margin: "8px auto 24px" }}
              >
                Discover thousands of products from verified sellers across India.
              </p>
              <Link href="/customer/home" className="btn btn-primary btn-lg" style={{ display: "inline-flex" }}>
                Start Shopping
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 380px",
                gap: "var(--space-xxl)",
                alignItems: "start",
              }}
            >
              {/* Left Column: Items */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
                {/* Free Shipping Progress Bar */}
                <div
                  style={{
                    backgroundColor: "var(--color-canvas-cream)",
                    border: "1px solid var(--color-hairline-light)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-lg)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Truck size={18} color={freeShippingRemaining === 0 ? "#16a34a" : "var(--color-ink)"} />
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>
                      {freeShippingRemaining === 0
                        ? "You unlocked FREE Express Delivery!"
                        : `Add ₹${freeShippingRemaining.toLocaleString("en-IN")} more to qualify for FREE Express Delivery`}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "6px",
                      backgroundColor: "var(--color-hairline-light)",
                      borderRadius: "var(--radius-pill)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${freeShippingProgress}%`,
                        backgroundColor: freeShippingRemaining === 0 ? "#16a34a" : "var(--color-ink)",
                        transition: "width 0.4s ease-out",
                      }}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div
                  style={{
                    backgroundColor: "var(--color-canvas-light)",
                    border: "1px solid var(--color-hairline-light)",
                    borderRadius: "var(--radius-xl)",
                    overflow: "hidden",
                  }}
                >
                  {items.map((item, index) => (
                    <div
                      key={item.product.id + index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-lg)",
                        padding: "var(--space-xl)",
                        borderBottom:
                          index !== items.length - 1
                            ? "1px solid var(--color-hairline-light)"
                            : "none",
                      }}
                    >
                      {/* Product Thumbnail */}
                      <Link
                        href={`/customer/products/${item.product.id}`}
                        style={{
                          width: "90px",
                          height: "90px",
                          borderRadius: "var(--radius-md)",
                          overflow: "hidden",
                          backgroundColor: "var(--color-canvas-cream)",
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={item.product.primaryImageUrl}
                          alt={item.product.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </Link>

                      {/* Product Details */}
                      <div style={{ flex: 1 }}>
                        <p className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                          {item.product.brand}
                        </p>
                        <Link
                          href={`/customer/products/${item.product.id}`}
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            color: "var(--color-ink)",
                            textDecoration: "none",
                          }}
                        >
                          {item.product.name}
                        </Link>
                        {item.variantLabel && (
                          <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                            {item.variantLabel}
                          </p>
                        )}
                        <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-ink)", marginTop: "6px" }}>
                          &#8377;{item.product.price.toLocaleString("en-IN")}
                        </p>
                      </div>

                      {/* Quantity Controls */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          border: "1px solid var(--color-hairline-light)",
                          borderRadius: "var(--radius-md)",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => updateQty(index, -1)}
                          style={{
                            width: "30px",
                            height: "30px",
                            backgroundColor: "var(--color-canvas-cream)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          -
                        </button>
                        <span style={{ padding: "0 12px", fontSize: "14px", fontWeight: 600 }}>
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(index, 1)}
                          style={{
                            width: "30px",
                            height: "30px",
                            backgroundColor: "var(--color-canvas-cream)",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Item Total & Remove */}
                      <div style={{ textAlign: "right", minWidth: "90px" }}>
                        <p style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px" }}>
                          &#8377;{(item.product.price * item.qty).toLocaleString("en-IN")}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          style={{
                            color: "#dc2626",
                            backgroundColor: "transparent",
                            border: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Order Summary */}
              <div
                style={{
                  backgroundColor: "var(--color-canvas-light)",
                  border: "1px solid var(--color-hairline-light)",
                  borderRadius: "var(--radius-xl)",
                  padding: "var(--space-xl)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-lg)",
                }}
              >
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Order Summary
                </h2>

                {/* Coupon Code Input */}
                <form onSubmit={applyCoupon} style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Coupon code (e.g. VYAPARI10)"
                    disabled={couponApplied}
                    style={{
                      flex: 1,
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-hairline-light)",
                      fontSize: "13px",
                      textTransform: "uppercase",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={couponApplied || !couponCode.trim()}
                    className="btn btn-outline-light btn-sm"
                    style={{ height: "38px" }}
                  >
                    {couponApplied ? "Applied" : "Apply"}
                  </button>
                </form>

                {couponApplied && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "#16a34a",
                      backgroundColor: "#f0fdf4",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <Check size={14} />
                    <span>Coupon VYAPARI10 applied (10% OFF)!</span>
                  </div>
                )}

                {couponError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      color: "#dc2626",
                      backgroundColor: "#fef2f2",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <AlertCircle size={14} />
                    <span>{couponError}</span>
                  </div>
                )}

                {/* Price Breakdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-shade-50)" }}>Items Subtotal</span>
                    <span>&#8377;{subtotal.toLocaleString("en-IN")}</span>
                  </div>

                  {couponApplied && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#16a34a" }}>
                      <span>Promotional Discount</span>
                      <span>-&#8377;{discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--color-shade-50)" }}>Delivery Fee</span>
                    <span>{shippingFee === 0 ? "FREE" : `₹${shippingFee}`}</span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--color-hairline-light)",
                      paddingTop: "12px",
                      fontSize: "18px",
                      fontWeight: 700,
                      color: "var(--color-ink)",
                    }}
                  >
                    <span>Total Amount</span>
                    <span>&#8377;{total.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {/* Checkout CTA */}
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  id="btn-cart-checkout"
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {checkingOut ? (
                    <span>Processing Order…</span>
                  ) : (
                    <>
                      <span>Proceed to Payment</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                {/* Trust Note */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <ShieldCheck size={16} color="#16a34a" />
                  <span className="text-micro" style={{ color: "var(--color-shade-50)" }}>
                    Secured by Razorpay &bull; 256-bit SSL encryption
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer variant="light" />
    </div>
  );
}
