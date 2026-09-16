"use client";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import SellerSidebar from "@/components/SellerSidebar";
import { SAMPLE_ORDERS, OrderItemRecord, ProductItem } from "@/lib/data";
import { apiRequest, getAccessToken } from "@/lib/api";

function toProductItem(p: any): ProductItem {
  const primaryImg = (p.images && p.images.find((img: any) => img.is_primary)?.url) || (p.images && p.images[0]?.url) || p.image || p.primaryImageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80";
  return {
    id: p.id || "prod-default",
    name: p.name || "Product",
    slug: p.slug || (p.name ? p.name.toLowerCase().replace(/\s+/g, "-") : "product"),
    brand: p.brand || "My Store",
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
    specs: p.specs || { Brand: p.brand || "My Store" },
    sellerName: p.sellerName || "My Store",
    sellerId: p.sellerId || "seller-01",
    sellerRating: Number(p.sellerRating || 4.9),
  };
}

function toOrderItemRecord(o: any): OrderItemRecord {
  const items = Array.isArray(o.items) && o.items.length > 0 ? o.items.map((it: any) => ({
    product: toProductItem(it.product || { name: it.product_name, price: it.unit_price }),
    qty: it.qty || 1,
    unitPrice: Number(it.unit_price || it.price || 0),
    variantLabel: it.variantLabel,
  })) : [{
    product: toProductItem({ name: "Merchant Order Item" }),
    qty: 1,
    unitPrice: Number(o.total_amount || 0),
  }];

  return {
    id: o.id || `ord-${Math.random().toString(36).substring(2, 7)}`,
    orderNumber: o.orderNumber || `VYP-${(o.id || "").substring(0, 8).toUpperCase()}`,
    date: o.date || o.created_at || new Date().toISOString(),
    totalAmount: Number(o.total_amount || o.totalAmount || 0),
    status: (o.status || "pending") as OrderItemRecord["status"],
    trackingNumber: o.tracking_number || o.trackingNumber,
    carrier: o.carrier || "Delhivery Express",
    estimatedDelivery: o.estimatedDelivery || "Standard Delivery",
    items,
    shippingAddress: {
      fullName: o.shipping_address?.full_name || o.shippingAddress?.fullName || "Aditya Sharma",
      phone: o.shipping_address?.phone || o.shippingAddress?.phone || "+91 98765 43210",
      line1: o.shipping_address?.line1 || o.shippingAddress?.line1 || "MG Road",
      city: o.shipping_address?.city || o.shippingAddress?.city || "Bengaluru",
      state: o.shipping_address?.state || o.shippingAddress?.state || "Karnataka",
      pincode: o.shipping_address?.pincode || o.shippingAddress?.pincode || "560001",
    },
    payment: {
      method: o.payment?.method || "UPI",
      transactionId: o.payment?.gateway_ref || o.payment?.transactionId || "TXN_LIVE_001",
      status: o.payment?.status || "captured",
    },
  };
}

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<OrderItemRecord[]>(SAMPLE_ORDERS);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    async function loadSellerOrders() {
      const token = getAccessToken();
      if (!token) return;
      try {
        const liveOrders = await apiRequest<any[]>("/api/v1/seller/orders");
        if (Array.isArray(liveOrders) && liveOrders.length > 0) {
          const mapped: OrderItemRecord[] = liveOrders.map(toOrderItemRecord);
          setOrders(mapped);
        }
      } catch (err) {
        console.warn("Could not load backend seller orders, using sample data:", err);
      }
    }
    loadSellerOrders();
  }, []);

  async function handleStatusUpdate(orderId: string, newStatus: OrderItemRecord["status"]) {
    const token = getAccessToken();
    if (token) {
      try {
        await apiRequest(`/api/v1/seller/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });
      } catch (err) {
        console.warn("Live order status update note:", err);
      }
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  }

  const filtered = orders.filter((o) => {
    if (selectedStatus === "all") return true;
    return o.status === selectedStatus;
  });

  return (
    <div style={{ display: "flex", minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      <SellerSidebar />

      <main style={{ flex: 1, padding: "var(--space-xxl)", overflowY: "auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "var(--space-xxl)",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
              Order Fulfillment
            </h1>
            <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
              Track shipments, generate manifests, and update delivery milestones
            </p>
          </div>

          {/* Status Filter Tabs */}
          <div
            style={{
              display: "flex",
              backgroundColor: "var(--color-canvas-light)",
              padding: "4px",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--color-hairline-light)",
            }}
          >
            {["all", "pending", "processing", "shipped", "delivered"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className="btn btn-sm"
                style={{
                  borderRadius: "var(--radius-pill)",
                  textTransform: "capitalize",
                  backgroundColor: selectedStatus === st ? "var(--color-ink)" : "transparent",
                  color: selectedStatus === st ? "var(--color-on-primary)" : "var(--color-shade-60)",
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
          {filtered.map((order) => (
            <div
              key={order.id}
              style={{
                backgroundColor: "var(--color-canvas-light)",
                border: "1px solid var(--color-hairline-light)",
                borderRadius: "var(--radius-xl)",
                overflow: "hidden",
                boxShadow: "var(--shadow-1)",
              }}
            >
              {/* Order Header */}
              <div
                style={{
                  padding: "16px 24px",
                  backgroundColor: "var(--color-canvas-cream)",
                  borderBottom: "1px solid var(--color-hairline-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", gap: "24px" }}>
                  <div>
                    <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                      ORDER NUMBER
                    </span>
                    <p style={{ fontSize: "14px", fontWeight: 700, margin: "2px 0 0" }}>
                      {order.orderNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                      DATE
                    </span>
                    <p style={{ fontSize: "14px", color: "var(--color-shade-60)", margin: "2px 0 0" }}>
                      {new Date(order.date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                      PAYMENT
                    </span>
                    <p style={{ fontSize: "14px", color: "#16a34a", fontWeight: 600, margin: "2px 0 0" }}>
                      &#8377;{order.totalAmount.toLocaleString("en-IN")} (Captured)
                    </p>
                  </div>
                </div>

                {/* Status Switcher Dropdown */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label htmlFor={`status-${order.id}`} className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                    Update Status:
                  </label>
                  <select
                    id={`status-${order.id}`}
                    value={order.status}
                    onChange={(e) =>
                      handleStatusUpdate(order.id, e.target.value as OrderItemRecord["status"])
                    }
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-hairline-light)",
                      backgroundColor: "var(--color-canvas-light)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    <option value="pending">Pending Acceptance</option>
                    <option value="processing">Packed &amp; Ready to Ship</option>
                    <option value="shipped">Dispatched / In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Order Body: Products + Delivery Info */}
              <div
                style={{
                  padding: "24px",
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr",
                  gap: "24px",
                }}
              >
                {/* Product Items */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <img
                        src={item.product.primaryImageUrl}
                        alt={item.product.name}
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "var(--radius-md)",
                          objectFit: "cover",
                          backgroundColor: "var(--color-canvas-cream)",
                        }}
                      />
                      <div>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                          {item.product.name}
                        </p>
                        {item.variantLabel && (
                          <p className="text-caption" style={{ color: "var(--color-shade-50)", margin: "2px 0 0" }}>
                            {item.variantLabel}
                          </p>
                        )}
                        <p className="text-caption" style={{ color: "var(--color-shade-60)", margin: "2px 0 0" }}>
                          Qty: {item.qty} &bull; &#8377;{item.unitPrice.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shipping Details */}
                <div
                  style={{
                    backgroundColor: "var(--color-canvas-cream)",
                    padding: "16px",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--color-hairline-light)",
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <MapPin size={15} color="var(--color-shade-60)" />
                    <span style={{ fontWeight: 600 }}>Delivery Destination</span>
                  </div>
                  <p style={{ fontWeight: 600, color: "var(--color-ink)", margin: "0 0 4px" }}>
                    {order.shippingAddress.fullName} ({order.shippingAddress.phone})
                  </p>
                  <p style={{ color: "var(--color-shade-60)", margin: 0, lineHeight: 1.5 }}>
                    {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}
                  </p>

                  {order.trackingNumber && (
                    <div style={{ marginTop: "12px", paddingTop: "8px", borderTop: "1px solid var(--color-hairline-light)" }}>
                      <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                        Carrier: {order.carrier} &bull; Tracking #{order.trackingNumber}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
