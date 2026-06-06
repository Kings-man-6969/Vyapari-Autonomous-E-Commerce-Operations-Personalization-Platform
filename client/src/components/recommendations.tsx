import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { getPersonalizedRecommendations } from "@/lib/recommendations.functions";
import { useRecentlyViewed } from "@/lib/recently-viewed";
import { ProductCard } from "@/components/product-card";

export function Recommendations() {
  const fn = useServerFn(getPersonalizedRecommendations);
  const viewed = useRecentlyViewed();
  const slugs = viewed.slice(0, 8).map((v) => v.slug);
  const { data } = useQuery({
    queryKey: ["recommendations", slugs.join(",")],
    queryFn: () => fn({ data: { viewedSlugs: slugs } }),
  });
  if (!data || data.products.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">Recommended for you</h2>
          </div>
          <p className="text-sm text-muted-foreground">{data.reason}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {data.products.slice(0, 4).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
