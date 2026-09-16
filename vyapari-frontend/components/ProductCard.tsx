"use client";

import Link from "next/link";
import { Star, ShoppingBag, Check } from "lucide-react";
import { useState } from "react";
import { ProductItem } from "@/lib/data";

interface ProductCardProps {
  product: ProductItem;
  onAddToCart?: (product: ProductItem) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [added, setAdded] = useState(false);

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const discount =
    product.discountPercentage ||
    (product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0);

  return (
    <div
      className="card-product"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}
    >
      <Link
        href={`/customer/products/${product.id}`}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Product Image Container */}
        <div
          style={{
            position: "relative",
            aspectRatio: "1/1",
            width: "100%",
            overflow: "hidden",
            backgroundColor: "var(--color-canvas-cream)",
          }}
        >
          <img
            src={product.primaryImageUrl}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform var(--duration-slow) var(--ease-out)",
            }}
          />

          {/* Badges */}
          <div
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {product.isBestseller && (
              <span
                className="pill-tag"
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-on-primary)",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                Bestseller
              </span>
            )}
            {discount > 0 && (
              <span
                className="pill-tag pill-tag-mint"
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                {discount}% OFF
              </span>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div
          style={{
            padding: "var(--space-lg)",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
            gap: "var(--space-sm)",
          }}
        >
          <div>
            {product.brand && (
              <p
                className="text-eyebrow"
                style={{
                  color: "var(--color-shade-50)",
                  marginBottom: "4px",
                  fontSize: "11px",
                }}
              >
                {product.brand}
              </p>
            )}

            <h3
              style={{
                fontSize: "15px",
                fontWeight: 550,
                lineHeight: 1.35,
                color: "var(--color-ink)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                minHeight: "40px",
              }}
            >
              {product.name}
            </h3>
          </div>

          {/* Rating */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                backgroundColor: "#fef3c7",
                color: "#92400e",
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              <Star size={12} fill="#92400e" stroke="#92400e" />
              <span>{product.rating.toFixed(1)}</span>
            </div>
            <span
              className="text-micro"
              style={{ color: "var(--color-shade-40)" }}
            >
              ({product.reviewCount})
            </span>
          </div>

          {/* Price & Action Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "var(--space-xs)",
              paddingTop: "var(--space-sm)",
              borderTop: "1px solid var(--color-hairline-light)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--color-ink)",
                  }}
                >
                  &#8377;{product.price.toLocaleString("en-IN")}
                </span>
                {product.originalPrice > product.price && (
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--color-shade-40)",
                      textDecoration: "line-through",
                    }}
                  >
                    &#8377;{product.originalPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              aria-label={`Add ${product.name} to cart`}
              className="btn btn-outline-light btn-sm"
              style={{
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: added ? "var(--color-aloe-10)" : "transparent",
                borderColor: added ? "var(--color-aloe-10)" : "var(--color-hairline-light)",
              }}
            >
              {added ? (
                <>
                  <Check size={14} />
                  <span style={{ fontSize: "12px" }}>Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={14} />
                  <span style={{ fontSize: "12px" }}>Add</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Link>
    </div>
  );
}
