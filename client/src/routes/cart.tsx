import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { cart, useCart, cartTotals, formatCents, type CartItem } from "@/lib/cart";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Vyapari" },
      { name: "description", content: "Review the items in your Vyapari cart." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const items = useCart();
  const totals = cartTotals(items);
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={ShoppingBag}
          eyebrow="Your cart"
          title="Your cart is empty"
          description="Discover curated electronics or ask the AI assistant to find something for you."
          action={
            <>
              <Button asChild size="lg" className="rounded-full shadow-[var(--shadow-glow)]">
                <Link to="/shop">Browse the marketplace</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/assistant">Ask Vyapari AI</Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Your cart"
        icon={ShoppingBag}
        title="Review your order"
        description={`${itemCount} item${itemCount === 1 ? "" : "s"} ready for checkout.`}
      />
      <div className="mt-2 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
          {items.map((i) => (
            <li key={i.productId} className="flex gap-4 p-4 sm:p-5">
              <Link
                to="/shop/$slug"
                params={{ slug: i.slug }}
                className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-[image:var(--gradient-hero)] text-2xl font-bold text-foreground/10"
              >
                {i.imageUrl ? (
                  <img src={i.imageUrl} alt={i.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span>{i.brand?.[0] ?? i.title[0]}</span>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/shop/$slug"
                  params={{ slug: i.slug }}
                  className="line-clamp-1 font-medium hover:text-primary"
                >
                  {i.title}
                </Link>
                {i.brand && (
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {i.brand}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    aria-label="Decrease quantity"
                    onClick={() => cart.setQuantity(i.productId, i.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium" aria-live="polite">{i.quantity}</span>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    aria-label="Increase quantity"
                    onClick={() => cart.setQuantity(i.productId, i.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <button
                    onClick={() => {
                      const snapshot: CartItem = { ...i };
                      cart.remove(i.productId);
                      toast.success(`Removed “${i.title}”`, {
                        action: {
                          label: "Undo",
                          onClick: () => {
                            const { quantity, ...rest } = snapshot;
                            cart.add(rest, quantity);
                          },
                        },
                      });
                    }}
                    className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatCents(i.priceCents * i.quantity)}</div>
                <div className="text-xs text-muted-foreground">{formatCents(i.priceCents)} each</div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="sticky top-24 h-fit space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-elegant)]">
            <h2 className="font-display text-lg font-semibold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Subtotal" value={formatCents(totals.subtotal)} />
              <Row
                label="Shipping"
                value={totals.shipping === 0 ? "Free" : formatCents(totals.shipping)}
              />
              <Row label="Estimated tax" value={formatCents(totals.tax)} />
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-border/60 pt-4">
              <span className="font-medium">Total</span>
              <span className="font-display text-2xl font-semibold">
                {formatCents(totals.total)}
              </span>
            </div>
            <Button
              className="mt-6 w-full rounded-full shadow-[var(--shadow-glow)]"
              size="lg"
              onClick={() => navigate({ to: "/checkout" })}
            >
              Checkout <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Mock checkout — no payment will be charged.
            </p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 p-5 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="font-medium text-foreground">Buyer protection</div>
                <p className="text-muted-foreground">2-year warranty + dispute resolution.</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2.5">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="font-medium text-foreground">Fast shipping</div>
                <p className="text-muted-foreground">Most orders ship within 24 hours.</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2.5">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="font-medium text-foreground">30-day returns</div>
                <p className="text-muted-foreground">No-questions-asked, on the house.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
