import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";

import { listAllOrders, updateOrderStatus } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/cart";
import { notify } from "@/lib/notify";
import { TableSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";
import { CsvExportButton } from "@/components/csv-export-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

const STATUSES = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;

function AdminOrders() {
  const fetch = useServerFn(listAllOrders);
  const update = useServerFn(updateOrderStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-orders"], queryFn: () => fetch() });

  async function change(id: string, status: (typeof STATUSES)[number]) {
    try {
      await update({ data: { id, status } });
      const { sendMockNotification } = await import("@/lib/notifications");
      const kind =
        status === "shipped"
          ? "order_shipped"
          : status === "delivered"
            ? "order_delivered"
            : status === "cancelled"
              ? "order_cancelled"
              : "order_paid";
      sendMockNotification(
        kind,
        "customer@example.com",
        `Order #${id.slice(0, 8)} ${status}`,
        `Your order is now ${status}.`,
      );
      notify.success("Status updated", { description: "Customer notified." });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e) {
      notify.error(e);
    }
  }

  if (isLoading || !data) return <TableSkeleton />;

  const csvRows = data.orders.map((o) => ({
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    total_usd: (o.total_cents / 100).toFixed(2),
    user_id: o.user_id,
  }));

  return (
    <div>
      <SectionHeader
        eyebrow="Operations"
        icon={ShoppingBag}
        title="All orders"
        description="Move every order through fulfilment and notify customers on each state change."
        actions={
          <CsvExportButton
            filename={`orders-${new Date().toISOString().slice(0, 10)}.csv`}
            rows={csvRows}
            columns={[
              { key: "id", label: "Order ID" },
              { key: "created_at", label: "Placed at" },
              { key: "status", label: "Status" },
              { key: "total_usd", label: "Total (USD)" },
              { key: "user_id", label: "Customer" },
            ]}
          />
        }
      />
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <table className="w-full text-sm">

        <thead className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.orders.map((o) => (
            <tr key={o.id} className="border-b border-border/40 last:border-0">
              <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}…</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(o.created_at).toLocaleString()}
              </td>
              <td className="px-4 py-3">{formatCents(o.total_cents)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{o.status}</Badge>
                  <Select
                    value={o.status}
                    onValueChange={(v) => change(o.id, v as (typeof STATUSES)[number])}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
