import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { listProducts, listCategories } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/product-card-skeleton";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  category: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/shop/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop electronics — Vyapari" },
      {
        name: "description",
        content:
          "Browse phones, laptops, audio gear, cameras, wearables and accessories from independent sellers on Vyapari.",
      },
      { property: "og:title", content: "Shop electronics — Vyapari" },
      {
        property: "og:description",
        content:
          "Browse phones, laptops, audio gear, cameras, wearables and accessories from independent sellers on Vyapari.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/shop" },
    ],
    links: [{ rel: "canonical", href: "/shop" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "/" },
            { "@type": "ListItem", position: 2, name: "Shop", item: "/shop" },
          ],
        }),
      },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");

  const products = useQuery({
    queryKey: ["products", search.category ?? null, search.q ?? null],
    queryFn: () => listProducts({ data: { category: search.category, q: search.q } }),
  });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });

  const activeCat = cats.data?.categories.find((c) => c.slug === search.category);
  const hasFilters = !!(search.category || search.q);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Marketplace"
        icon={SlidersHorizontal}
        title={activeCat ? activeCat.name : "Curated electronics"}
        description={
          activeCat
            ? `Browse ${activeCat.name.toLowerCase()} from verified independent sellers.`
            : "Hand-vetted gear from independent sellers — shipped fast, backed by a 30-day return."
        }
        actions={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: { ...search, q: q || undefined } });
            }}
            className="relative w-full sm:w-80"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="shop-search" className="sr-only">
              Search products
            </label>
            <Input
              id="shop-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, brands…"
              aria-label="Search products"
              className="pl-9"
            />
          </form>
        }
      />

      {/* Filters */}
      <div className="sticky top-16 z-20 -mx-4 mb-2 mt-2 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <FilterPill active={!search.category} to={{ ...search, category: undefined }} label="All" />
          {cats.data?.categories.map((c) => (
            <FilterPill
              key={c.id}
              active={search.category === c.slug}
              to={{ ...search, category: c.slug }}
              label={c.name}
            />
          ))}
          {hasFilters && (
            <Link
              to="/shop"
              search={{}}
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              <X className="h-3 w-3" /> Clear
            </Link>
          )}
        </div>
      </div>

      <section className="mt-6" aria-labelledby="all-products-heading">
        <h2 id="all-products-heading" className="sr-only">
          All products
        </h2>
        {products.isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : products.data && products.data.products.length > 0 ? (
          <>
            <div className="mb-4 text-xs text-muted-foreground">
              Showing {products.data.products.length} product
              {products.data.products.length === 1 ? "" : "s"}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products.data.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No matches found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search or clear filters to see everything.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link to="/shop" search={{}}>
                Clear filters
              </Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterPill({
  active,
  to,
  label,
}: {
  active: boolean;
  to: { category?: string; q?: string };
  label: string;
}) {
  return (
    <Link
      to="/shop"
      search={to}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-glow)]"
          : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
