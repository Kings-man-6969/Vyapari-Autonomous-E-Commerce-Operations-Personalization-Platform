"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Package,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import SellerSidebar from "@/components/SellerSidebar";
import { PRODUCTS_DATA, ProductItem } from "@/lib/data";
import { apiRequest, getAccessToken } from "@/lib/api";

function toProductItem(p: any): ProductItem {
  const primaryImg = (p.images && p.images.find((img: any) => img.is_primary)?.url) || (p.images && p.images[0]?.url) || p.image || p.primaryImageUrl || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80";
  return {
    id: p.id || "prod-default",
    name: p.name || "Product",
    slug: p.slug || (p.name ? p.name.toLowerCase().replace(/\s+/g, "-") : "product"),
    brand: p.brand || "My Brand",
    category: p.category || "General",
    categoryId: p.categoryId || "cat-general",
    price: Number(p.price || 999),
    originalPrice: Number(p.originalPrice || p.price || 999),
    discountPercentage: Number(p.discountPercentage || 0),
    stockQty: Number(p.stock_qty || p.stockQty || 10),
    rating: Number(p.rating || 5.0),
    reviewCount: Number(p.review_count || p.reviewCount || 0),
    primaryImageUrl: primaryImg,
    images: Array.isArray(p.images) ? p.images.map((im: any) => (typeof im === "string" ? im : im.url)) : [primaryImg],
    description: p.description || "Premium product listed on Vyapari marketplace.",
    features: Array.isArray(p.features) ? p.features : ["Standard Quality Assurance", "Fast Pan-India Delivery"],
    specs: p.specs || { Brand: p.brand || "My Brand" },
    sellerName: p.sellerName || "My Store",
    sellerId: p.sellerId || "seller-01",
    sellerRating: Number(p.sellerRating || 4.9),
  };
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>(PRODUCTS_DATA);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadSellerProducts() {
      const token = getAccessToken();
      if (!token) return;
      try {
        const liveProducts = await apiRequest<any[]>("/api/v1/seller/products");
        if (Array.isArray(liveProducts)) {
          const mapped: ProductItem[] = liveProducts.map(toProductItem);
          setProducts(mapped);
        }
      } catch (err) {
        console.warn("Could not load backend seller products, using sample listings:", err);
      }
    }
    loadSellerProducts();
  }, []);

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to archive this product listing?")) {
      const token = getAccessToken();
      if (token) {
        try {
          await apiRequest(`/api/v1/seller/products/${id}`, { method: "DELETE" });
        } catch (err) {
          console.warn("Live product delete error:", err);
        }
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  }

  const filtered = products.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div style={{ display: "flex", minHeight: "100svh", backgroundColor: "var(--color-canvas-cream)" }}>
      <SellerSidebar />

      <main style={{ flex: 1, padding: "var(--space-xxl)", overflowY: "auto" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-xxl)",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
              Product Catalog
            </h1>
            <p className="text-caption" style={{ color: "var(--color-shade-50)", marginTop: "4px" }}>
              Manage your live inventory, pricing, and product status
            </p>
          </div>

          <Link
            href="/seller/products/new"
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} />
            <span>Add New Product</span>
          </Link>
        </div>

        {/* Search and Filters Bar */}
        <div
          style={{
            backgroundColor: "var(--color-canvas-light)",
            border: "1px solid var(--color-hairline-light)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-lg)",
            marginBottom: "var(--space-xl)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative", flex: 1, maxWidth: "380px" }}>
            <Search
              size={16}
              color="var(--color-shade-40)"
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="search"
              placeholder="Search products by title or brand…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                height: "38px",
                paddingLeft: "36px",
                paddingRight: "12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-hairline-light)",
                backgroundColor: "var(--color-canvas-cream)",
                fontSize: "13px",
                outline: "none",
              }}
            />
          </div>

          <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
            Showing {filtered.length} listings
          </span>
        </div>

        {/* Product Table */}
        <div
          style={{
            backgroundColor: "var(--color-canvas-light)",
            border: "1px solid var(--color-hairline-light)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            boxShadow: "var(--shadow-1)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--color-canvas-cream)", borderBottom: "1px solid var(--color-hairline-light)" }}>
                <th style={{ padding: "14px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  PRODUCT
                </th>
                <th style={{ padding: "14px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  CATEGORY
                </th>
                <th style={{ padding: "14px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  PRICE (INR)
                </th>
                <th style={{ padding: "14px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  STOCK
                </th>
                <th style={{ padding: "14px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px" }}>
                  STATUS
                </th>
                <th style={{ padding: "14px 20px", fontWeight: 600, color: "var(--color-shade-60)", fontSize: "12px", textAlign: "right" }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  style={{ borderBottom: "1px solid var(--color-hairline-light)", transition: "background-color 0.15s" }}
                >
                  {/* Product Info */}
                  <td style={{ padding: "16px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <img
                        src={product.primaryImageUrl}
                        alt={product.name}
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "var(--radius-md)",
                          objectFit: "cover",
                          flexShrink: 0,
                          backgroundColor: "var(--color-canvas-cream)",
                        }}
                      />
                      <div>
                        <p style={{ fontWeight: 600, color: "var(--color-ink)", margin: 0, fontSize: "14px" }}>
                          {product.name}
                        </p>
                        <p className="text-caption" style={{ color: "var(--color-shade-40)", marginTop: "2px" }}>
                          Brand: {product.brand}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{ padding: "16px 20px", color: "var(--color-shade-60)" }}>
                    {product.category}
                  </td>

                  {/* Price */}
                  <td style={{ padding: "16px 20px", fontWeight: 600, color: "var(--color-ink)" }}>
                    &#8377;{product.price.toLocaleString("en-IN")}
                  </td>

                  {/* Stock */}
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      style={{
                        color: product.stockQty > 10 ? "#16a34a" : "#dc2626",
                        fontWeight: 600,
                      }}
                    >
                      {product.stockQty} units
                    </span>
                  </td>

                  {/* Status */}
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      className="pill-tag"
                      style={{
                        backgroundColor: "#f0fdf4",
                        color: "#16a34a",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      Active
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "8px" }}>
                      <Link
                        href={`/customer/products/${product.id}`}
                        target="_blank"
                        className="btn btn-outline-light btn-sm"
                        style={{ padding: "6px 8px" }}
                        title="View on Customer Store"
                      >
                        <ExternalLink size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product.id)}
                        className="btn btn-outline-light btn-sm"
                        style={{ padding: "6px 8px", color: "#dc2626", borderColor: "#fecaca" }}
                        title="Archive product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
