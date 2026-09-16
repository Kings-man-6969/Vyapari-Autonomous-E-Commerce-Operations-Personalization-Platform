import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingBag,
  Store,
  ShieldCheck,
  Zap,
  TrendingUp,
  Package,
  ArrowRight,
  ChevronRight,
  Layers,
  Sparkles,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CATEGORIES_DATA, PRODUCTS_DATA } from "@/lib/data";

export const metadata: Metadata = {
  title: "Vyapari — India's Autonomous E-Commerce Platform",
  description:
    "Buy from thousands of verified sellers or start your own store. Vyapari is the dual-role marketplace built for Bharat.",
};

const STATS = [
  { value: "2.4M+", label: "Verified Products", icon: Package },
  { value: "54,000+", label: "Active Merchants", icon: Store },
  { value: "99.8%", label: "On-Time Delivery", icon: Zap },
  { value: "₹420Cr+", label: "Annual GMV", icon: TrendingUp },
];

const VALUE_PROPS = [
  {
    icon: ShoppingBag,
    title: "Curated Indian Catalog",
    description:
      "Millions of authentic products directly from certified manufacturers, artisans, and regional brands across all Indian states.",
  },
  {
    icon: Store,
    title: "Merchant Autonomy",
    description:
      "Comprehensive seller studio with automated inventory synchronization, instant KYC verification, and same-week payout settlements.",
  },
  {
    icon: ShieldCheck,
    title: "Buyer Protection & Trust",
    description:
      "Every merchant is GSTIN/PAN verified. Secured checkout powered by Razorpay with 100% tokenized INR payment processing.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Personalization",
    description:
      "Vector embedding search algorithms recommend products tailored to your preferences, style affinity, and localized demand.",
  },
];

export default function LandingPage() {
  return (
    <main className="canvas-night" style={{ minHeight: "100svh", color: "var(--color-on-primary)" }}>
      {/* Top Navbar */}
      <Navbar variant="dark" />

      {/* Hero Section */}
      <section
        style={{
          position: "relative",
          paddingTop: "96px",
          paddingBottom: "112px",
          overflow: "hidden",
          borderBottom: "1px solid var(--color-hairline-dark)",
        }}
      >
        <div className="container container-wide">
          <div style={{ maxWidth: "800px", position: "relative", zIndex: 1 }}>
            {/* Pill Eyebrow */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "var(--space-xl)" }}>
              <span
                className="pill-tag pill-tag-mint"
                style={{ fontSize: "12px", fontWeight: 600, padding: "6px 14px" }}
              >
                Next-Gen Indian Commerce
              </span>
              <span
                className="pill-tag pill-tag-shade"
                style={{ fontSize: "12px", color: "var(--color-shade-40)" }}
              >
                FastAPI &bull; pgvector &bull; Next.js
              </span>
            </div>

            {/* Display Headline */}
            <h1
              className="text-display-xxl"
              style={{
                color: "var(--color-on-primary)",
                lineHeight: "1.02",
                marginBottom: "var(--space-xl)",
                letterSpacing: "-0.04em",
              }}
            >
              The marketplace<br />
              built for <span style={{ color: "var(--color-aloe-10)" }}>Bharat.</span>
            </h1>

            {/* Sub-Headline */}
            <p
              className="text-body-lg"
              style={{
                color: "var(--color-shade-40)",
                maxWidth: "600px",
                lineHeight: "1.65",
                marginBottom: "var(--space-xxl)",
                fontSize: "19px",
              }}
            >
              A dual-role commerce engine unifying customer discovery with
              autonomous seller operations. Shop authentic products or scale
              your business to millions of buyers nationwide.
            </p>

            {/* Dual Journey Action Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "var(--space-lg)",
                maxWidth: "680px",
              }}
            >
              {/* Customer Journey Card */}
              <Link
                href="/customer/home"
                id="hero-cta-customer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-xl)",
                  borderRadius: "var(--radius-xl)",
                  backgroundColor: "var(--color-canvas-night-elevated)",
                  border: "1px solid var(--color-hairline-dark)",
                  textDecoration: "none",
                  transition: "all var(--duration-normal) var(--ease-out)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-on-primary)",
                    }}
                  >
                    <ShoppingBag size={22} />
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: "17px",
                        fontWeight: 600,
                        color: "var(--color-on-primary)",
                        margin: 0,
                      }}
                    >
                      Shop Catalog
                    </h2>
                    <p
                      className="text-caption"
                      style={{ color: "var(--color-shade-40)", marginTop: "2px" }}
                    >
                      Browse verified products &rarr;
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--color-shade-50)" />
              </Link>

              {/* Seller Journey Card */}
              <Link
                href="/seller/signup"
                id="hero-cta-seller"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "var(--space-xl)",
                  borderRadius: "var(--radius-xl)",
                  backgroundColor: "rgba(193, 251, 212, 0.05)",
                  border: "1px solid rgba(193, 251, 212, 0.25)",
                  textDecoration: "none",
                  transition: "all var(--duration-normal) var(--ease-out)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: "var(--color-aloe-10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-ink)",
                    }}
                  >
                    <Store size={22} />
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: "17px",
                        fontWeight: 600,
                        color: "var(--color-on-primary)",
                        margin: 0,
                      }}
                    >
                      Start Selling
                    </h2>
                    <p
                      className="text-caption"
                      style={{ color: "var(--color-aloe-10)", marginTop: "2px" }}
                    >
                      Zero-fee merchant onboarding &rarr;
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} color="var(--color-aloe-10)" />
              </Link>
            </div>
          </div>
        </div>

        {/* Ambient Radial Glow */}
        <div
          style={{
            position: "absolute",
            top: "-10%",
            right: "-10%",
            width: "65vw",
            height: "80vh",
            background:
              "radial-gradient(circle at center, rgba(193, 251, 212, 0.06) 0%, rgba(0, 0, 0, 0) 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
          aria-hidden="true"
        />
      </section>

      {/* Real-time Metrics Bar */}
      <section
        style={{
          borderBottom: "1px solid var(--color-hairline-dark)",
          backgroundColor: "var(--color-canvas-night)",
          paddingBlock: "var(--space-xxl)",
        }}
        aria-label="Platform Statistics"
      >
        <div className="container container-wide">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "var(--space-xl)",
            }}
          >
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "var(--space-md) var(--space-lg)",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--color-surface-elevated-dark)",
                      color: "var(--color-aloe-10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "26px",
                        fontWeight: 700,
                        color: "var(--color-on-primary)",
                        letterSpacing: "-0.5px",
                        lineHeight: "1.1",
                      }}
                    >
                      {stat.value}
                    </p>
                    <p
                      className="text-caption"
                      style={{ color: "var(--color-shade-50)", marginTop: "2px" }}
                    >
                      {stat.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Category Discovery Showcase */}
      <section
        style={{
          paddingBlock: "var(--space-huge)",
          borderBottom: "1px solid var(--color-hairline-dark)",
        }}
      >
        <div className="container container-wide">
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: "var(--space-xxl)",
            }}
          >
            <div>
              <span
                className="pill-tag pill-tag-shade"
                style={{ marginBottom: "var(--space-md)", display: "inline-flex" }}
              >
                Curated Collections
              </span>
              <h2 className="text-display-md" style={{ color: "var(--color-on-primary)" }}>
                Explore by Category
              </h2>
            </div>

            <Link
              href="/customer/home"
              className="btn btn-outline-dark btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>View All Categories</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--space-lg)",
            }}
          >
            {CATEGORIES_DATA.map((cat) => (
              <Link
                key={cat.id}
                href={`/customer/home?category=${encodeURIComponent(cat.name)}`}
                style={{
                  position: "relative",
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  aspectRatio: "16/10",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "var(--space-xl)",
                  border: "1px solid var(--color-hairline-dark)",
                }}
              >
                <img
                  src={cat.imageUrl}
                  alt={cat.name}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    zIndex: 0,
                    filter: "brightness(0.65)",
                    transition: "transform var(--duration-slow) var(--ease-out)",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#ffffff", margin: 0 }}>
                    {cat.name}
                  </h3>
                  <p style={{ fontSize: "13px", color: "rgba(255, 255, 255, 0.75)", margin: 0 }}>
                    {cat.itemCount.toLocaleString("en-IN")} Products
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section
        style={{
          paddingBlock: "var(--space-huge)",
          borderBottom: "1px solid var(--color-hairline-dark)",
        }}
      >
        <div className="container container-wide">
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginBottom: "var(--space-xxl)",
            }}
          >
            <div>
              <span
                className="pill-tag pill-tag-mint"
                style={{ marginBottom: "var(--space-md)", display: "inline-flex" }}
              >
                Top Verified Picks
              </span>
              <h2 className="text-display-md" style={{ color: "var(--color-on-primary)" }}>
                Trending Across India
              </h2>
            </div>
            <Link
              href="/customer/home"
              className="btn btn-outline-dark btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <span>Explore All Products</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-xl)",
            }}
          >
            {PRODUCTS_DATA.slice(0, 4).map((product) => (
              <div
                key={product.id}
                style={{
                  backgroundColor: "var(--color-canvas-light)",
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                }}
              >
                <Link
                  href={`/customer/products/${product.id}`}
                  style={{ textDecoration: "none", color: "var(--color-ink)" }}
                >
                  <div style={{ aspectRatio: "1/1", overflow: "hidden" }}>
                    <img
                      src={product.primaryImageUrl}
                      alt={product.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ padding: "var(--space-lg)" }}>
                    <p className="text-eyebrow" style={{ color: "var(--color-shade-50)" }}>
                      {product.brand}
                    </p>
                    <h3
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        margin: "4px 0 8px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {product.name}
                    </h3>
                    <p style={{ fontSize: "17px", fontWeight: 700, margin: 0 }}>
                      &#8377;{product.price.toLocaleString("en-IN")}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Architecture & Value Props */}
      <section style={{ paddingBlock: "var(--space-huge)" }}>
        <div className="container container-wide">
          <div style={{ textAlign: "center", maxWidth: "640px", margin: "0 auto var(--space-huge)" }}>
            <span
              className="pill-tag pill-tag-shade"
              style={{ marginBottom: "var(--space-md)", display: "inline-flex" }}
            >
              Enterprise Engineering
            </span>
            <h2 className="text-display-md" style={{ color: "var(--color-on-primary)" }}>
              Engineered for Scale &amp; Trust
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "var(--space-xl)",
            }}
          >
            {VALUE_PROPS.map((prop) => {
              const Icon = prop.icon;
              return (
                <div
                  key={prop.title}
                  className="card-cinematic"
                  style={{ padding: "var(--space-xxl)", display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: "var(--color-surface-elevated-dark)",
                      color: "var(--color-aloe-10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={24} strokeWidth={1.8} />
                  </div>
                  <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--color-on-primary)", margin: 0 }}>
                    {prop.title}
                  </h3>
                  <p
                    className="text-body-md"
                    style={{ color: "var(--color-shade-40)", lineHeight: 1.6, margin: 0 }}
                  >
                    {prop.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Merchant Callout Banner */}
      <section
        style={{
          backgroundColor: "var(--color-aloe-10)",
          color: "var(--color-ink)",
          paddingBlock: "88px",
        }}
      >
        <div className="container" style={{ textAlign: "center", maxWidth: "680px" }}>
          <span
            className="pill-tag"
            style={{
              backgroundColor: "var(--color-ink)",
              color: "var(--color-on-primary)",
              marginBottom: "var(--space-lg)",
              display: "inline-flex",
            }}
          >
            For Indian Merchants
          </span>
          <h2
            className="text-display-lg"
            style={{ color: "var(--color-ink)", marginBottom: "var(--space-lg)" }}
          >
            Turn your inventory into<br />a high-velocity business.
          </h2>
          <p
            className="text-body-lg"
            style={{ color: "var(--color-shade-60)", marginBottom: "var(--space-xxl)" }}
          >
            Join 54,000+ verified sellers on Vyapari. Automated GST invoicing,
            integrated shipping, and zero upfront listing costs.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-md)", flexWrap: "wrap" }}>
            <Link
              href="/seller/signup"
              id="banner-seller-signup-btn"
              className="btn btn-primary btn-lg"
              style={{
                backgroundColor: "var(--color-ink)",
                color: "var(--color-on-primary)",
              }}
            >
              Start Selling Today
            </Link>
            <Link
              href="/seller/login"
              id="banner-seller-login-btn"
              className="btn btn-outline-light btn-lg"
              style={{
                borderColor: "var(--color-ink)",
                color: "var(--color-ink)",
              }}
            >
              Sign In to Merchant Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer variant="dark" />
    </main>
  );
}
