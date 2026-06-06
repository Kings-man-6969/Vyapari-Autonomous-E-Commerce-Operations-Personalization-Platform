import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";

import { listWishlist } from "@/lib/commerce.functions";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/account/wishlist")({
  component: WishlistPage,
});

type WishProduct = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  brand: string | null;
  images: unknown;
  rating: number | null;
  review_count: number | null;
  is_featured: boolean;
  stock: number;
  category_id: string | null;
  seller_id: string;
};

function WishlistPage() {
  const fetch = useServerFn(listWishlist);
  const { data, isLoading } = useQuery({ queryKey: ["wishlist"], queryFn: () => fetch() });

  const items = (data?.items ?? []).filter((i) => i.products) as Array<{
    id: string;
    products: WishProduct;
  }>;

  return (
    <div>
      <SectionHeader
        eyebrow="Wishlist"
        icon={Heart}
        title="Saved for later"
        description="Products you've heart-tagged. Move them to cart when you're ready."
      />
      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          eyebrow="Wishlist"
          title="No saved items yet"
          description="Tap the heart on any product to save it for later."
          action={
            <Button asChild className="rounded-full">
              <Link to="/shop">Browse products</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <ProductCard key={i.id} product={i.products} />
          ))}
        </div>
      )}
    </div>
  );
}
