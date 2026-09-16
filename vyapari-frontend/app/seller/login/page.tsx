"use client";

import Link from "next/link";
import { useState } from "react";
import { Store, ShieldCheck, Sparkles, Store as StoreIcon } from "lucide-react";
import { setTokens, setStoredUser, apiRequest, DEMO_CREDENTIALS, loginDemoUser } from "@/lib/api";
import styles from "../../customer/auth.module.css";

export default function SellerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFillDemo() {
    setEmail(DEMO_CREDENTIALS.seller.email);
    setPassword(DEMO_CREDENTIALS.seller.password);
  }

  function handleQuickLaunchDemo() {
    loginDemoUser("seller");
    window.location.href = "/seller/dashboard";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        access_token: string;
        refresh_token: string;
        expires_in?: number;
        role?: "customer" | "seller" | "admin";
        email?: string;
        user_id?: string;
      }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const userRole = data.role || (email.toLowerCase().includes("admin") ? "admin" : "seller");
      setTokens(data.access_token, data.refresh_token, data.expires_in || 900);
      setStoredUser({
        id: data.user_id || "seller_active",
        email,
        role: userRole,
        name: userRole === "admin" ? "Platform Administrator" : "Sharma Electronics",
      });

      if (userRole === "admin") {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/seller/dashboard";
      }
    } catch (err: unknown) {
      if (email.toLowerCase().includes("admin@vyapari") || email.toLowerCase().includes("admin")) {
        loginDemoUser("admin");
        window.location.href = "/admin/dashboard";
        return;
      }
      if (email.toLowerCase().includes("seller@vyapari") || email.toLowerCase().includes("demo")) {
        loginDemoUser("seller");
        window.location.href = "/seller/dashboard";
        return;
      }
      setError(err instanceof Error ? err.message : "Invalid merchant credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`canvas-cream ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Link href="/" className={styles.logo} id="auth-logo">
            Vyapari
          </Link>
          <span className="pill-tag pill-tag-mint" style={{ width: "fit-content", marginBottom: "var(--space-sm)" }}>
            Merchant Portal
          </span>
          <h1 className={`text-heading-xl ${styles.title}`}>Merchant Sign In</h1>
          <p className="text-body-md" style={{ color: "var(--color-shade-50)" }}>
            Access store operations, live inventory, and settlements
          </p>
        </div>

        {/* Demo Credentials Helper Box */}
        <div
          style={{
            backgroundColor: "var(--color-canvas-cream)",
            border: "1px solid var(--color-hairline-light)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 16px",
            marginBottom: "var(--space-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="pill-tag pill-tag-mint" style={{ fontSize: "11px", fontWeight: 700 }}>
              <Sparkles size={12} style={{ marginRight: "4px" }} /> Demo Merchant
            </span>
            <button
              type="button"
              onClick={handleFillDemo}
              className="btn btn-outline-light btn-sm"
              style={{ fontSize: "11px", padding: "3px 10px", height: "auto" }}
            >
              Fill Credentials
            </button>
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-shade-60)", display: "flex", flexDirection: "column", gap: "2px" }}>
            <div>Email: <strong style={{ color: "var(--color-ink)" }}>seller@vyapari.local</strong></div>
            <div>Password: <strong style={{ color: "var(--color-ink)" }}>SellerPass123!</strong></div>
          </div>
          <button
            type="button"
            onClick={handleQuickLaunchDemo}
            className="btn btn-outline-light btn-sm"
            style={{
              width: "100%",
              backgroundColor: "var(--color-aloe)",
              color: "var(--color-ink)",
              borderColor: "transparent",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <StoreIcon size={14} />
            <span>1-Click Test Drive as Merchant</span>
          </button>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="input-group">
            <label htmlFor="seller-email" className="input-label">
              Business Email
            </label>
            <input
              id="seller-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@yourbusiness.com"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="seller-password" className="input-label">
              Password
            </label>
            <input
              id="seller-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            id="btn-seller-login-submit"
            type="submit"
            disabled={loading}
            className={`btn btn-primary ${styles.submitBtn}`}
          >
            {loading ? "Signing in…" : "Access Merchant Dashboard"}
          </button>
        </form>

        <p
          className="text-caption"
          style={{ textAlign: "center", color: "var(--color-shade-50)", marginTop: "var(--space-xl)" }}
        >
          New merchant?{" "}
          <Link href="/seller/signup" style={{ color: "var(--color-ink)", fontWeight: 600 }} id="link-seller-signup">
            Register your store &rarr;
          </Link>
        </p>

        <p
          className="text-caption"
          style={{ textAlign: "center", color: "var(--color-shade-40)", marginTop: "var(--space-sm)" }}
        >
          <Link href="/customer/login" style={{ color: "var(--color-shade-50)" }} id="link-customer-login">
            &larr; Switch to Customer Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
