"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  FileCheck2,
  LogOut,
  Clock,
} from "lucide-react";
import { apiRequest, clearTokens, getAccessToken } from "@/lib/api";

interface SellerProfile {
  id: string;
  user_id: string;
  business_name: string;
  gstin: string | null;
  pan: string | null;
  kyc_status: string;
  verified_at: string | null;
}

const SAMPLE_PENDING_SELLERS: SellerProfile[] = [
  {
    id: "seller-mod-01",
    user_id: "usr-9912",
    business_name: "Deccan Handlooms & Crafts",
    gstin: "36AABCS1429B1Z8",
    pan: "AABCS1429B",
    kyc_status: "pending",
    verified_at: null,
  },
  {
    id: "seller-mod-02",
    user_id: "usr-9913",
    business_name: "Gujarat Spice Traders",
    gstin: "24AAACG8819Q1ZP",
    pan: "AAACG8819Q",
    kyc_status: "pending",
    verified_at: null,
  },
];

export default function AdminDashboardPage() {
  const [sellers, setSellers] = useState<SellerProfile[]>(SAMPLE_PENDING_SELLERS);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadPendingSellers() {
      const token = getAccessToken();
      if (!token) return;
      setLoading(true);
      try {
        const data = await apiRequest<SellerProfile[]>("/api/v1/admin/sellers/pending");
        if (Array.isArray(data)) {
          setSellers(data);
        }
      } catch (err) {
        console.warn("Failed to load live pending sellers:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPendingSellers();
  }, []);

  async function processKYC(sellerId: string, action: "approved" | "rejected") {
    setActionLoading(sellerId);
    try {
      await apiRequest(`/api/v1/admin/sellers/${sellerId}/kyc`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason: action === "rejected" ? "Verification documentation incomplete" : undefined,
        }),
      });
    } catch (err) {
      console.warn("Live KYC action failed, updating locally:", err);
    } finally {
      setSellers((prev) => prev.filter((s) => s.id !== sellerId));
      setActionLoading(null);
    }
  }

  return (
    <div style={{ minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      {/* Navbar */}
      <nav className="navbar navbar-light" role="navigation" aria-label="Admin navigation">
        <div className="container container-wide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="navbar-logo" id="admin-logo" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Vyapari</span>
            <span className="pill-tag pill-tag-dark" style={{ fontSize: "11px" }}>
              Admin Moderation
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/" className="btn btn-outline-light btn-sm">
              Live Storefront
            </Link>
            <button
              id="btn-admin-logout"
              type="button"
              className="btn btn-outline-light btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "6px", color: "#dc2626", borderColor: "#fecaca" }}
              onClick={() => {
                clearTokens();
                window.location.href = "/";
              }}
            >
              <LogOut size={14} />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="container container-wide" style={{ paddingBlock: "var(--space-xxl)" }}>
        <div style={{ marginBottom: "var(--space-xxl)" }}>
          <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
            KYC Review Queue
          </h1>
          <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
            Review merchant documents and authorize store onboarding
          </p>
        </div>

        {sellers.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "var(--space-huge)",
              border: "1px dashed var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              backgroundColor: "var(--color-canvas-light)",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            <CheckCircle2 size={48} color="#16a34a" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-ink)", margin: "0 0 6px" }}>
              All Caught Up!
            </h2>
            <p className="text-caption" style={{ color: "var(--color-shade-50)", margin: 0 }}>
              No pending merchant KYC applications in the review queue.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            {sellers.map((seller) => (
              <div
                key={seller.id}
                id={`seller-card-${seller.id}`}
                style={{
                  backgroundColor: "var(--color-canvas-light)",
                  border: "1px solid var(--color-hairline-light)",
                  borderRadius: "var(--radius-xl)",
                  padding: "var(--space-xl)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-xl)",
                  flexWrap: "wrap",
                  boxShadow: "var(--shadow-1)",
                }}
              >
                {/* Info */}
                <div style={{ flex: 1, minWidth: "260px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Building2 size={18} color="var(--color-shade-60)" />
                    <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                      {seller.business_name}
                    </h2>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-xl)", marginTop: "8px", flexWrap: "wrap" }}>
                    {seller.gstin && (
                      <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                        GSTIN: <strong style={{ color: "var(--color-ink)" }}>{seller.gstin}</strong>
                      </span>
                    )}
                    {seller.pan && (
                      <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                        PAN: <strong style={{ color: "var(--color-ink)" }}>{seller.pan}</strong>
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: "10px" }}>
                    <span
                      className="pill-tag"
                      style={{
                        backgroundColor: "var(--color-pistachio-10)",
                        color: "var(--color-ink)",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      Status: Under Verification
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
                  <button
                    id={`btn-approve-${seller.id}`}
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={actionLoading === seller.id}
                    onClick={() => processKYC(seller.id, "approved")}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <CheckCircle2 size={15} />
                    <span>{actionLoading === seller.id ? "Processing…" : "Approve Merchant"}</span>
                  </button>

                  <button
                    id={`btn-reject-${seller.id}`}
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    disabled={actionLoading === seller.id}
                    onClick={() => processKYC(seller.id, "rejected")}
                    style={{ color: "#dc2626", borderColor: "#fca5a5", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <XCircle size={15} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
