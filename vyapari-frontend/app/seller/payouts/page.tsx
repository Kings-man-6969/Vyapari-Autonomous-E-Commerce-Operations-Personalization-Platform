"use client";

import { useState } from "react";
import {
  CreditCard,
  Download,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import SellerSidebar from "@/components/SellerSidebar";

interface PayoutRecord {
  id: string;
  utr: string;
  amount: number;
  date: string;
  status: "settled" | "processing";
  bankAccount: string;
}

const SAMPLE_PAYOUTS: PayoutRecord[] = [
  {
    id: "po-99120",
    utr: "HDFC99821734891",
    amount: 54200,
    date: "2026-08-22T08:00:00Z",
    status: "settled",
    bankAccount: "HDFC Bank &bull;&bull;&bull;&bull; 8821",
  },
  {
    id: "po-98540",
    utr: "HDFC88719203918",
    amount: 68450,
    date: "2026-08-15T08:00:00Z",
    status: "settled",
    bankAccount: "HDFC Bank &bull;&bull;&bull;&bull; 8821",
  },
  {
    id: "po-97910",
    utr: "HDFC77618920192",
    amount: 41800,
    date: "2026-08-08T08:00:00Z",
    status: "settled",
    bankAccount: "HDFC Bank &bull;&bull;&bull;&bull; 8821",
  },
];

export default function SellerPayoutsPage() {
  const [payouts] = useState<PayoutRecord[]>(SAMPLE_PAYOUTS);

  return (
    <div style={{ display: "flex", minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      <SellerSidebar />

      <main style={{ flex: 1, padding: "var(--space-xxl)", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "var(--space-xxl)" }}>
          <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
            Payouts &amp; Settlements
          </h1>
          <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
            Automated direct bank transfers via Razorpay Route
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "var(--space-lg)",
            marginBottom: "var(--space-xxl)",
          }}
        >
          {/* Next Settlement */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
              Next Settlement (29 Aug)
            </span>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              &#8377;32,150.00
            </p>
            <span className="text-caption" style={{ color: "#16a34a", fontWeight: 600 }}>
              Transfer scheduled in 3 days
            </span>
          </div>

          {/* Settled this month */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
              Settled This Month
            </span>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              &#8377;1,64,450.00
            </p>
            <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
              3 successful transfers
            </span>
          </div>

          {/* Lifetime GMV */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-light)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xl)",
            }}
          >
            <span className="text-eyebrow" style={{ color: "var(--color-shade-40)" }}>
              Lifetime Net Volume
            </span>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "var(--color-ink)", margin: "12px 0 4px" }}>
              &#8377;12,48,900.00
            </p>
            <span className="text-caption" style={{ color: "#16a34a", fontWeight: 600 }}>
              0 dispute penalties
            </span>
          </div>
        </div>

        {/* Payouts Table */}
        <div
          style={{
            backgroundColor: "var(--color-canvas-light)",
            border: "1px solid var(--color-hairline-light)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-hairline-light)" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
              Settlement History
            </h2>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-canvas-cream)", borderBottom: "1px solid var(--color-hairline-light)" }}>
                <th style={{ padding: "12px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  SETTLEMENT DATE
                </th>
                <th style={{ padding: "12px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  BANK UTR REFERENCE
                </th>
                <th style={{ padding: "12px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  AMOUNT (INR)
                </th>
                <th style={{ padding: "12px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  STATUS
                </th>
                <th style={{ padding: "12px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px", textAlign: "right" }}>
                  STATEMENT
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((po) => (
                <tr key={po.id} style={{ borderBottom: "1px solid var(--color-hairline-light)" }}>
                  <td style={{ padding: "16px 20px" }}>
                    {new Date(po.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td style={{ padding: "16px 20px", fontFamily: "monospace", fontSize: "13px" }}>
                    {po.utr}
                  </td>
                  <td style={{ padding: "16px 20px", fontWeight: 700 }}>
                    &#8377;{po.amount.toLocaleString("en-IN")}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      className="pill-tag"
                      style={{ backgroundColor: "#f0fdf4", color: "#16a34a", fontSize: "11px", fontWeight: 600 }}
                    >
                      Settled
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => alert(`Downloading Statement for UTR ${po.utr}`)}
                      className="btn btn-outline-light btn-sm"
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Download size={13} />
                      <span>PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
