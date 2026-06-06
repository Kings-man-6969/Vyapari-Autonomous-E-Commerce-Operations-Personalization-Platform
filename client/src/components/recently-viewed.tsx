import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { useRecentlyViewed } from "@/lib/recently-viewed";
import { formatCents } from "@/lib/cart";

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const items = useRecentlyViewed().filter((i) => i.productId !== excludeId);
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold tracking-tight">Recently viewed</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((i) => (
          <Link
            key={i.productId}
            to="/shop/$slug"
            params={{ slug: i.slug }}
            className="group w-44 shrink-0 rounded-xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/40"
          >
            <div className="aspect-square overflow-hidden rounded-lg bg-[image:var(--gradient-hero)]">
              {i.imageUrl ? (
                <img
                  src={i.imageUrl}
                  alt={i.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-3xl font-bold text-foreground/10">
                  {i.brand?.[0] ?? i.title[0]}
                </div>
              )}
            </div>
            <div className="mt-2 line-clamp-1 text-sm font-medium group-hover:text-primary">
              {i.title}
            </div>
            <div className="text-xs text-muted-foreground">{formatCents(i.priceCents)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
