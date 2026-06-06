import { Link } from "@tanstack/react-router";
import { Star, GitCompare } from "lucide-react";
import { toast } from "sonner";

import { compare, useCompare } from "@/lib/compare";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  title: string;
  slug: string;
  short_description?: string | null;
  price_cents: number;
  compare_at_cents?: number | null;
  brand?: string | null;
  rating?: number | null;
  review_count?: number | null;
  images?: unknown;
  stock?: number | null;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProductCard({ product }: { product: Product }) {
  const compareItems = useCompare();
  const inCompare = compareItems.some((i) => i.productId === product.id);
  const firstImage =
    Array.isArray(product.images) && (product.images as unknown[]).length > 0
      ? ((product.images as unknown[])[0] as string)
      : null;
  const stock = product.stock ?? null;
  const outOfStock = (stock ?? 1) <= 0;
  const lowStock = stock !== null && stock > 0 && stock <= 5;
  const onSale =
    !!product.compare_at_cents && (product.compare_at_cents ?? 0) > product.price_cents;

  return (
    <Link
      to="/shop/$slug"
      params={{ slug: product.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-glow)] animate-fade-in"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[image:var(--gradient-hero)]">
        {firstImage ? (
          <img
            src={firstImage}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-6xl font-bold text-foreground/10 transition-transform duration-500 group-hover:scale-110">
            {product.brand?.[0] ?? product.title[0]}
          </div>
        )}
        {onSale && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            Save{" "}
            {Math.round(
              ((product.compare_at_cents! - product.price_cents) / product.compare_at_cents!) * 100,
            )}
            %
          </span>
        )}
        {outOfStock && (
          <span className="absolute left-3 bottom-3 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-medium text-destructive-foreground">
            Out of stock
          </span>
        )}
        {!outOfStock && lowStock && (
          <span className="absolute left-3 bottom-3 rounded-full bg-amber-500/95 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
            Only {stock} left
          </span>
        )}

        <button
          type="button"
          aria-label={inCompare ? "Remove from compare" : "Add to compare"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const r = compare.toggle({
              productId: product.id,
              slug: product.slug,
              title: product.title,
              brand: product.brand ?? null,
              priceCents: product.price_cents,
              imageUrl: firstImage,
            });
            if (r.full) toast.error("Compare is full (max 4)");
            else if (r.added) toast.success("Added to compare");
            else toast.success("Removed from compare");
          }}
          className={cn(
            "absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-border/60 backdrop-blur-md transition-colors",
            inCompare
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background/80 text-muted-foreground hover:text-foreground",
          )}
        >
          <GitCompare className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {product.brand && (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {product.brand}
          </span>
        )}
        <h3 className="font-medium leading-tight group-hover:text-primary transition-colors">
          {product.title}
        </h3>
        {product.short_description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.short_description}</p>
        )}
        <div className="mt-auto flex items-end justify-between pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold">{formatPrice(product.price_cents)}</span>
            {onSale && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compare_at_cents!)}
              </span>
            )}
          </div>
          {product.rating && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-primary text-primary" />
              {Number(product.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
