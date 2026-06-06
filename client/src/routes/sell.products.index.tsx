import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Trash2, Package, Plus } from "lucide-react";
import { toast } from "sonner";

import { listMyProducts, deleteProduct } from "@/lib/seller.functions";
import { formatCents } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";

export const Route = createFileRoute("/sell/products/")({
  component: ProductsList,
});

function ProductsList() {
  const fetchProducts = useServerFn(listMyProducts);
  const del = useServerFn(deleteProduct);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-products"],
    queryFn: () => fetchProducts(),
  });

  const products = data?.products ?? [];

  return (
    <div>
      <SectionHeader
        eyebrow="Catalog"
        icon={Package}
        title="Your products"
        description="Edit listings, manage stock, and push new SKUs live in minutes."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/sell/products/import">Bulk import</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/sell/products/new">
                <Plus className="mr-1.5 h-4 w-4" /> New product
              </Link>
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <TableSkeleton />
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No products yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first listing to start selling.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild>
              <Link to="/sell/products/new">Create product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/sell/products/import">Bulk import CSV</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const img = Array.isArray(p.images) && p.images.length > 0 ? (p.images[0] as string) : null;
            return (
              <div
                key={p.id}
                className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-3"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {img ? (
                    <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    {!p.is_published && <Badge variant="secondary">Draft</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCents(p.price_cents)} · Stock {p.stock}
                  </div>
                </div>
                <Button asChild size="icon" variant="ghost">
                  <Link to="/sell/products/$id" params={{ id: p.id }}>
                    <Edit3 className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm("Delete this product?")) return;
                    try {
                      await del({ data: { id: p.id } });
                      toast.success("Deleted");
                      qc.invalidateQueries({ queryKey: ["my-products"] });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
