import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, X } from "lucide-react";

import { listAllProducts, setProductPublished, setProductFeatured } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCents } from "@/lib/cart";
import { TableSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

function AdminProducts() {
  const fetch = useServerFn(listAllProducts);
  const setPub = useServerFn(setProductPublished);
  const setFeat = useServerFn(setProductFeatured);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: () => fetch() });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const products = data?.products ?? [];
  const allSelected = useMemo(
    () => products.length > 0 && products.every((p) => selected.has(p.id)),
    [products, selected],
  );

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  async function togglePub(id: string, current: boolean) {
    try {
      await setPub({ data: { id, published: !current } });
      toast.success(current ? "Unpublished" : "Published");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }
  async function toggleFeat(id: string, current: boolean) {
    try {
      await setFeat({ data: { id, featured: !current } });
      toast.success(current ? "Unfeatured" : "Featured");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function bulk(action: "publish" | "hide" | "feature" | "unfeature") {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    const ids = Array.from(selected);
    const t = toast.loading(`Updating ${ids.length} product${ids.length === 1 ? "" : "s"}…`);
    let ok = 0;
    let fail = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          if (action === "publish" || action === "hide") {
            await setPub({ data: { id, published: action === "publish" } });
          } else {
            await setFeat({ data: { id, featured: action === "feature" } });
          }
          ok++;
        } catch {
          fail++;
        }
      }),
    );
    toast.dismiss(t);
    if (fail === 0) toast.success(`Updated ${ok} product${ok === 1 ? "" : "s"}`);
    else toast.error(`${ok} updated · ${fail} failed`);
    setSelected(new Set());
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  }

  if (isLoading || !data) return <TableSkeleton />;

  return (
    <div>
      <SectionHeader
        eyebrow="Catalog"
        icon={Package}
        title="All products"
        description="Publish, hide, or feature listings across every store on the platform."
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-2.5 backdrop-blur-md animate-fade-in">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("publish")}>
              Publish
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("hide")}>
              Hide
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("feature")}>
              Feature
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk("unfeature")}>
              Unfeature
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                className={
                  selected.has(p.id)
                    ? "border-b border-border/40 bg-primary/5 last:border-0"
                    : "border-b border-border/40 last:border-0"
                }
              >
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                    aria-label={`Select ${p.title}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link to="/shop/$slug" params={{ slug: p.slug }} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatCents(p.price_cents)}</td>
                <td className="px-4 py-3">{p.stock}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Badge variant={p.is_published ? "default" : "secondary"}>
                      {p.is_published ? "Live" : "Hidden"}
                    </Badge>
                    {p.is_featured && <Badge variant="outline">Featured</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => togglePub(p.id, p.is_published)}>
                      {p.is_published ? "Hide" : "Publish"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleFeat(p.id, p.is_featured)}>
                      {p.is_featured ? "Unfeature" : "Feature"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
