"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { setTokens, setStoredUser, apiRequest } from "@/lib/api";
import styles from "../auth.module.css";

export default function CustomerSignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setError(null);
    setStep(2);
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
      }>("/api/v1/auth/customer/signup", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setTokens(data.access_token, data.refresh_token, data.expires_in || 900);
      setStoredUser({ id: "user_active", email: form.email, role: "customer", name: form.full_name });
      window.location.href = "/customer/home";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignup() {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/auth/oauth/google?role=customer`;
  }

  return (
    <div className={`canvas-cream ${styles.page}`}>
      <div className={styles.card}>
        {/* Step Indicator */}
        <div className={styles.stepIndicator} aria-label="Sign up progress">
          <div className={`${styles.step} ${step >= 1 ? styles.active : ""}`} />
          <div className={`${styles.step} ${step >= 2 ? styles.active : ""}`} />
        </div>

        <div className={styles.header}>
          <Link href="/" className={styles.logo} id="auth-logo">
            Vyapari
          </Link>
          <h1 className={`text-heading-xl ${styles.title}`}>
            {step === 1 ? "Create Account" : "Personal Details"}
          </h1>
          <p className="text-body-md" style={{ color: "var(--color-shade-50)" }}>
            {step === 1 ? "Start shopping in seconds" : "Tell us your name to complete registration"}
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {step === 1 ? (
          <>
            <button
              id="btn-google-signup"
              type="button"
              onClick={handleGoogleSignup}
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

            <div className={styles.divider}>
              <hr className="divider-light" />
              <span
                className="text-caption"
                style={{ color: "var(--color-shade-40)", padding: "0 var(--space-md)" }}
              >
                or register with email
              </span>
              <hr className="divider-light" />
            </div>

            <form onSubmit={handleStep1} className={styles.form}>
              <div className="input-group">
                <label htmlFor="signup-email" className="input-label">
                  Email Address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  className="input"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>

              <div className="input-group">
                <label htmlFor="signup-password" className="input-label">
                  Create Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  className="input"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={set("password")}
                  minLength={8}
                />
              </div>

              <button id="btn-step1-next" type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
                Continue &rarr;
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="input-group">
              <label htmlFor="full_name" className="input-label">
                Full Name
              </label>
              <input
                id="full_name"
                type="text"
                required
                className="input"
                placeholder="e.g. Rahul Sharma"
                value={form.full_name}
                onChange={set("full_name")}
              />
            </div>

            <button
              id="btn-signup-submit"
              type="submit"
              disabled={loading}
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              {loading ? "Creating Account…" : "Complete Registration"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-outline-light"
              style={{ width: "100%", justifyContent: "center" }}
            >
              &larr; Back
            </button>
          </form>
        )}

        <p
          className="text-caption"
          style={{ textAlign: "center", color: "var(--color-shade-50)", marginTop: "var(--space-xl)" }}
        >
          Already have an account?{" "}
          <Link href="/customer/login" style={{ color: "var(--color-ink)", fontWeight: 600 }} id="link-customer-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
