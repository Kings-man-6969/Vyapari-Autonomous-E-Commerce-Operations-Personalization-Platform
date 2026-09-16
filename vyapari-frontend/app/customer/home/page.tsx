"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  ArrowUpDown,
  Check,
  Search,
  X,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { CATEGORIES_DATA, PRODUCTS_DATA, ProductItem } from "@/lib/data";
import { apiRequest } from "@/lib/api";

export default function CustomerHomePage() {
  const [products, setProducts] = useState<ProductItem[]>(PRODUCTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [priceMax, setPriceMax] = useState<number>(20000);
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [cartCount, setCartCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch from backend API if available, or fallback to rich mock data
  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await apiRequest<{ items: any[] }>("/api/v1/catalog/products?page_size=20");
        if (res?.items && Array.isArray(res.items) && res.items.length > 0) {
          const mapped: ProductItem[] = res.items.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            brand: item.brand || "Vyapari Verified",
            category: "General",
            categoryId: item.category_id || "cat-general",
            price: Number(item.price),
            originalPrice: Number(item.price) * 1.25,
            discountPercentage: 20,
            stockQty: item.stock_qty || 10,
            rating: item.average_rating || 4.8,
            reviewCount: 45,
            primaryImageUrl:
              item.primary_image_url ||
              "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
            images: [
              item.primary_image_url ||
                "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
            ],
            description: item.description || "",
            features: ["Verified Quality", "Fast Dispatch"],
            specs: { Brand: item.brand || "Vyapari" },
            sellerName: "Verified Merchant",
            sellerId: item.seller_id,
            sellerRating: 4.8,
          }));
          setProducts(mapped);
        }
      } catch {
        // Fallback already set to rich mock data
      }
    }
    loadCatalog();
  }, []);

  function handleAddToCart(product: ProductItem) {
    setCartCount((c) => c + 1);
    setToastMessage(`Added "${product.name}" to cart`);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (selectedCategory !== "All" && p.category !== selectedCategory) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q);
          if (!matches) return false;
        }
        if (p.price > priceMax) return false;
        if (onlyInStock && p.stockQty <= 0) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.price - b.price;
        if (sortBy === "price_desc") return b.price - a.price;
        if (sortBy === "rating") return b.rating - a.rating;
        return 0; // "featured"
      });
  }, [products, selectedCategory, searchQuery, sortBy, priceMax, onlyInStock]);

  return (
    <div className="canvas-light" style={{ minHeight: "100svh", display: "flex", flexDirection: "column" }}>
      {/* Toast Notification */}
      {toastMessage && (
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
            fontWeight: 500,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <Check size={16} color="var(--color-aloe-10)" />
          <span>{toastMessage}</span>
          <Link
            href="/customer/cart"
            style={{
              color: "var(--color-aloe-10)",
              textDecoration: "underline",
              marginLeft: "6px",
              fontWeight: 600,
            }}
          >
            View Cart
          </Link>
        </div>
      )}

      {/* Navbar */}
      <Navbar variant="light" cartCount={cartCount} />

      {/* Main Content Area */}
      <main style={{ flex: 1, paddingBlock: "var(--space-xxl)" }}>
        <div className="container container-wide">
          {/* Header Banner */}
          <div
            style={{
              backgroundColor: "var(--color-canvas-cream)",
              border: "1px solid var(--color-hairline-light)",
              borderRadius: "var(--radius-xl)",
              padding: "var(--space-xxl) var(--space-xxl)",
              marginBottom: "var(--space-xxl)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-xl)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <span
                className="pill-tag pill-tag-mint"
                style={{ marginBottom: "var(--space-sm)", display: "inline-flex" }}
              >
                Vyapari Marketplace
              </span>
              <h1 className="text-display-md" style={{ color: "var(--color-ink)", margin: 0 }}>
                Explore Verified Products
              </h1>
              <p
                className="text-body-md"
                style={{ color: "var(--color-shade-50)", marginTop: "6px" }}
              >
                Showing {filteredProducts.length} results from trusted merchants across India
              </p>
            </div>

            {/* Category Quick Chips */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setSelectedCategory("All")}
                className={`btn btn-sm ${selectedCategory === "All" ? "btn-primary" : "btn-outline-light"}`}
                style={{ borderRadius: "var(--radius-pill)" }}
              >
                All Categories
              </button>
              {CATEGORIES_DATA.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`btn btn-sm ${selectedCategory === cat.name ? "btn-primary" : "btn-outline-light"}`}
                  style={{ borderRadius: "var(--radius-pill)" }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active Search Badge */}
          {searchQuery && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "var(--space-lg)",
              }}
            >
              <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                Filtering by:
              </span>
              <span
                className="pill-tag"
                style={{
                  backgroundColor: "var(--color-canvas-cream)",
                  border: "1px solid var(--color-hairline-light)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>&quot;{searchQuery}&quot;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ display: "flex", alignItems: "center", padding: 0 }}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              </span>
            </div>
          )}

          {/* Layout Grid: Sidebar Filters + Products Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "240px 1fr",
              gap: "var(--space-xxl)",
              alignItems: "start",
            }}
          >
            {/* Sidebar Filters */}
            <aside
              style={{
                backgroundColor: "var(--color-canvas-light)",
                border: "1px solid var(--color-hairline-light)",
                borderRadius: "var(--radius-xl)",
                padding: "var(--space-xl)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-xl)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid var(--color-hairline-light)",
                  paddingBottom: "var(--space-md)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <SlidersHorizontal size={16} />
                  <span style={{ fontSize: "15px", fontWeight: 600 }}>Filters</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory("All");
                    setSearchQuery("");
                    setPriceMax(20000);
                    setOnlyInStock(false);
                  }}
                  style={{
                    fontSize: "12px",
                    color: "var(--color-shade-50)",
                    textDecoration: "underline",
                  }}
                >
                  Reset
                </button>
              </div>

              {/* Price Filter */}
              <div>
                <label
                  htmlFor="price-slider"
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--color-ink)",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  Max Price: &#8377;{priceMax.toLocaleString("en-IN")}
                </label>
                <input
                  id="price-slider"
                  type="range"
                  min={1000}
                  max={20000}
                  step={500}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--color-ink)" }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "var(--color-shade-40)",
                    marginTop: "4px",
                  }}
                >
                  <span>&#8377;1,000</span>
                  <span>&#8377;20,000+</span>
                </div>
              </div>

              {/* Stock Filter Checkbox */}
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    style={{ accentColor: "var(--color-ink)" }}
                  />
                  <span>In Stock Items Only</span>
                </label>
              </div>
            </aside>

            {/* Products Area */}
            <div>
              {/* Controls Bar: Sort Dropdown */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-xl)",
                  paddingBottom: "var(--space-md)",
                  borderBottom: "1px solid var(--color-hairline-light)",
                }}
              >
                <span className="text-caption" style={{ color: "var(--color-shade-50)" }}>
                  Showing {filteredProducts.length} products
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ArrowUpDown size={15} color="var(--color-shade-50)" />
                  <label htmlFor="sort-select" className="sr-only">
                    Sort by
                  </label>
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--color-hairline-light)",
                      backgroundColor: "var(--color-canvas-light)",
                      fontSize: "13px",
                      color: "var(--color-ink)",
                      outline: "none",
                    }}
                  >
                    <option value="featured">Sort: Featured Picks</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="rating">Customer Rating</option>
                  </select>
                </div>
              </div>

              {/* Product Grid */}
              {filteredProducts.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "var(--space-huge) var(--space-xl)",
                    backgroundColor: "var(--color-canvas-light)",
                    border: "1px dashed var(--color-hairline-light)",
                    borderRadius: "var(--radius-xl)",
                  }}
                >
                  <ShoppingBag size={44} color="var(--color-shade-40)" style={{ margin: "0 auto 12px" }} />
                  <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-ink)", margin: 0 }}>
                    No products match your criteria
                  </h2>
                  <p
                    className="text-caption"
                    style={{ color: "var(--color-shade-50)", marginTop: "6px", maxWidth: "340px", margin: "6px auto 16px" }}
                  >
                    Try adjusting your price range, clearing the search query, or selecting another category.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory("All");
                      setSearchQuery("");
                      setPriceMax(20000);
                      setOnlyInStock(false);
                    }}
                    className="btn btn-primary btn-sm"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                    gap: "var(--space-xl)",
                  }}
                >
                  {filteredProducts.map((p) => (
                    <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer variant="light" />
    </div>
  );
}
