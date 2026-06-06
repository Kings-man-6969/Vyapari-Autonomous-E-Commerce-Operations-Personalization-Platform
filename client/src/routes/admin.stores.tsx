import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { listAllStores, deleteStore } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/loading-states";

export const Route = createFileRoute("/admin/stores")({
  component: AdminStores,
});

function AdminStores() {
  const fetchStores = useServerFn(listAllStores);
  const del = useServerFn(deleteStore);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-stores"], queryFn: () => fetchStores() });

  async function remove(id: string, name: string) {
    if (!confirm(`Delete store "${name}"? This cannot be undone.`)) return;
    try {
      await del({ data: { id } });
      toast.success("Store deleted");
      qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (isLoading || !data) return <ListSkeleton />;

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Store</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.stores.map((s) => (
            <tr key={s.id} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-3">
                <Link
                  to="/store/$slug"
                  params={{ slug: s.store_slug }}
                  className="font-medium hover:underline"
                >
                  {s.store_name}
                </Link>
                <div className="text-xs text-muted-foreground">/{s.store_slug}</div>
              </td>
              <td className="px-4 py-3">{s.rating ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(s.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="ghost" onClick={() => remove(s.id, s.store_name)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
