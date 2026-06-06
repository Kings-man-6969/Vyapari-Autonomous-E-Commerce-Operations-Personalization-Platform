import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";

import { listOrders } from "@/lib/commerce.functions";
import { formatCents } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";

export const Route = createFileRoute("/account/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const fetch = useServerFn(listOrders);
  const { data, isLoading } = useQuery({ queryKey: ["orders"], queryFn: () => fetch() });

  const orders = data?.orders ?? [];

  return (
    <div>
      <SectionHeader
        eyebrow="Orders"
        icon={Package}
        title="Your purchases"
        description="Track shipments, download invoices, and re-order in one tap."
      />
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <Package className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No orders yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When you place an order it'll show up here.
          </p>
          <Button asChild className="mt-4">
            <Link to="/shop">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link
                    to="/account/orders/$id"
                    params={{ id: o.id }}
                    className="font-mono text-sm text-primary hover:underline"
                  >
                    #{o.id.slice(0, 8)}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()} · {o.order_items.length} item
                    {o.order_items.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatCents(o.total_cents)}</div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">
                    {o.status}
                  </span>
                </div>
              </div>
              <div className="mt-3 line-clamp-1 text-sm text-muted-foreground">
                {o.order_items.map((i) => i.title).join(" · ")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

