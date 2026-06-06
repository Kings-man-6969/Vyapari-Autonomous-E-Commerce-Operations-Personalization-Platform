import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
};

export function SellerOnboardingChecklist({
  hasLogo,
  hasProducts,
  hasOrders,
  hasPayoutInfo,
}: {
  hasLogo: boolean;
  hasProducts: boolean;
  hasOrders: boolean;
  hasPayoutInfo: boolean;
}) {
  const steps: Step[] = [
    {
      id: "logo",
      label: "Add a store logo",
      hint: "Builds buyer trust on every PDP and search result.",
      to: "/sell/profile",
      done: hasLogo,
    },
    {
      id: "payout",
      label: "Set up payouts",
      hint: "We can't pay you until this is configured.",
      to: "/sell/settings",
      done: hasPayoutInfo,
    },
    {
      id: "product",
      label: "List your first product",
      hint: "Use AI import to populate descriptions in seconds.",
      to: "/sell/products/new",
      done: hasProducts,
    },
    {
      id: "sale",
      label: "Make your first sale",
      hint: "Share your store link on social to get the flywheel going.",
      to: "/sell/promotions",
      done: hasOrders,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  if (completed === steps.length) return null;

  return (
    <section className="rounded-2xl border border-primary/30 bg-[image:var(--gradient-hero)] p-5">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> Get your store launch-ready
        </h2>
        <span className="text-xs text-muted-foreground">
          {completed} of {steps.length} · {pct}%
        </span>
      </header>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              to={s.to}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-sm transition-colors hover:border-primary/40",
                s.done && "opacity-60",
              )}
            >
              {s.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <div className={cn("font-medium", s.done && "line-through")}>{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.hint}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
