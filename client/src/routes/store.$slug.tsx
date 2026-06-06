import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Store, Star } from "lucide-react";

import { getStore } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/product-card";

const storeQO = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: () => getStore({ data: { slug } }),
  });

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(storeQO(params.slug));
    } catch {
      throw notFound();
    }
  },
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    const title = `${name} — Vyapari store`;
    const desc = `Browse products from ${name} on Vyapari, the AI-native marketplace.`;
    const path = `/store/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: path },
      ],
      links: [{ rel: "canonical", href: path }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name,
            description: desc,
            url: path,
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Store not found</h1>
      <Link to="/shop" className="mt-4 inline-block text-primary hover:underline">
        Browse marketplace
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  component: StorePage,
});

function StorePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storeQO(slug));
  const s = data.seller;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-border/60 bg-[image:var(--gradient-hero)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="flex items-start gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[image:var(--gradient-brand)] text-primary-foreground shadow-[var(--shadow-elegant)]">
              <Store className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Verified seller
              </div>
              <h1 className="mt-2 text-balance font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {s.store_name}
              </h1>
              {s.bio && (
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {s.bio}
                </p>
              )}
            </div>
          </div>
          {s.rating && (
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-4 py-2 text-sm backdrop-blur">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <span className="font-medium">{Number(s.rating).toFixed(1)}</span>
              <span className="text-muted-foreground">store rating</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Catalog
            </div>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              Products ({data.products.length})
            </h2>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {data.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

