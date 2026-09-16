"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  ShoppingBag,
  Zap,
  Check,
  ChevronRight,
  Store,
  Share2,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { PRODUCTS_DATA, ProductItem } from "@/lib/data";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  // Find product by id or fallback to first product
  const product: ProductItem =
    PRODUCTS_DATA.find((p) => p.id === resolvedParams.id) || PRODUCTS_DATA[0];

  const [selectedImage, setSelectedImage] = useState(
    product.images[0] || product.primaryImageUrl
  );
  const [selectedVariant, setSelectedVariant] = useState<string>(
    product.variants?.[0]?.options?.[0]?.value || ""
  );
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [addedToast, setAddedToast] = useState(false);

  function handleAddToCart() {
    setCartCount((c) => c + quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 3000);
  }

  function handleBuyNow() {
    handleAddToCart();
    router.push("/customer/cart");
  }

  const discount =
    product.discountPercentage ||
    (product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0);

  return (
    <div className="canvas-light" style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      {/* Toast */}
      {addedToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "var(--color-ink)",
            color: "var(--color-on-primary)",
            padding: "12px 20px",
            borderRadius: "var(--radius-pill)",
            boxShadow: "var(--shadow-3)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 1000,
            fontSize: "14px",
          }}
        >
          <Check size={16} color="var(--color-aloe-10)" />
          <span>Added {quantity} &times; &quot;{product.name}&quot; to your cart</span>
          <Link
            href="/customer/cart"
            style={{ color: "var(--color-aloe-10)", fontWeight: 600, textDecoration: "underline", marginLeft: "4px" }}
          >
            Go to Cart
          </Link>
        </div>
      )}

      {/* Navbar */}
      <Navbar variant="light" cartCount={cartCount} />

      {/* Main Container */}
      <main style={{ flex: 1, paddingBlock: "var(--space-xl)" }}>
        <div className="container container-wide">
          {/* Breadcrumb Navigation */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "var(--color-shade-50)",
              marginBottom: "var(--space-xl)",
            }}
          >
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              Home
            </Link>
            <ChevronRight size={13} />
            <Link href="/customer/home" style={{ color: "inherit", textDecoration: "none" }}>
              {product.category}
            </Link>
            <ChevronRight size={13} />
            <span style={{ color: "var(--color-ink)", fontWeight: 500 }}>{product.brand}</span>
          </nav>

          {/* Product Hero: Image Gallery + Buy Box */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-huge)",
              marginBottom: "var(--space-huge)",
              alignItems: "start",
            }}
          >
            {/* Left: Image Gallery */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
              {/* Main Image */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1/1",
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  backgroundColor: "var(--color-canvas-cream)",
                  border: "1px solid var(--color-hairline-light)",
                }}
              >
                <img
                  src={selectedImage}
                  alt={product.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>

              {/* Thumbnails */}
              {product.images && product.images.length > 1 && (
                <div style={{ display: "flex", gap: "10px" }}>
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImage(img)}
                      style={{
                        width: "72px",
                        height: "72px",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden",
                        border:
                          selectedImage === img
                            ? "2px solid var(--color-ink)"
                            : "1px solid var(--color-hairline-light)",
                        padding: 0,
                        backgroundColor: "var(--color-canvas-cream)",
                        cursor: "pointer",
                      }}
                    >
                      <img
                        src={img}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Buy Box & Product Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    className="pill-tag pill-tag-shade"
                    style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px" }}
                  >
                    {product.brand}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Product link copied to clipboard!");
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "var(--color-shade-50)",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Share2 size={14} />
                    <span>Share</span>
                  </button>
                </div>

                <h1
                  style={{
                    fontSize: "26px",
                    fontWeight: 650,
                    color: "var(--color-ink)",
                    lineHeight: 1.25,
                    margin: "8px 0 12px",
                  }}
                >
                  {product.name}
                </h1>

                {/* Rating summary */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      padding: "3px 8px",
                      borderRadius: "var(--radius-xs)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    <Star size={13} fill="#92400e" stroke="#92400e" />
                    <span>{product.rating.toFixed(1)}</span>
                  </div>
                  <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                    {product.reviewCount} verified buyer reviews
                  </span>
                </div>
              </div>

              {/* Price Box */}
              <div
                style={{
                  padding: "var(--space-lg)",
                  backgroundColor: "var(--color-canvas-cream)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-hairline-light)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "30px",
                    fontWeight: 700,
                    color: "var(--color-ink)",
                  }}
                >
                  &#8377;{product.price.toLocaleString("en-IN")}
                </span>

                {product.originalPrice > product.price && (
                  <>
                    <span
                      style={{
                        fontSize: "16px",
                        color: "var(--color-shade-40)",
                        textDecoration: "line-through",
                      }}
                    >
                      &#8377;{product.originalPrice.toLocaleString("en-IN")}
                    </span>
                    <span
                      className="pill-tag pill-tag-mint"
                      style={{ fontSize: "11px", fontWeight: 700 }}
                    >
                      Save {discount}%
                    </span>
                  </>
                )}

                <span
                  className="text-micro"
                  style={{ color: "var(--color-shade-50)", marginLeft: "auto" }}
                >
                  Inclusive of all taxes
                </span>
              </div>

              {/* Variant Selector */}
              {product.variants && product.variants.length > 0 && (
                <div>
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--color-ink)",
                      marginBottom: "8px",
                      display: "block",
                    }}
                  >
                    Select {product.variants[0].type}:
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {product.variants[0].options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedVariant(opt.value)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "var(--radius-md)",
                          fontSize: "13px",
                          fontWeight: selectedVariant === opt.value ? 600 : 450,
                          border:
                            selectedVariant === opt.value
                              ? "2px solid var(--color-ink)"
                              : "1px solid var(--color-hairline-light)",
                          backgroundColor:
                            selectedVariant === opt.value
                              ? "var(--color-canvas-light)"
                              : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity + Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <label
                    style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-ink)" }}
                  >
                    Quantity:
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid var(--color-hairline-light)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={{
                        width: "32px",
                        height: "32px",
                        backgroundColor: "var(--color-canvas-cream)",
                        border: "none",
                        fontSize: "16px",
                        cursor: "pointer",
                      }}
                    >
                      -
                    </button>
                    <span
                      style={{
                        padding: "0 14px",
                        fontSize: "14px",
                        fontWeight: 600,
                      }}
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      style={{
                        width: "32px",
                        height: "32px",
                        backgroundColor: "var(--color-canvas-cream)",
                        border: "none",
                        fontSize: "16px",
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>

                  <span
                    className="text-caption"
                    style={{ color: "#16a34a", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Check size={14} /> In Stock (Dispatches in 24 hrs)
                  </span>
                </div>

                <div style={{ display: "flex", gap: "var(--space-md)" }}>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    id="btn-add-to-cart"
                    className="btn btn-outline-light btn-lg"
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      borderColor: "var(--color-ink)",
                    }}
                  >
                    <ShoppingBag size={18} />
                    <span>Add to Cart</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    id="btn-buy-now"
                    className="btn btn-primary btn-lg"
                    style={{
                      flex: 1,
                      justifyContent: "center",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Zap size={18} />
                    <span>Buy Now</span>
                  </button>
                </div>
              </div>

              {/* Seller Trust Card */}
              <div
                style={{
                  padding: "var(--space-lg)",
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: "var(--color-canvas-cream)",
                  border: "1px solid var(--color-hairline-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "var(--color-canvas-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid var(--color-hairline-light)",
                    }}
                  >
                    <Store size={20} color="var(--color-shade-60)" />
                  </div>
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--color-ink)" }}>
                      {product.sellerName}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                      <ShieldCheck size={13} color="#16a34a" />
                      <span className="text-micro" style={{ color: "#16a34a", fontWeight: 600 }}>
                        GSTIN Verified Seller
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--color-canvas-light)",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--color-hairline-light)",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {product.sellerRating} / 5.0 Rating
                </div>
              </div>

              {/* Fast Delivery Highlights */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "var(--space-md)",
                  paddingTop: "var(--space-sm)",
                  borderTop: "1px solid var(--color-hairline-light)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <Truck size={16} color="var(--color-shade-60)" />
                  <span>Free Express Delivery over &#8377;999</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <RotateCcw size={16} color="var(--color-shade-60)" />
                  <span>7 Days Return Guarantee</span>
                </div>
              </div>
            </div>
          </div>

          {/* Description & Technical Specifications */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr",
              gap: "var(--space-xxl)",
              borderTop: "1px solid var(--color-hairline-light)",
              paddingTop: "var(--space-xxl)",
              marginBottom: "var(--space-huge)",
            }}
          >
            {/* Description & Features */}
            <div>
              <h2 className="text-heading-md" style={{ marginBottom: "var(--space-md)" }}>
                Product Overview
              </h2>
              <p
                className="text-body-md"
                style={{ color: "var(--color-shade-60)", lineHeight: 1.7, marginBottom: "var(--space-xl)" }}
              >
                {product.description}
              </p>

              {product.features && product.features.length > 0 && (
                <>
                  <h3 className="text-heading-sm" style={{ marginBottom: "var(--space-md)" }}>
                    Key Features
                  </h3>
                  <ul style={{ display: "flex", flexDirection: "column", gap: "8px", paddingLeft: "20px" }}>
                    {product.features.map((f, i) => (
                      <li key={i} className="text-body-md" style={{ color: "var(--color-shade-60)" }}>
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Specifications Table */}
            {product.specs && (
              <div
                style={{
                  backgroundColor: "var(--color-canvas-light)",
                  border: "1px solid var(--color-hairline-light)",
                  borderRadius: "var(--radius-xl)",
                  padding: "var(--space-xl)",
                }}
              >
                <h3 className="text-heading-sm" style={{ marginBottom: "var(--space-md)" }}>
                  Technical Specifications
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Object.entries(product.specs).map(([key, val]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingBlock: "6px",
                        borderBottom: "1px solid var(--color-hairline-light)",
                        fontSize: "13px",
                      }}
                    >
                      <span style={{ color: "var(--color-shade-50)" }}>{key}</span>
                      <span style={{ fontWeight: 600, color: "var(--color-ink)", textAlign: "right" }}>
                        {val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer variant="light" />
    </div>
  );
}
