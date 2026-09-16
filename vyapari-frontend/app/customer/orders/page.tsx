"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SAMPLE_ORDERS, OrderItemRecord, ProductItem } from "@/lib/data";
import { apiRequest, getAccessToken } from "@/lib/api";

const STEPS = [
  { key: "confirmed", label: "Order Placed" },
  { key: "processing", label: "Packed & Verified" },
  { key: "shipped", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
];

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

function toOrderItemRecord(o: any): OrderItemRecord {
  const items = Array.isArray(o.items) && o.items.length > 0 ? o.items.map((it: any) => ({
    product: toProductItem(it.product || { name: it.product_name, price: it.unit_price }),
    qty: it.qty || 1,
    unitPrice: Number(it.unit_price || it.price || 0),
    variantLabel: it.variantLabel,
  })) : [{
    product: toProductItem({ name: "Marketplace Package" }),
    qty: 1,
    unitPrice: Number(o.total_amount || 0),
  }];

  return {
    id: o.id || `ord-${Math.random().toString(36).substring(2, 7)}`,
    orderNumber: o.orderNumber || `VYP-${(o.id || "").substring(0, 8).toUpperCase()}`,
    date: o.date || o.created_at || new Date().toISOString(),
    totalAmount: Number(o.total_amount || o.totalAmount || 0),
    status: (o.status || "confirmed") as OrderItemRecord["status"],
    trackingNumber: o.tracking_number || o.trackingNumber,
    carrier: o.carrier || "Delhivery Express",
    estimatedDelivery: o.estimatedDelivery || "3-5 Business Days",
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

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<OrderItemRecord[]>(SAMPLE_ORDERS);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    async function loadCustomerOrders() {
      const token = getAccessToken();
      if (!token) return;
      try {
        const liveOrders = await apiRequest<any[]>("/api/v1/customer/orders");
        if (Array.isArray(liveOrders) && liveOrders.length > 0) {
          const mapped: OrderItemRecord[] = liveOrders.map(toOrderItemRecord);
          setOrders(mapped);
        }
      } catch (err) {
        console.warn("Could not load backend orders, using sample data:", err);
      }
    }
    loadCustomerOrders();
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (activeTab === "active") return o.status === "processing" || o.status === "shipped" || o.status === "pending";
    if (activeTab === "completed") return o.status === "delivered" || o.status === "cancelled";
    return true;
  });

  return (
    <div className="canvas-light" style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      <Navbar variant="light" />

      <main style={{ flex: 1, paddingBlock: "var(--space-xxl)" }}>
        <div className="container container-wide">
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: "var(--space-xl)",
              flexWrap: "wrap",
              gap: "var(--space-md)",
            }}
          >
            <div>
              <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
                My Orders &amp; Deliveries
              </h1>
              <p className="text-body-md" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
                Track active shipments and review past orders
              </p>
            </div>

            {/* Filter Tabs */}
            <div
              style={{
                display: "flex",
                backgroundColor: "var(--color-canvas-cream)",
                padding: "4px",
                borderRadius: "var(--radius-pill)",
                border: "1px solid var(--color-hairline-light)",
              }}
            >
              {(["all", "active", "completed"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="btn btn-sm"
                  style={{
                    borderRadius: "var(--radius-pill)",
                    textTransform: "capitalize",
                    backgroundColor: activeTab === tab ? "var(--color-ink)" : "transparent",
                    color: activeTab === tab ? "var(--color-on-primary)" : "var(--color-shade-60)",
                  }}
                >
                  {tab === "all" ? "All Orders" : tab === "active" ? "In Transit" : "Delivered"}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "var(--space-huge)",
                backgroundColor: "var(--color-canvas-light)",
                border: "1px dashed var(--color-hairline-light)",
                borderRadius: "var(--radius-xl)",
              }}
            >
              <Package size={48} color="var(--color-shade-40)" style={{ margin: "0 auto 12px" }} />
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                No orders found
              </h2>
              <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
                You have no orders under the selected tab.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
              {filteredOrders.map((order) => (
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
                  {/* Order Top Bar */}
                  <div
                    style={{
                      padding: "var(--space-lg) var(--space-xl)",
                      backgroundColor: "var(--color-canvas-cream)",
                      borderBottom: "1px solid var(--color-hairline-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "var(--space-md)",
                    }}
                  >
                    <div style={{ display: "flex", gap: "var(--space-xl)", flexWrap: "wrap" }}>
                      <div>
                        <p className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                          Order ID
                        </p>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                          {order.orderNumber}
                        </p>
                      </div>

                      <div>
                        <p className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                          Date Placed
                        </p>
                        <p style={{ fontSize: "14px", color: "var(--color-shade-60)", margin: 0 }}>
                          {new Date(order.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>

                      <div>
                        <p className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                          Total Amount
                        </p>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                          &#8377;{order.totalAmount.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        className="pill-tag"
                        style={{
                          backgroundColor:
                            order.status === "delivered"
                              ? "#f0fdf4"
                              : order.status === "shipped"
                              ? "#eff6ff"
                              : "var(--color-pistachio-10)",
                          color:
                            order.status === "delivered"
                              ? "#16a34a"
                              : order.status === "shipped"
                              ? "#2563eb"
                              : "var(--color-ink)",
                          fontSize: "12px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          padding: "4px 10px",
                        }}
                      >
                        {order.status}
                      </span>

                      <button
                        type="button"
                        onClick={() => alert(`Downloading official Tax Invoice for ${order.orderNumber}`)}
                        className="btn btn-outline-light btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <Download size={14} />
                        <span>Invoice</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery Progress Bar (for in-transit and delivered orders) */}
                  <div
                    style={{
                      padding: "var(--space-xl)",
                      borderBottom: "1px solid var(--color-hairline-light)",
                      backgroundColor: "var(--color-canvas-light)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <div>
                        <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                          {order.status === "delivered"
                            ? "Delivered successfully"
                            : `Estimated Delivery by ${order.estimatedDelivery}`}
                        </p>
                        {order.trackingNumber && (
                          <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                            Carrier: {order.carrier} &bull; AWB Tracking #{order.trackingNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Step Timeline */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        position: "relative",
                        gap: "8px",
                      }}
                    >
                      {STEPS.map((step, idx) => {
                        const isDone =
                          order.status === "delivered" ||
                          (order.status === "shipped" && idx <= 2) ||
                          (order.status === "processing" && idx <= 1) ||
                          idx === 0;

                        return (
                          <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                backgroundColor: isDone ? "var(--color-ink)" : "var(--color-hairline-light)",
                                color: isDone ? "var(--color-on-primary)" : "var(--color-shade-40)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 700,
                                marginBottom: "6px",
                              }}
                            >
                              {isDone ? <CheckCircle2 size={16} /> : idx + 1}
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                fontWeight: isDone ? 600 : 400,
                                color: isDone ? "var(--color-ink)" : "var(--color-shade-40)",
                              }}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Items in Order */}
                  <div style={{ padding: "var(--space-xl)", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-lg)",
                        }}
                      >
                        <div
                          style={{
                            width: "72px",
                            height: "72px",
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
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                            {item.product.name}
                          </p>
                          {item.variantLabel && (
                            <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                              {item.variantLabel}
                            </p>
                          )}
                          <p className="text-caption" style={{ color: "var(--color-shade-60)", marginTop: "2px" }}>
                            Qty: {item.qty} &bull; &#8377;{item.unitPrice.toLocaleString("en-IN")} each
                          </p>
                        </div>
                        <Link
                          href={`/customer/products/${item.product.id}`}
                          className="btn btn-outline-light btn-sm"
                        >
                          Buy Again
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer variant="light" />
    </div>
  );
}
