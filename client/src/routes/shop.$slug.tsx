import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Star, Store, Heart, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { getProduct, toggleWishlist, isWishlisted } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/product-card";
import { ReviewsSection } from "@/components/reviews-section";
import { CompareButton } from "@/components/compare-button";
import { AlertButtons } from "@/components/alert-buttons";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageZoom } from "@/components/image-zoom";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";
import { cart } from "@/lib/cart";
import { trackView } from "@/lib/recently-viewed";
import { cn } from "@/lib/utils";

const productQO = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: () => getProduct({ data: { slug } }),
  });

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ context, params }) => {
    try {
      const data = await context.queryClient.ensureQueryData(productQO(params.slug));
      return { product: data.product };
    } catch {
      throw notFound();
    }
  },
  head: ({ params, loaderData }) => {
    const p = (loaderData as { product?: { title: string; description?: string | null; images?: unknown; price_cents: number; brand?: string | null; rating?: number | null; review_count?: number | null } } | undefined)?.product;
    const title = p ? `${p.title} — Vyapari` : `${params.slug.replace(/-/g, " ")} — Vyapari`;
    const desc = p?.description?.slice(0, 155) ?? "Product details on Vyapari marketplace.";
    const img = Array.isArray(p?.images) && typeof p?.images[0] === "string" ? (p?.images[0] as string) : undefined;
    const jsonLd = p
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: p.description ?? undefined,
          image: img,
          brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
          offers: {
            "@type": "Offer",
            price: (p.price_cents / 100).toFixed(2),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
          },
          aggregateRating:
            p.rating && p.review_count
              ? { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.review_count }
              : undefined,
        }
      : null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
      ],
      scripts: jsonLd
        ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }]
        : [],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Product not found</h1>
      <Link to="/shop" className="mt-4 inline-block text-primary hover:underline">
        Back to shop
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Couldn't load product</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  pendingMs: 200,
  pendingComponent: () => (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Skeleton className="mb-6 h-4 w-40" />
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-28" />
          </div>
        </div>
      </div>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(productQO(slug));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const p = data.product;
  const seller = (p as { sellers?: { store_name: string; store_slug: string; bio?: string | null; rating?: number | null } }).sellers;
  const specs = (p.specs ?? {}) as Record<string, string>;
  const images = Array.isArray(p.images)
    ? (p.images as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const firstImage = images[0] ?? null;
  const [activeImage, setActiveImage] = useState(0);
  const price = `$${(p.price_cents / 100).toFixed(2)}`;
  const compare =
    p.compare_at_cents && p.compare_at_cents > p.price_cents
      ? `$${(p.compare_at_cents / 100).toFixed(2)}`
      : null;

  // Auth state (for enabling the wishlist query / messaging the right toast)
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const unsub = subscribeToAuthIdentity((s) => setSignedIn(!!s));
    return () => unsub();
  }, []);

  // Wishlist status — drives the heart's filled / outline state
  const fetchWishlisted = useServerFn(isWishlisted);
  const wishlistedQuery = useQuery({
    queryKey: ["wishlisted", p.id],
    queryFn: () => fetchWishlisted({ data: { productId: p.id } }),
    enabled: signedIn,
    staleTime: 30_000,
  });
  const wishlisted = wishlistedQuery.data?.wishlisted ?? false;

  const toggleWishlistFn = useServerFn(toggleWishlist);
  const wishlistMutation = useMutation({
    mutationFn: () => toggleWishlistFn({ data: { productId: p.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["wishlisted", p.id] });
      const prev = qc.getQueryData<{ wishlisted: boolean }>(["wishlisted", p.id]);
      qc.setQueryData(["wishlisted", p.id], { wishlisted: !(prev?.wishlisted ?? false) });
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["wishlisted", p.id], ctx.prev);
      toast.error((err as Error).message, {
        action: { label: "Retry", onClick: () => wishlistMutation.mutate() },
      });
    },
    onSuccess: (res) => {
      qc.setQueryData(["wishlisted", p.id], { wishlisted: res.wishlisted });
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast.success(res.wishlisted ? "Saved to wishlist" : "Removed from wishlist", {
        action: res.wishlisted
          ? { label: "View", onClick: () => navigate({ to: "/account/wishlist" }) }
          : undefined,
      });
    },
  });

  useEffect(() => {
    trackView({
      productId: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand ?? null,
      priceCents: p.price_cents,
      imageUrl: firstImage,
    });
  }, [p.id, p.slug, p.title, p.brand, p.price_cents, firstImage]);

  function handleWishlist() {
    if (!signedIn) {
      toast.error("Sign in to save items to your wishlist.", {
        action: { label: "Sign in", onClick: () => navigate({ to: "/login" }) },
      });
      return;
    }
    if (wishlistMutation.isPending) return;
    wishlistMutation.mutate();
  }

  const outOfStock = (p.stock ?? 0) <= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>{" "}
        / <span className="text-foreground">{p.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-[image:var(--gradient-hero)]">
            {images.length > 0 ? (
              <ImageZoom
                src={images[activeImage] ?? images[0]}
                alt={p.title}
                className="h-full w-full"
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-[10rem] font-bold text-foreground/10">
                {p.brand?.[0] ?? p.title[0]}
              </div>
            )}
            {compare && (
              <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                Sale
              </span>
            )}
            {outOfStock && (
              <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-destructive/90 px-2.5 py-1 text-xs font-medium text-destructive-foreground">
                Out of stock
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {images.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={cn(
                    "h-16 w-16 overflow-hidden rounded-lg border bg-muted transition-colors",
                    idx === activeImage
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/60 hover:border-primary/40",
                  )}
                >
                  <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {p.brand && (
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              {p.brand}
            </span>
          )}
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{p.title}</h1>
          {p.rating && (
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-primary text-primary" />
              {Number(p.rating).toFixed(1)} · {p.review_count ?? 0} reviews
            </div>
          )}

          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-4xl font-semibold">{price}</span>
            {compare && <span className="text-lg text-muted-foreground line-through">{compare}</span>}
          </div>
          {!outOfStock && (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Only {p.stock} left in stock — order soon
            </p>
          )}


          <p className="mt-6 text-muted-foreground leading-relaxed">{p.description}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="flex-1 sm:flex-none"
              disabled={outOfStock}
              onClick={() => {
                cart.add({
                  productId: p.id,
                  slug: p.slug,
                  title: p.title,
                  brand: p.brand ?? null,
                  priceCents: p.price_cents,
                  sellerId: p.seller_id,
                  imageUrl: firstImage,
                });
                toast.success("Added to cart", {
                  description: p.title,
                  action: { label: "View cart", onClick: () => navigate({ to: "/cart" }) },
                });
              }}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {outOfStock ? "Out of stock" : "Add to cart"}
            </Button>
            <Button
              size="lg"
              variant={wishlisted ? "default" : "secondary"}
              onClick={handleWishlist}
              disabled={wishlistMutation.isPending}
              aria-pressed={wishlisted}
              aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
            >
              <Heart
                className={cn(
                  "mr-2 h-4 w-4 transition-colors",
                  wishlisted && "fill-current",
                )}
              />
              {wishlisted ? "Saved" : "Save"}
            </Button>
            <CompareButton
              size="lg"
              item={{
                productId: p.id,
                slug: p.slug,
                title: p.title,
                brand: p.brand ?? null,
                priceCents: p.price_cents,
                imageUrl: firstImage,
              }}
            />
          </div>


          <AlertButtons productId={p.id} inStock={(p.stock ?? 0) > 0} />

          {seller && (
            <Link
              to="/store/$slug"
              params={{ slug: seller.store_slug }}
              className="mt-8 flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/40 transition-colors"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[image:var(--gradient-brand)] text-primary-foreground">
                <Store className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">Sold by</div>
                <div className="font-medium">{seller.store_name}</div>
              </div>
              {seller.rating && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-3 w-3 fill-primary text-primary" />
                  {Number(seller.rating).toFixed(1)}
                </span>
              )}
            </Link>
          )}

          {seller && <ContactSellerButton sellerId={p.seller_id} productId={p.id} />}

          {Object.keys(specs).length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Specifications
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {Object.entries(specs).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="mt-8 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              Not sure?{" "}
              <Link to="/assistant" className="font-medium text-primary hover:underline">
                Ask Vyapari AI
              </Link>{" "}
              to compare this with similar products.
            </span>
          </div>
        </div>
      </div>

      {data.related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-xl font-semibold tracking-tight">You might also like</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.related.map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}

      <ReviewsSection productId={p.id} />

      {/* Sticky mobile add-to-cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md shadow-[0_-6px_20px_-12px_rgba(0,0,0,0.25)] lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-muted-foreground">{p.title}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">{price}</span>
              {compare && (
                <span className="text-xs text-muted-foreground line-through">{compare}</span>
              )}
            </div>
          </div>
          <Button
            size="lg"
            className="shrink-0 rounded-full"
            disabled={outOfStock}
            onClick={() => {
              cart.add({
                productId: p.id,
                slug: p.slug,
                title: p.title,
                brand: p.brand ?? null,
                priceCents: p.price_cents,
                sellerId: p.seller_id,
                imageUrl: firstImage,
              });
              toast.success("Added to cart", {
                description: p.title,
                action: { label: "View cart", onClick: () => navigate({ to: "/cart" }) },
              });
            }}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {outOfStock ? "Out of stock" : "Add"}
          </Button>
        </div>
      </div>
      {/* Spacer so the sticky bar never overlaps the last section on mobile */}
      <div aria-hidden className="h-20 lg:hidden" />
    </div>
  );
}
