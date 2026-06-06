import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";

import { getOrder } from "@/lib/commerce.functions";
import { formatCents } from "@/lib/cart";
import { OrderTimeline } from "@/components/order-timeline";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/account/orders/$id")({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const fetch = useServerFn(getOrder);
  const { data, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetch({ data: { id } }),
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  if (error || !data)
    return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Not found"}</p>;

  const o = data.order;
  const addr = o.shipping_address as Record<string, string>;

  return (
    <div className="print-invoice">
      <div className="no-print">
        <Link
          to="/account/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> All orders
        </Link>
      </div>

      {/* Invoice-only header (visible when printing) */}
      <div className="print-only mb-6 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <BrandLogo size={22} />
          <span className="font-display text-lg font-semibold">Vyapari</span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Invoice</div>
          <div>#{o.id.slice(0, 8).toUpperCase()}</div>
          <div>{new Date(o.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-xl">#{o.id.slice(0, 8)}</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{o.status}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="no-print"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print invoice
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Placed {new Date(o.created_at).toLocaleString()}
      </p>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 no-print">
        <OrderTimeline status={o.status} placedAt={o.created_at} />
      </div>

      <ul className="mt-6 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
        {o.order_items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 p-4">
            <div>
              <div className="font-medium">{i.title}</div>
              <div className="text-xs text-muted-foreground">Qty {i.quantity}</div>
            </div>
            <div className="text-right">{formatCents(i.unit_price_cents * i.quantity)}</div>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm">
          <h3 className="font-medium">Shipping to</h3>
          <div className="mt-2 text-muted-foreground">
            {addr.recipient}
            <br />
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ""}
            <br />
            {addr.city}
            {addr.region ? `, ${addr.region}` : ""} {addr.postal_code}
            <br />
            {addr.country}
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm">
          <h3 className="font-medium">Totals</h3>
          <dl className="mt-2 space-y-1 text-muted-foreground">
            <Row label="Subtotal" value={formatCents(o.subtotal_cents)} />
            <Row
              label="Shipping"
              value={o.shipping_cents === 0 ? "Free" : formatCents(o.shipping_cents)}
            />
            <Row label="Tax" value={formatCents(o.tax_cents)} />
            <div className="flex justify-between border-t border-border/60 pt-2 text-base text-foreground">
              <span>Total</span>
              <span className="font-semibold">{formatCents(o.total_cents)}</span>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
