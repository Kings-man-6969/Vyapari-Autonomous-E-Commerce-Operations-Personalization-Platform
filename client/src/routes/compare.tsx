import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, ShoppingCart, GitCompare } from "lucide-react";
import { toast } from "sonner";

import { compare, useCompare } from "@/lib/compare";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cart, formatCents } from "@/lib/cart";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare products — Vyapari" }] }),
  component: ComparePage,
});

function ComparePage() {
  const items = useCompare();
  const ids = items.map((i) => i.productId);

  const { data } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["compare", ids.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title, slug, brand, price_cents, compare_at_cents, rating, review_count, stock, specs, images, seller_id, short_description")
        .in("id", ids);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const products = (data ?? []).slice().sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const allSpecKeys = Array.from(
    new Set(
      products.flatMap((p) =>
        p.specs && typeof p.specs === "object" ? Object.keys(p.specs as Record<string, unknown>) : [],
      ),
    ),
  );

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <PageHeader
          eyebrow="Compare"
          icon={GitCompare}
          align="center"
          title="Nothing to compare yet"
          description="Add products by tapping the compare button on any product card or detail page to put them side-by-side."
          actions={
            <Button asChild>
              <Link to="/shop">Browse products</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader
        eyebrow={`${products.length} product${products.length === 1 ? "" : "s"} selected`}
        icon={GitCompare}
        title="Compare side-by-side"
        description="Stack specs, pricing and stock to decide faster. Remove anything that's no longer in the running."
        actions={
          <Button variant="ghost" size="sm" onClick={() => compare.clear()}>
            Clear all
          </Button>
        }
      />


      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="w-40 px-3 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" />
              {products.map((p) => (
                <th key={p.id} className="px-3 py-3 text-left align-top">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/shop/$slug"
                      params={{ slug: p.slug }}
                      className="font-medium hover:text-primary"
                    >
                      {p.title}
                    </Link>
                    <button
                      onClick={() => compare.remove(p.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Remove from compare"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {p.brand && (
                    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                      {p.brand}
                    </div>
                  )}
                  <div className="mt-3 aspect-square w-32 overflow-hidden rounded-lg bg-[image:var(--gradient-hero)] grid place-items-center text-3xl font-bold text-foreground/10">
                    {p.brand?.[0] ?? p.title[0]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Price">
              {products.map((p) => (
                <td key={p.id} className="px-3 py-3 align-top">
                  <div className="text-lg font-semibold">{formatCents(p.price_cents)}</div>
                  {p.compare_at_cents && p.compare_at_cents > p.price_cents && (
                    <div className="text-xs text-muted-foreground line-through">
                      {formatCents(p.compare_at_cents)}
                    </div>
                  )}
                </td>
              ))}
            </Row>
            <Row label="Rating">
              {products.map((p) => (
                <td key={p.id} className="px-3 py-3 align-top">
                  {p.rating ? `${Number(p.rating).toFixed(1)} ★ (${p.review_count ?? 0})` : "—"}
                </td>
              ))}
            </Row>
            <Row label="Stock">
              {products.map((p) => (
                <td key={p.id} className="px-3 py-3 align-top">
                  {p.stock > 0 ? `${p.stock} in stock` : <span className="text-destructive">Out</span>}
                </td>
              ))}
            </Row>
            <Row label="Summary">
              {products.map((p) => (
                <td key={p.id} className="px-3 py-3 align-top text-muted-foreground">
                  {p.short_description ?? "—"}
                </td>
              ))}
            </Row>
            {allSpecKeys.map((key) => (
              <Row key={key} label={key}>
                {products.map((p) => {
                  const v = (p.specs as Record<string, unknown> | null)?.[key];
                  return (
                    <td key={p.id} className="px-3 py-3 align-top">
                      {v != null ? String(v) : <span className="text-muted-foreground">—</span>}
                    </td>
                  );
                })}
              </Row>
            ))}
            <tr>
              <td className="px-3 py-4" />
              {products.map((p) => (
                <td key={p.id} className="px-3 py-4">
                  <Button
                    size="sm"
                    onClick={() => {
                      const imgs = p.images as unknown[];
                      cart.add({
                        productId: p.id,
                        slug: p.slug,
                        title: p.title,
                        brand: p.brand ?? null,
                        priceCents: p.price_cents,
                        sellerId: p.seller_id,
                        imageUrl: typeof imgs?.[0] === "string" ? (imgs[0] as string) : null,
                      });
                      toast.success("Added to cart");
                    }}
                  >
                    <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Add
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-t border-border/60">
      <td className="px-3 py-3 align-top text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </td>
      {children}
    </tr>
  );
}
