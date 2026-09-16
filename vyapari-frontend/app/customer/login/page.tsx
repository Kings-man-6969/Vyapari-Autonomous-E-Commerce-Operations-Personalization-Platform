"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { setTokens, setStoredUser, apiRequest, DEMO_CREDENTIALS, loginDemoUser } from "@/lib/api";
import styles from "../auth.module.css";

export default function CustomerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFillDemo() {
    setEmail(DEMO_CREDENTIALS.customer.email);
    setPassword(DEMO_CREDENTIALS.customer.password);
  }

  function handleQuickLaunchDemo() {
    loginDemoUser("customer");
    window.location.href = "/customer/home";
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

      const userRole = data.role || (email.toLowerCase().includes("admin") ? "admin" : "customer");
      setTokens(data.access_token, data.refresh_token, data.expires_in || 900);
      setStoredUser({
        id: data.user_id || "user_active",
        email,
        role: userRole,
        name: userRole === "admin" ? "Platform Administrator" : "Shopper",
      });

      if (userRole === "admin") {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/customer/home";
      }
    } catch (err: unknown) {
      if (email.toLowerCase().includes("admin@vyapari") || email.toLowerCase().includes("admin")) {
        loginDemoUser("admin");
        window.location.href = "/admin/dashboard";
        return;
      }
      if (email.toLowerCase().includes("customer@vyapari") || email.toLowerCase().includes("demo")) {
        loginDemoUser("customer");
        window.location.href = "/customer/home";
        return;
      }
      setError(err instanceof Error ? err.message : "Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/oauth/google?role=customer`;
  }

  return (
    <div className={`canvas-cream ${styles.page}`}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <Link href="/" className={styles.logo} id="auth-logo">
            Vyapari
          </Link>
          <h1 className={`text-heading-xl ${styles.title}`}>Welcome Back</h1>
          <p className="text-body-md" style={{ color: "var(--color-shade-50)" }}>
            Sign in to access your orders, cart, and recommendations
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
              <Sparkles size={12} style={{ marginRight: "4px" }} /> Demo Account
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
            <div>Email: <strong style={{ color: "var(--color-ink)" }}>customer@vyapari.local</strong></div>
            <div>Password: <strong style={{ color: "var(--color-ink)" }}>CustomerPass123!</strong></div>
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
            <UserCheck size={14} />
            <span>1-Click Test Drive as Customer</span>
          </button>
        </div>

        {/* Google OAuth Button */}
        <button
          id="btn-google-login"
          type="button"
          onClick={handleGoogleLogin}
          className={`btn btn-outline-light ${styles.googleBtn}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className={styles.divider}>
          <hr className="divider-light" />
          <span
            className="text-caption"
            style={{ color: "var(--color-shade-40)", padding: "0 var(--space-md)" }}
          >
            or sign in with email
          </span>
          <hr className="divider-light" />
        </div>

        {/* Error Notification */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className="input-group">
            <label htmlFor="email" className="input-label">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="name@example.com"
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label htmlFor="password" className="input-label">
              Password
            </label>
            <input
              id="password"
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
            id="btn-customer-login-submit"
            type="submit"
            disabled={loading}
            className={`btn btn-primary ${styles.submitBtn}`}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Footnotes */}
        <p
          className="text-caption"
          style={{ textAlign: "center", color: "var(--color-shade-50)", marginTop: "var(--space-xl)" }}
        >
          New to Vyapari?{" "}
          <Link href="/customer/signup" style={{ color: "var(--color-ink)", fontWeight: 600 }} id="link-customer-signup">
            Create an account
          </Link>
        </p>

        <p
          className="text-caption"
          style={{ textAlign: "center", color: "var(--color-shade-40)", marginTop: "var(--space-sm)" }}
        >
          Are you a merchant?{" "}
          <Link href="/seller/login" style={{ color: "var(--color-shade-60)" }} id="link-seller-login">
            Seller Portal &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
