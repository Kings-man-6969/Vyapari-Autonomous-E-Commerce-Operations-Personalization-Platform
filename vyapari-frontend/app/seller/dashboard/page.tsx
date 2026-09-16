"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Package,
  ShoppingBag,
  CreditCard,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import SellerSidebar from "@/components/SellerSidebar";
import { apiRequest, getAccessToken } from "@/lib/api";
import { PRODUCTS_DATA, SAMPLE_ORDERS } from "@/lib/data";

interface AnalyticsData {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  active_listings: number;
}

export default function SellerDashboardPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    total_revenue: 184500,
    total_orders: 48,
    avg_order_value: 3843,
    active_listings: 12,
  });
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      const token = getAccessToken();
      if (!token) {
        setIsDemoMode(true);
        return;
      }
      try {
        const rev = await apiRequest<{
          total_revenue: number;
          total_orders: number;
          avg_order_value: number;
        }>("/api/v1/seller/analytics/revenue?days=30");

        if (rev) {
          setAnalytics((prev) => ({
            ...prev,
            total_revenue: rev.total_revenue || prev.total_revenue,
            total_orders: rev.total_orders || prev.total_orders,
            avg_order_value: rev.avg_order_value || prev.avg_order_value,
          }));
        }
      } catch {
        setIsDemoMode(true);
      }
    }
    fetchAnalytics();
  }, []);

  return (
    <div style={{ display: "flex", minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      {/* Persistent Sidebar */}
      <SellerSidebar />

      {/* Main Dashboard Panel */}
      <main style={{ flex: 1, padding: "var(--space-xxl)", overflowY: "auto" }}>
        {/* Demo Mode Notice Banner if unauthenticated */}
        {isDemoMode && (
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-lg)",
              padding: "12px 18px",
              marginBottom: "var(--space-xl)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
              <span className="pill-tag pill-tag-mint" style={{ fontSize: "11px" }}>
                Preview Mode
              </span>
              <span style={{ color: "var(--color-shade-60)" }}>
                Viewing interactive Merchant Dashboard preview. Sign in to link your store.
              </span>
            </div>
            <Link href="/seller/login" className="btn btn-primary btn-sm">
              Sign In
            </Link>
          </div>
        )}

        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "var(--space-xxl)",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <span className="pill-tag pill-tag-shade" style={{ marginBottom: "6px", display: "inline-flex" }}>
              Sharma Electronics &bull; GSTIN Verified
            </span>
            <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
              Store Overview
            </h1>
            <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
              Performance summary for the last 30 days
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              href="/seller/products/new"
              id="btn-seller-add-product"
              className="btn btn-primary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Plus size={16} />
              <span>Add Product</span>
            </Link>
          </div>
        </div>

        {/* KYC Verification Status Banner */}
        <div
          style={{
            backgroundColor: "var(--color-canvas-light)",
            border: "1px solid var(--color-hairline-light)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-xxl)",
            gap: "var(--space-lg)",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "#f0fdf4",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Merchant KYC Status: Approved
                </h3>
                <span
                  className="pill-tag"
                  style={{ backgroundColor: "#f0fdf4", color: "#16a34a", fontSize: "11px", fontWeight: 600 }}
                >
                  Verified
                </span>
              </div>
              <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                Your business entity and bank account (HDFC Bank &bull;&bull;&bull;&bull; 8821) are fully validated.
              </p>
            </div>
          </div>

          <Link href="/seller/kyc" className="btn btn-outline-light btn-sm">
            View KYC Details
          </Link>
        </div>

        {/* 4 Metric Cards Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-lg)",
            marginBottom: "var(--space-xxl)",
          }}
        >
          {/* Revenue */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                Total Revenue
              </span>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-aloe-10)",
                  color: "var(--color-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TrendingUp size={16} />
              </div>
            </div>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              &#8377;{analytics.total_revenue.toLocaleString("en-IN")}
            </p>
            <span className="text-caption" style={{ color: "#16a34a", fontWeight: 600 }}>
              +14.2% vs last month
            </span>
          </div>

          {/* Orders */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                Orders Received
              </span>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-canvas-cream)",
                  color: "var(--color-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShoppingBag size={16} />
              </div>
            </div>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              {analytics.total_orders}
            </p>
            <span className="text-caption" style={{ color: "#16a34a", fontWeight: 600 }}>
              +8.5% fulfillment rate
            </span>
          </div>

          {/* Average Order Value */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                Avg Order Value
              </span>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-canvas-cream)",
                  color: "var(--color-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CreditCard size={16} />
              </div>
            </div>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              &#8377;{analytics.avg_order_value.toLocaleString("en-IN")}
            </p>
            <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
              Across all categories
            </span>
          </div>

          {/* Active Listings */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
                Active Listings
              </span>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-canvas-cream)",
                  color: "var(--color-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Package size={16} />
              </div>
            </div>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              {analytics.active_listings}
            </p>
            <span className="text-caption" style={{ color: "#16a34a", fontWeight: 600 }}>
              All in healthy stock
            </span>
          </div>
        </div>

        {/* Section: Pending Order Queue & Top Products */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr",
            gap: "var(--space-xl)",
            alignItems: "start",
          }}
        >
          {/* Recent Orders Queue */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-lg)",
              }}
            >
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Recent Orders
                </h2>
                <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                  Orders requiring dispatch or verification
                </p>
              </div>
              <Link href="/seller/orders" className="btn btn-outline-light btn-sm">
                View All Orders
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {SAMPLE_ORDERS.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: "var(--color-canvas-cream)",
                    border: "1px solid var(--color-hairline-light)",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                      {ord.orderNumber}
                    </p>
                    <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                      {ord.items[0]?.product?.name} &bull; Qty: {ord.items[0]?.qty}
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                      &#8377;{ord.totalAmount.toLocaleString("en-IN")}
                    </p>
                    <span
                      className="pill-tag"
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        backgroundColor: ord.status === "delivered" ? "#f0fdf4" : "#eff6ff",
                        color: ord.status === "delivered" ? "#16a34a" : "#2563eb",
                        textTransform: "capitalize",
                        marginTop: "2px",
                      }}
                    >
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Selling Products */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-lg)",
              }}
            >
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                Top Performers
              </h2>
              <Link href="/seller/products" className="btn btn-outline-light btn-sm">
                Manage
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {PRODUCTS_DATA.slice(0, 3).map((prod) => (
                <div
                  key={prod.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <img
                    src={prod.primaryImageUrl}
                    alt={prod.name}
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "var(--radius-md)",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--color-ink)",
                        margin: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {prod.name}
                    </p>
                    <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "2px" }}>
                      &#8377;{prod.price.toLocaleString("en-IN")} &bull; Stock: {prod.stockQty}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
