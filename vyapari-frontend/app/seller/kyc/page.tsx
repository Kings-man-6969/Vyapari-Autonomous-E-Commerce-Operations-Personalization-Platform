"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Building2,
  CreditCard,
  FileText,
  Check,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import SellerSidebar from "@/components/SellerSidebar";
import { getStoredUser, getAccessToken, apiRequest } from "@/lib/api";

export default function SellerKYCPage() {
  const [kycStatus, setKycStatus] = useState<"pending" | "under_review" | "approved" | "rejected">("under_review");
  const [form, setForm] = useState({
    business_name: "Sharma Electronics Pvt. Ltd.",
    gstin: "29AAAAA0000A1Z5",
    pan: "ABCDE1234F",
    account_number: "50200088921822",
    ifsc_code: "HDFC0000128",
    bank_name: "HDFC Bank Ltd.",
    account_holder_name: "Sharma Electronics",
    address_line: "Plot 42, Electronics City Phase 1",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560100",
  });

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user && user.role === "seller") {
      setKycStatus("under_review");
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
      setKycStatus("under_review");
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 800);
  }

  return (
    <div style={{ display: "flex", minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      <SellerSidebar />

      <main style={{ flex: 1, padding: "var(--space-xxl)", overflowY: "auto" }}>
        <div style={{ maxWidth: "800px" }}>
          {/* Top Header */}
          <div style={{ marginBottom: "var(--space-xxl)" }}>
            <span className="pill-tag pill-tag-mint" style={{ marginBottom: "6px", display: "inline-flex" }}>
              Regulatory Compliance
            </span>
            <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
              KYC &amp; Business Verification
            </h1>
            <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
              Required for automated GST-compliant payouts under Indian e-commerce regulations
            </p>
          </div>

          {/* Dynamic Verification Badge */}
          {kycStatus === "approved" ? (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-xl)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "var(--space-xxl)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "#dcfce7",
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
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#15803d", margin: 0 }}>
                    KYC Verified &amp; Active
                  </h3>
                  <span
                    className="pill-tag"
                    style={{ backgroundColor: "#16a34a", color: "#ffffff", fontSize: "10px", fontWeight: 700 }}
                  >
                    VALIDATED
                  </span>
                </div>
                <p className="text-caption" style={{ color: "#166534", marginTop: "2px" }}>
                  All documents approved by the Vyapari Compliance Team.
                </p>
              </div>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "var(--color-pistachio-10)",
                border: "1px solid var(--color-hairline-light)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-xl)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "var(--space-xxl)",
              }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-aloe)",
                  color: "var(--color-ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Clock size={24} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                    KYC In Review Queue
                  </h3>
                  <span
                    className="pill-tag pill-tag-mint"
                    style={{ fontSize: "10px", fontWeight: 700 }}
                  >
                    PENDING ADMIN APPROVAL
                  </span>
                </div>
                <p className="text-caption" style={{ color: "var(--color-shade-60)", marginTop: "2px" }}>
                  Your GSTIN and PAN details have been submitted and are queued for verification by Vyapari platform admins.
                </p>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "var(--radius-lg)",
                padding: "12px 18px",
                color: "#16a34a",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "var(--space-xl)",
                fontSize: "14px",
              }}
            >
              <Check size={16} />
              <span>KYC records updated successfully.</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
            {/* Business Identity */}
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 size={18} color="var(--color-shade-60)" />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Business Entity Details
                </h2>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="kyc-bname">
                  Registered Business Name
                </label>
                <input
                  id="kyc-bname"
                  type="text"
                  required
                  className="input"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="kyc-gstin">
                    GSTIN (15 Characters)
                  </label>
                  <input
                    id="kyc-gstin"
                    type="text"
                    required
                    maxLength={15}
                    className="input"
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="kyc-pan">
                    PAN (10 Characters)
                  </label>
                  <input
                    id="kyc-pan"
                    type="text"
                    required
                    maxLength={10}
                    className="input"
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Bank Details */}
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <CreditCard size={18} color="var(--color-shade-60)" />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Settlement Bank Account
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="kyc-acc">
                    Bank Account Number
                  </label>
                  <input
                    id="kyc-acc"
                    type="password"
                    required
                    className="input"
                    value={form.account_number}
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="kyc-ifsc">
                    IFSC Code
                  </label>
                  <input
                    id="kyc-ifsc"
                    type="text"
                    required
                    className="input"
                    value={form.ifsc_code}
                    onChange={(e) => setForm({ ...form, ifsc_code: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="kyc-holder">
                    Beneficiary Name (as per Bank)
                  </label>
                  <input
                    id="kyc-holder"
                    type="text"
                    required
                    className="input"
                    value={form.account_holder_name}
                    onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="kyc-bank">
                    Bank Name
                  </label>
                  <input
                    id="kyc-bank"
                    type="text"
                    required
                    className="input"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-lg"
              >
                {saving ? "Saving KYC Details…" : "Update KYC Information"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
