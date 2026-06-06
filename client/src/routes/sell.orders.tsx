import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingBag, Truck, Check } from "lucide-react";
import { toast } from "sonner";

import { listSellerOrders } from "@/lib/seller.functions";
import { updateOrderItemTracking } from "@/lib/seller-extras.functions";
import { formatCents } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";

export const Route = createFileRoute("/sell/orders")({
  component: SellerOrders,
});

type Item = {
  id: string;
  title: string;
  quantity: number;
  unit_price_cents: number;
  order_id: string;
  tracking_carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  orders?: { id: string; status: string; created_at: string } | null;
};

function SellerOrders() {
  const fetcher = useServerFn(listSellerOrders);
  const update = useServerFn(updateOrderItemTracking);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["seller-orders"], queryFn: () => fetcher() });
  const [editing, setEditing] = useState<string | null>(null);
  const [carrier, setCarrier] = useState("");
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);

  const items = (data?.items ?? []) as unknown as Item[];

  async function submit(itemId: string) {
    if (!carrier || !num) {
      toast.error("Enter carrier and tracking number");
      return;
    }
    setBusy(true);
    try {
      await update({ data: { itemId, carrier, trackingNumber: num } });
      toast.success("Shipment recorded");
      setEditing(null);
      setCarrier("");
      setNum("");
      qc.invalidateQueries({ queryKey: ["seller-orders"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Fulfilment"
        icon={ShoppingBag}
        title="Incoming orders"
        description="Add tracking and keep customers in the loop the moment a parcel is on its way."
      />
      {isLoading || !data ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No orders yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When customers buy your products, you'll see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((i) => {

        const o = i.orders;
        const shipped = !!i.shipped_at;
        const isEditing = editing === i.id;
        return (
          <div key={i.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">#{o?.id.slice(0, 8) ?? "—"}</span>
                  <span>·</span>
                  <span>{o?.created_at ? new Date(o.created_at).toLocaleDateString() : ""}</span>
                  <span>·</span>
                  <span className="uppercase tracking-wider">{o?.status}</span>
                </div>
                <div className="mt-1 font-medium">{i.title}</div>
                <div className="text-xs text-muted-foreground">
                  Qty {i.quantity} · {formatCents(i.unit_price_cents * i.quantity)}
                </div>
              </div>
              {shipped ? (
                <div className="text-right text-xs">
                  <div className="flex items-center gap-1 text-emerald-500">
                    <Check className="h-3.5 w-3.5" /> Shipped
                  </div>
                  <div className="text-muted-foreground">
                    {i.tracking_carrier} · {i.tracking_number}
                  </div>
                </div>
              ) : !isEditing ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(i.id);
                    setCarrier("");
                    setNum("");
                  }}
                >
                  <Truck className="mr-1.5 h-4 w-4" /> Add tracking
                </Button>
              ) : null}
            </div>
            {isEditing && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <Input
                  placeholder="Carrier (UPS, FedEx)"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
                <Input
                  placeholder="Tracking number"
                  value={num}
                  onChange={(e) => setNum(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button onClick={() => submit(i.id)} disabled={busy} size="sm">
                    {busy ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}

