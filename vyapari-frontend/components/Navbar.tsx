"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Search,
  ShoppingBag,
  User,
  Store,
  LogOut,
  ChevronDown,
  Package,
  ShieldCheck,
} from "lucide-react";
import { clearTokens, getAccessToken, getStoredUser, UserSession } from "@/lib/api";

interface NavbarProps {
  variant?: "dark" | "light";
  cartCount?: number;
  initialSearch?: string;
}

export default function Navbar({
  variant = "light",
  cartCount = 0,
  initialSearch = "",
}: NavbarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [user, setUser] = useState<UserSession | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = getAccessToken();
    if (token) {
      const stored = getStoredUser();
      if (stored) {
        setUser(stored);
      } else {
        setUser({ id: "current", email: "user@vyapari.in", role: "customer" });
      }
    }
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/customer/home?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push("/customer/home");
    }
  }

  function handleLogout() {
    clearTokens();
    setUser(null);
    setDropdownOpen(false);
    router.push("/");
  }

  const isDark = variant === "dark";

  return (
    <header
      className={`navbar ${isDark ? "navbar-dark" : "navbar-light"}`}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        borderBottom: isDark
          ? "1px solid var(--color-hairline-dark)"
          : "1px solid var(--color-hairline-light)",
      }}
    >
      <div
        className="container container-wide"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-xl)",
          paddingBlock: "4px",
        }}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          className="navbar-logo"
          id="nav-brand-logo"
          style={{
            color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <span style={{ letterSpacing: "-0.5px" }}>Vyapari</span>
        </Link>

        {/* Global Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          role="search"
          aria-label="Search catalog"
          style={{
            flex: 1,
            maxWidth: "540px",
            display: "flex",
            position: "relative",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "14px",
              display: "flex",
              alignItems: "center",
              color: isDark ? "var(--color-shade-40)" : "var(--color-shade-50)",
              pointerEvents: "none",
            }}
          >
            <Search size={16} strokeWidth={2} />
          </div>
          <input
            id="global-search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, brands, categories…"
            style={{
              width: "100%",
              height: "40px",
              paddingLeft: "42px",
              paddingRight: "80px",
              borderRadius: "var(--radius-pill)",
              border: isDark
                ? "1px solid var(--color-hairline-dark)"
                : "1px solid var(--color-hairline-light)",
              backgroundColor: isDark
                ? "var(--color-canvas-night-elevated)"
                : "var(--color-canvas-cream)",
              color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
              fontSize: "14px",
              outline: "none",
              transition: "border-color var(--duration-fast), box-shadow var(--duration-fast)",
            }}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            style={{
              position: "absolute",
              right: "4px",
              height: "32px",
              paddingInline: "14px",
              fontSize: "13px",
            }}
          >
            Search
          </button>
        </form>

        {/* Nav Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
          <Link
            href="/customer/home"
            className="btn btn-outline-light btn-sm"
            style={{
              borderColor: isDark ? "var(--color-hairline-dark)" : "var(--color-hairline-light)",
              color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
            }}
          >
            Explore Store
          </Link>

          <Link
            href="/customer/cart"
            id="nav-cart-btn"
            className="btn btn-outline-light btn-sm"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              position: "relative",
              borderColor: isDark ? "var(--color-hairline-dark)" : "var(--color-hairline-light)",
              color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
            }}
            aria-label="View shopping cart"
          >
            <ShoppingBag size={16} strokeWidth={2} />
            <span>Cart</span>
            {mounted && cartCount > 0 && (
              <span
                style={{
                  backgroundColor: "var(--color-ink)",
                  color: "var(--color-on-primary)",
                  fontSize: "11px",
                  fontWeight: 600,
                  borderRadius: "var(--radius-pill)",
                  padding: "1px 6px",
                  lineHeight: "1.2",
                }}
              >
                {cartCount}
              </span>
            )}
          </Link>

          {mounted && user ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="btn btn-outline-light btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  borderColor: isDark ? "var(--color-hairline-dark)" : "var(--color-hairline-light)",
                  color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                }}
                id="user-menu-btn"
              >
                <User size={15} />
                <span style={{ maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name || user.email.split("@")[0]}
                </span>
                <ChevronDown size={14} />
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: "200px",
                    backgroundColor: "var(--color-canvas-light)",
                    border: "1px solid var(--color-hairline-light)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-3)",
                    padding: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    zIndex: 200,
                  }}
                >
                  <Link
                    href="/customer/orders"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "14px",
                      color: "var(--color-ink)",
                      textDecoration: "none",
                    }}
                  >
                    <Package size={16} color="var(--color-shade-60)" />
                    <span>My Orders</span>
                  </Link>

                  {user.role === "admin" ? (
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        color: "var(--color-ink)",
                        textDecoration: "none",
                      }}
                    >
                      <ShieldCheck size={16} color="#dc2626" />
                      <span style={{ fontWeight: 600, color: "#dc2626" }}>Admin Moderation</span>
                    </Link>
                  ) : user.role === "seller" ? (
                    <Link
                      href="/seller/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        color: "var(--color-ink)",
                        textDecoration: "none",
                      }}
                    >
                      <Store size={16} color="var(--color-shade-60)" />
                      <span>Seller Dashboard</span>
                    </Link>
                  ) : (
                    <Link
                      href="/seller/signup"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        fontSize: "14px",
                        color: "var(--color-ink)",
                        textDecoration: "none",
                      }}
                    >
                      <Store size={16} color="var(--color-shade-60)" />
                      <span>Become a Seller</span>
                    </Link>
                  )}

                  <hr
                    style={{
                      border: "none",
                      borderTop: "1px solid var(--color-hairline-light)",
                      margin: "4px 0",
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      fontSize: "14px",
                      color: "#dc2626",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link
                href="/customer/login"
                id="nav-login-link"
                className="btn btn-outline-light btn-sm"
                style={{
                  borderColor: isDark ? "var(--color-hairline-dark)" : "var(--color-hairline-light)",
                  color: isDark ? "var(--color-on-primary)" : "var(--color-ink)",
                }}
              >
                Sign In
              </Link>
              <Link
                href="/seller/signup"
                id="nav-start-selling-btn"
                className="btn btn-primary btn-sm"
              >
                Sell on Vyapari
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
