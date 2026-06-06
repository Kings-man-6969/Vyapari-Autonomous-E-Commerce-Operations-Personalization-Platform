import { CheckCircle2, Package, Truck, Home, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStatus = "paid" | "packed" | "shipped" | "delivered" | "cancelled" | "refunded";

type Step = {
  key: OrderStatus;
  label: string;
  description: string;
  icon: typeof Package;
};

const STEPS: Step[] = [
  { key: "paid", label: "Order placed", description: "We've received your order.", icon: CheckCircle2 },
  { key: "packed", label: "Packed", description: "Items are being prepared.", icon: Package },
  { key: "shipped", label: "Shipped", description: "Your order is on the way.", icon: Truck },
  { key: "delivered", label: "Delivered", description: "Enjoy!", icon: Home },
];

const ORDER: OrderStatus[] = ["paid", "packed", "shipped", "delivered"];

export function OrderTimeline({
  status,
  placedAt,
}: {
  status: string;
  placedAt: string;
}) {
  const cancelled = status === "cancelled" || status === "refunded";
  const currentIdx = cancelled ? -1 : Math.max(0, ORDER.indexOf(status as OrderStatus));

  if (cancelled) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
        <div className="flex items-center gap-2 font-medium">
          <Circle className="h-4 w-4" />
          Order {status}
        </div>
        <p className="mt-1 text-destructive/80">
          Placed {new Date(placedAt).toLocaleString()}.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative grid gap-6 sm:grid-cols-4 sm:gap-2">
      {STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const Icon = step.icon;
        return (
          <li key={step.key} className="relative flex gap-3 sm:flex-col sm:items-start">
            {/* Connector line — horizontal on desktop, vertical on mobile */}
            {idx < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-4 top-9 h-[calc(100%-1rem)] w-0.5 sm:left-auto sm:top-4 sm:h-0.5 sm:w-[calc(100%-2rem)] sm:translate-x-9",
                  done ? "bg-primary/60" : "bg-border",
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground",
                isCurrent && "shadow-[var(--shadow-glow)] ring-4 ring-primary/15",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 sm:mt-2">
              <div
                className={cn(
                  "text-sm font-medium",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </div>
              <div className="text-xs text-muted-foreground">{step.description}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
