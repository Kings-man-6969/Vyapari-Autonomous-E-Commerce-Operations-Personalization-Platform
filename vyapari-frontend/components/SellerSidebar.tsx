"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ShoppingBag,
  CreditCard,
  FileCheck2,
  Settings,
  LogOut,
  ExternalLink,
  Store,
} from "lucide-react";
import { clearTokens } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/seller/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/seller/products", label: "Product Catalog", icon: Package },
  { href: "/seller/products/new", label: "Add New Product", icon: PlusCircle },
  { href: "/seller/orders", label: "Fulfillment & Orders", icon: ShoppingBag },
  { href: "/seller/payouts", label: "Payouts & Finance", icon: CreditCard },
  { href: "/seller/kyc", label: "KYC Verification", icon: FileCheck2 },
  { href: "/seller/settings", label: "Store Settings", icon: Settings },
];

export default function SellerSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearTokens();
    router.push("/seller/login");
  }

  return (
    <aside
      className="sidebar"
      style={{
        width: "260px",
        flexShrink: 0,
        backgroundColor: "var(--color-canvas-light)",
        borderRight: "1px solid var(--color-hairline-light)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100svh",
        overflowY: "auto",
      }}
      aria-label="Seller Portal Navigation"
    >
      {/* Brand Header */}
      <div
        style={{
          padding: "var(--space-xl)",
          borderBottom: "1px solid var(--color-hairline-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            color: "var(--color-ink)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            className="navbar-logo"
            style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.5px" }}
          >
            Vyapari
          </span>
        </Link>
        <span
          className="pill-tag pill-tag-mint"
          style={{ fontSize: "11px", fontWeight: 600 }}
        >
          Merchant
        </span>
      </div>

      {/* Navigation Links */}
      <nav
        style={{
          flex: 1,
          padding: "var(--space-md) var(--space-md)",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <p
          className="text-eyebrow"
          style={{
            color: "var(--color-shade-40)",
            padding: "8px 12px 4px",
            fontSize: "11px",
          }}
        >
          Store Operations
        </p>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/seller/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 450,
                color: isActive ? "var(--color-ink)" : "var(--color-shade-60)",
                backgroundColor: isActive ? "var(--color-canvas-cream)" : "transparent",
                textDecoration: "none",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.2 : 1.8}
                color={isActive ? "var(--color-ink)" : "var(--color-shade-50)"}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Store preview & Logout */}
      <div
        style={{
          padding: "var(--space-lg)",
          borderTop: "1px solid var(--color-hairline-light)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <Link
          href="/customer/home"
          target="_blank"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: "var(--radius-md)",
            fontSize: "13px",
            color: "var(--color-shade-60)",
            backgroundColor: "var(--color-canvas-cream)",
            textDecoration: "none",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Store size={15} />
            <span>Customer Storefront</span>
          </span>
          <ExternalLink size={13} />
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="btn btn-outline-light btn-sm"
          style={{
            width: "100%",
            justifyContent: "center",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#dc2626",
            borderColor: "#fecaca",
          }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
