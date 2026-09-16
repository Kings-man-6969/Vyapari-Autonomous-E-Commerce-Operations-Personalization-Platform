"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Clock, ArrowRight, Building2 } from "lucide-react";
import { setTokens, setStoredUser, apiRequest } from "@/lib/api";
import styles from "../../customer/auth.module.css";

type Step = 1 | 2 | 3;

interface FormData {
  email: string;
  password: string;
  business_name: string;
  gstin: string;
  pan: string;
}

export default function SellerSignupPage() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    email: "",
    password: "",
    business_name: "",
    gstin: "",
    pan: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
      setError(null);
      setStep(2);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{
        access_token: string;
        refresh_token: string;
        expires_in?: number;
      }>("/api/v1/auth/seller/signup", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          business_name: form.business_name,
          gstin: form.gstin || undefined,
          pan: form.pan || undefined,
        }),
      });

      setTokens(data.access_token, data.refresh_token, data.expires_in || 900);
      setStoredUser({
        id: "seller_active",
        email: form.email,
        role: "seller",
        name: form.business_name,
      });
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please verify your details.");
    } finally {
      setLoading(false);
    }
  }

  // Step 3: KYC Pending Screen
  if (step === 3) {
    return (
      <div className={`canvas-cream ${styles.page}`}>
        <div className={styles.card} style={{ textAlign: "center" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "var(--color-pistachio-10)",
              color: "var(--color-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto var(--space-lg)",
            }}
          >
            <Clock size={32} />
          </div>

          <h1 className="text-heading-xl" style={{ margin: "0 0 8px" }}>
            Account Created &bull; KYC In Review
          </h1>
          <p className="text-body-md" style={{ color: "var(--color-shade-60)", lineHeight: 1.6 }}>
            Your seller registration has been received. Our compliance team verifies GSTIN and PAN records within 24–48 hours.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "var(--space-xl)" }}>
            <Link
              href="/seller/dashboard"
              className="btn btn-primary btn-lg"
              style={{ justifyContent: "center" }}
              id="btn-goto-dashboard"
            >
              Explore Merchant Dashboard
            </Link>
            <Link
              href="/"
              className="btn btn-outline-light"
              style={{ justifyContent: "center" }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`canvas-cream ${styles.page}`}>
      <div className={styles.card}>
        {/* Step Indicator */}
        <div className={styles.stepIndicator} aria-label={`Step ${step} of 2`}>
          <div className={`${styles.step} ${step >= 1 ? styles.active : ""}`} />
          <div className={`${styles.step} ${step >= 2 ? styles.active : ""}`} />
        </div>

        <div className={styles.header}>
          <Link href="/" className={styles.logo} id="auth-logo">
            Vyapari
          </Link>
          <span className="pill-tag pill-tag-mint" style={{ width: "fit-content", marginBottom: "var(--space-sm)" }}>
            Merchant Onboarding
          </span>
          <h1 className={`text-heading-xl ${styles.title}`}>
            {step === 1 ? "Register Store" : "Business Details"}
          </h1>
          <p className="text-body-md" style={{ color: "var(--color-shade-50)" }}>
            {step === 1
              ? "Create your merchant credentials"
              : "GSTIN and PAN are required for legal marketplace compliance"}
          </p>
        </div>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {step === 1 ? (
            <>
              <div className="input-group">
                <label htmlFor="seller-signup-email" className="input-label">
                  Business Email
                </label>
                <input
                  id="seller-signup-email"
                  type="email"
                  required
                  className="input"
                  placeholder="merchant@business.com"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>

              <div className="input-group">
                <label htmlFor="seller-signup-password" className="input-label">
                  Password
                </label>
                <input
                  id="seller-signup-password"
                  type="password"
                  required
                  className="input"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  value={form.password}
                  onChange={set("password")}
                />
              </div>
            </>
          ) : (
            <>
              <div className="input-group">
                <label htmlFor="business-name" className="input-label">
                  Registered Business Name *
                </label>
                <input
                  id="business-name"
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Sharma Enterprises"
                  value={form.business_name}
                  onChange={set("business_name")}
                />
              </div>

              <div className="input-group">
                <label htmlFor="gstin" className="input-label">
                  GSTIN (15 Chars) <span style={{ color: "var(--color-shade-40)" }}>(optional)</span>
                </label>
                <input
                  id="gstin"
                  type="text"
                  className="input"
                  placeholder="29AAAAA0000A1Z5"
                  maxLength={15}
                  value={form.gstin}
                  onChange={set("gstin")}
                />
              </div>

              <div className="input-group">
                <label htmlFor="pan" className="input-label">
                  PAN (10 Chars) <span style={{ color: "var(--color-shade-40)" }}>(optional)</span>
                </label>
                <input
                  id="pan"
                  type="text"
                  className="input"
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={form.pan}
                  onChange={set("pan")}
                />
              </div>
            </>
          )}

          <button
            id={step === 1 ? "btn-seller-step1-next" : "btn-seller-signup-submit"}
            type="submit"
            disabled={loading}
            className={`btn btn-primary ${styles.submitBtn}`}
          >
            {loading ? "Registering…" : step === 1 ? "Continue &rarr;" : "Submit Registration"}
          </button>

          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn btn-outline-light"
              style={{ width: "100%", justifyContent: "center" }}
            >
              &larr; Back
            </button>
          )}
        </form>

        <p
          className="text-caption"
          style={{ textAlign: "center", color: "var(--color-shade-50)", marginTop: "var(--space-xl)" }}
        >
          Already have a seller account?{" "}
          <Link href="/seller/login" style={{ color: "var(--color-ink)", fontWeight: 600 }} id="link-seller-login">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
