"use client";

import { useState } from "react";
import { Store, Bell, Truck, Check } from "lucide-react";
import SellerSidebar from "@/components/SellerSidebar";

export default function SellerSettingsPage() {
  const [form, setForm] = useState({
    store_name: "Sharma Electronics",
    support_email: "support@sharmaelectronics.in",
    support_phone: "+91 98765 43210",
    pickup_pincode: "560100",
    order_dispatch_window: "24",
    email_notifications: true,
  });

  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div style={{ display: "flex", minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      <SellerSidebar />

      <main style={{ flex: 1, padding: "var(--space-xxl)", overflowY: "auto" }}>
        <div style={{ maxWidth: "760px" }}>
          {/* Header */}
          <div style={{ marginBottom: "var(--space-xxl)" }}>
            <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
              Store Settings
            </h1>
            <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
              Configure branding, customer support contacts, and dispatch policies
            </p>
          </div>

          {saved && (
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
              <span>Store settings updated successfully.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
            {/* Store Profile */}
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
                <Store size={18} color="var(--color-shade-60)" />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Store Profile &amp; Support Contacts
                </h2>
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="store-name">
                  Store Display Name
                </label>
                <input
                  id="store-name"
                  type="text"
                  required
                  className="input"
                  value={form.store_name}
                  onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="store-email">
                    Customer Support Email
                  </label>
                  <input
                    id="store-email"
                    type="email"
                    required
                    className="input"
                    value={form.support_email}
                    onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="store-phone">
                    Customer Support Helpline
                  </label>
                  <input
                    id="store-phone"
                    type="tel"
                    required
                    className="input"
                    value={form.support_phone}
                    onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Dispatch & Logistics */}
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
                <Truck size={18} color="var(--color-shade-60)" />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Logistics &amp; Dispatch Settings
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-lg)" }}>
                <div className="input-group">
                  <label className="input-label" htmlFor="store-pin">
                    Warehouse / Pickup Pincode
                  </label>
                  <input
                    id="store-pin"
                    type="text"
                    required
                    maxLength={6}
                    className="input"
                    value={form.pickup_pincode}
                    onChange={(e) => setForm({ ...form, pickup_pincode: e.target.value })}
                  />
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="store-dispatch">
                    Dispatch SLA Window
                  </label>
                  <select
                    id="store-dispatch"
                    className="input"
                    value={form.order_dispatch_window}
                    onChange={(e) => setForm({ ...form, order_dispatch_window: e.target.value })}
                  >
                    <option value="24">Same-Day / 24 Hours</option>
                    <option value="48">Within 48 Hours</option>
                    <option value="72">Within 3 Business Days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div
              style={{
                backgroundColor: "var(--color-canvas-light)",
                border: "1px solid var(--color-hairline-light)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Bell size={18} color="var(--color-shade-60)" />
                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                  Automated Alerts
                </h2>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                <input
                  type="checkbox"
                  checked={form.email_notifications}
                  onChange={(e) => setForm({ ...form, email_notifications: e.target.checked })}
                  style={{ accentColor: "var(--color-ink)" }}
                />
                <span>Send instant email alerts when a new order is received</span>
              </label>
            </div>

            {/* Submit */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary btn-lg">
                Save Store Settings
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
