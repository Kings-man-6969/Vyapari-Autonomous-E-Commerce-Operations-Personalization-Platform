import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI card with optional week-over-week (or period-over-period) delta.
 * Pass `delta` as a fraction: 0.12 → "+12%". Pass null/undefined to hide.
 */
export function KpiStat({
  label,
  value,
  icon: Icon,
  delta,
  invertGood,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Fractional change (e.g. 0.12 for +12%). */
  delta?: number | null;
  /** Set true when "down" is good (e.g. refunds, churn). */
  invertGood?: boolean;
  hint?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const positive = hasDelta && delta! > 0;
  const negative = hasDelta && delta! < 0;
  const good = invertGood ? negative : positive;
  const bad = invertGood ? positive : negative;
  const pct = hasDelta ? `${delta! > 0 ? "+" : ""}${Math.round(delta! * 100)}%` : null;
  const DeltaIcon = !hasDelta || delta === 0 ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4" />}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold">{value}</div>
        {pct && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
              good && "bg-primary/15 text-primary",
              bad && "bg-destructive/15 text-destructive",
              !good && !bad && "bg-muted text-muted-foreground",
            )}
            title={hint ?? "vs previous period"}
          >
            <DeltaIcon className="h-3 w-3" />
            {pct}
          </span>
        )}
      </div>
    </div>
  );
}

/** Compute fractional delta between current and previous numeric values. */
export function computeDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

/**
 * Split a daily trend into two equal halves (older vs newer) and return the
 * delta on the summed metric. Useful for "last 14 days" charts.
 */
export function splitTrendDelta<T>(trend: T[], pick: (t: T) => number): number | null {
  if (trend.length < 2) return null;
  const half = Math.floor(trend.length / 2);
  const prev = trend.slice(0, half).reduce((s, t) => s + pick(t), 0);
  const curr = trend.slice(half).reduce((s, t) => s + pick(t), 0);
  return computeDelta(curr, prev);
}
