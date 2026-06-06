import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Lock, Tag, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrder } from "@/lib/commerce.functions";
import { validateCoupon, type ValidatedCoupon } from "@/lib/coupons.functions";
import { cart, cartTotals, formatCents, useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { DashboardSkeleton } from "@/components/loading-states";
import { sendMockNotification } from "@/lib/notifications";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Vyapari" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const items = useCart();
  const baseTotals = cartTotals(items);
  const navigate = useNavigate();
  const submit = useServerFn(createOrder);
  const validate = useServerFn(validateCoupon);
  const { status, user } = useRequireAuth();
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<ValidatedCoupon | null>(null);
  const [applying, setApplying] = useState(false);


  // Recompute totals with discount
  const discount = coupon?.discount_cents ?? 0;
  const discountedSubtotal = Math.max(0, baseTotals.subtotal - discount);
  const shipping = items.length === 0 ? 0 : discountedSubtotal > 5000 ? 0 : 999;
  const tax = Math.round(discountedSubtotal * 0.08);
  const total = discountedSubtotal + shipping + tax;
  const totals = { ...baseTotals, shipping, tax, total };

  async function applyCoupon() {
    if (!codeInput.trim()) return;
    setApplying(true);
    try {
      const res = await validate({ data: { code: codeInput.trim(), subtotalCents: baseTotals.subtotal } });
      setCoupon(res);
      toast.success(`Code ${res.code} applied — you saved ${formatCents(res.discount_cents)}`);
    } catch (e) {
      setCoupon(null);
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  if (status !== "authed" || !user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <DashboardSkeleton />
      </div>
    );
  }


  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <Button asChild className="mt-6">
          <Link to="/shop">Browse products</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const shipping = {
        recipient: String(fd.get("recipient") ?? ""),
        line1: String(fd.get("line1") ?? ""),
        line2: (fd.get("line2") as string) || null,
        city: String(fd.get("city") ?? ""),
        region: (fd.get("region") as string) || null,
        postal_code: String(fd.get("postal_code") ?? ""),
        country: String(fd.get("country") ?? "US").toUpperCase(),
        phone: (fd.get("phone") as string) || null,
      };
      const res = await submit({
        data: {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          shipping,
          couponCode: coupon?.code,
        },
      });
      cart.clear();
      const { data: sess } = await supabase.auth.getSession();
      const email = sess.session?.user.email ?? "customer@example.com";
      sendMockNotification(
        "order_placed",
        email,
        `Order confirmed (#${res.orderId.slice(0, 8)})`,
        `Hi ${shipping.recipient}, thanks for your order. Total: ${formatCents(total)}.`,
      );
      toast.success("Order placed! Confirmation email sent.");
      navigate({ to: "/account/orders/$id", params: { id: res.orderId } });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        eyebrow="Checkout"
        icon={Lock}
        title="Place your order"
        description="Shipping & payment — secure and encrypted end-to-end."
      />
      <form onSubmit={handleSubmit} className="mt-2 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Section title="Shipping address">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="recipient" label="Full name" required className="sm:col-span-2" />
              <Field name="line1" label="Address line 1" required className="sm:col-span-2" />
              <Field name="line2" label="Address line 2 (optional)" className="sm:col-span-2" />
              <Field name="city" label="City" required />
              <Field name="region" label="State / region" />
              <Field name="postal_code" label="Postal code" required />
              <Field name="country" label="Country" defaultValue="US" required />
              <Field name="phone" label="Phone (optional)" className="sm:col-span-2" />
            </div>
          </Section>

          <Section title="Payment">
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CreditCard className="h-4 w-4 text-primary" /> Demo payment
              </div>
              <p className="mt-1 text-muted-foreground">
                This is a mock checkout. Your card won't be charged — your order will simply be saved.
              </p>
            </div>
          </Section>
        </div>

        <aside className="h-fit rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="line-clamp-1 text-muted-foreground">
                  {i.title} <span className="text-foreground/70">× {i.quantity}</span>
                </span>
                <span className="shrink-0">{formatCents(i.priceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
            <Row label="Subtotal" value={formatCents(totals.subtotal)} />
            {coupon && (
              <div className="flex items-center justify-between text-primary">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> {coupon.code}
                  <button
                    type="button"
                    onClick={() => setCoupon(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Remove promo code"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
                <span>−{formatCents(coupon.discount_cents)}</span>
              </div>
            )}
            <Row label="Shipping" value={totals.shipping === 0 ? "Free" : formatCents(totals.shipping)} />
            <Row label="Tax" value={formatCents(totals.tax)} />
          </dl>

          {!coupon && (
            <div className="mt-4 flex gap-2">
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="h-9"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={applyCoupon}
                disabled={applying || !codeInput.trim()}
              >
                {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-baseline justify-between border-t border-border/60 pt-4">
            <span className="font-medium">Total</span>
            <span className="text-xl font-semibold">{formatCents(totals.total)}</span>
          </div>
          <Button type="submit" className="mt-6 w-full" size="lg" disabled={busy}>
            <Lock className="mr-2 h-4 w-4" /> {busy ? "Placing order…" : "Place order"}
          </Button>
        </aside>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  required,
  className,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  className?: string;
  defaultValue?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="text-xs">
        {label}
      </Label>
      <Input id={name} name={name} required={required} defaultValue={defaultValue} className="mt-1.5" />
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
