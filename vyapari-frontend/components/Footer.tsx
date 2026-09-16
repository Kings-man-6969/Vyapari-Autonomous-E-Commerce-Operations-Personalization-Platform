"use client";

import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";


interface FooterProps {
  variant?: "dark" | "light";
}

export default function Footer({ variant = "dark" }: FooterProps) {
  const isDark = variant === "dark";

  return (
    <footer
      className={`footer ${isDark ? "footer-dark canvas-night" : "footer-light canvas-light"}`}
      role="contentinfo"
      style={{
        borderTop: isDark
          ? "1px solid var(--color-hairline-dark)"
          : "1px solid var(--color-hairline-light)",
        paddingTop: "var(--space-huge)",
        paddingBottom: "var(--space-xxl)",
      }}
    >
      <div className="container container-wide">
        {/* Trust Badges Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--space-xl)",
            paddingBottom: "var(--space-huge)",
            borderBottom: isDark
              ? "1px solid var(--color-hairline-dark)"
              : "1px solid var(--color-hairline-light)",
            marginBottom: "var(--space-huge)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isDark ? "var(--color-surface-elevated-dark)" : "var(--color-aloe-10)",
                color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Truck size={22} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-body-strong" style={{ fontSize: "15px" }}>
                Express Logistics
              </p>
              <p className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                Fast delivery across 24,000+ Indian pincodes
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isDark ? "var(--color-surface-elevated-dark)" : "var(--color-aloe-10)",
                color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-body-strong" style={{ fontSize: "15px" }}>
                Verified Marketplace
              </p>
              <p className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                100% KYC-verified sellers &amp; genuine products
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isDark ? "var(--color-surface-elevated-dark)" : "var(--color-aloe-10)",
                color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <RotateCcw size={22} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-body-strong" style={{ fontSize: "15px" }}>
                Hassle-Free Returns
              </p>
              <p className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                7-day doorstep replacement guarantee
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isDark ? "var(--color-surface-elevated-dark)" : "var(--color-aloe-10)",
                color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Headphones size={22} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-body-strong" style={{ fontSize: "15px" }}>
                24/7 Dedicated Support
              </p>
              <p className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                Human assistance whenever you need it
              </p>
            </div>
          </div>
        </div>

        {/* Link Columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr",
            gap: "var(--space-xxl)",
            marginBottom: "var(--space-huge)",
          }}
        >
          {/* Brand Info */}
          <div>
            <span
              className="navbar-logo"
              style={{
                fontSize: "24px",
                display: "inline-block",
                marginBottom: "var(--space-md)",
                color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
              }}
            >
              Vyapari
            </span>
            <p
              className="text-caption"
              style={{
                color: "var(--color-shade-50)",
                lineHeight: "1.6",
                maxWidth: "280px",
                marginBottom: "var(--space-lg)",
              }}
            >
              Autonomous e-commerce operations &amp; personalization platform. Powering
              seamless retail experiences for Indian buyers and growing merchants.
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span className="pill-tag pill-tag-shade" style={{ fontSize: "11px" }}>
                Razorpay INR
              </span>
              <span className="pill-tag pill-tag-shade" style={{ fontSize: "11px" }}>
                GST Compliant
              </span>
              <span className="pill-tag pill-tag-shade" style={{ fontSize: "11px" }}>
                pgvector AI
              </span>
            </div>
          </div>

          {/* Customer Links */}
          <div className="footer-links">
            <p
              className="text-eyebrow"
              style={{
                color: isDark ? "var(--color-shade-40)" : "var(--color-shade-60)",
                marginBottom: "var(--space-lg)",
              }}
            >
              Shop &amp; Discover
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link href="/customer/home">Consumer Electronics</Link>
              <Link href="/customer/home">Apparel &amp; Fashion</Link>
              <Link href="/customer/home">Home &amp; Living</Link>
              <Link href="/customer/home">Audio &amp; Wearables</Link>
              <Link href="/customer/orders">Track Your Order</Link>
            </div>
          </div>

          {/* Seller Links */}
          <div className="footer-links">
            <p
              className="text-eyebrow"
              style={{
                color: isDark ? "var(--color-shade-40)" : "var(--color-shade-60)",
                marginBottom: "var(--space-lg)",
              }}
            >
              For Sellers
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link href="/seller/signup">Become a Verified Seller</Link>
              <Link href="/seller/dashboard">Seller Dashboard</Link>
              <Link href="/seller/products/new">List New Product</Link>
              <Link href="/seller/kyc">KYC Guidelines</Link>
              <Link href="/seller/payouts">Payout Schedule</Link>
            </div>
          </div>

          {/* Platform & Governance */}
          <div className="footer-links">
            <p
              className="text-eyebrow"
              style={{
                color: isDark ? "var(--color-shade-40)" : "var(--color-shade-60)",
                marginBottom: "var(--space-lg)",
              }}
            >
              Platform
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link href="/admin/dashboard">Admin Queue</Link>
              <Link href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">
                REST API Docs
              </Link>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
          </div>

          {/* Newsletter Box */}
          <div>
            <p
              className="text-eyebrow"
              style={{
                color: isDark ? "var(--color-shade-40)" : "var(--color-shade-60)",
                marginBottom: "var(--space-md)",
              }}
            >
              Stay Updated
            </p>
            <p
              className="text-caption"
              style={{ color: "var(--color-shade-50)", marginBottom: "var(--space-md)", lineHeight: 1.5 }}
            >
              Get weekly insights on trending products and merchant features.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert("Thank you for subscribing to Vyapari updates!");
              }}
              style={{ display: "flex", gap: "6px" }}
            >
              <input
                type="email"
                required
                placeholder="Enter work email"
                style={{
                  flex: 1,
                  height: "36px",
                  padding: "0 12px",
                  borderRadius: "var(--radius-pill)",
                  border: isDark
                    ? "1px solid var(--color-hairline-dark)"
                    : "1px solid var(--color-hairline-light)",
                  backgroundColor: isDark
                    ? "var(--color-canvas-night-elevated)"
                    : "var(--color-canvas-light)",
                  color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-md)",
            paddingTop: "var(--space-xl)",
            borderTop: isDark
              ? "1px solid var(--color-hairline-dark)"
              : "1px solid var(--color-hairline-light)",
          }}
        >
          <p className="text-micro" style={{ color: "var(--color-shade-50)" }}>
            &copy; {new Date().getFullYear()} Vyapari Technologies Pvt. Ltd. All rights reserved. Built for Bharat.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
            <span className="text-micro" style={{ color: "var(--color-shade-50)" }}>
              Supported Payments: UPI &bull; RuPay &bull; Visa &bull; Mastercard &bull; NetBanking
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
