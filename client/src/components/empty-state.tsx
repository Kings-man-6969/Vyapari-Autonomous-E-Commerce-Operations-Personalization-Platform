import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "compact";
};

/**
 * Shared empty-state with an animated illustration.
 * Floating gradient orb behind a centered icon — uses brand tokens
 * so it adapts cleanly to both light and dark themes.
 */
export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  variant = "default",
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  return (
    <div
      className={
        isCompact
          ? "rounded-2xl border border-dashed border-border/60 bg-card/40 px-6 py-12 text-center"
          : "mx-auto max-w-xl rounded-3xl border border-dashed border-border/60 bg-card/40 px-6 py-16 text-center"
      }
    >
      <div className="relative mx-auto h-28 w-28">
        {/* Soft gradient halo */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full opacity-60 blur-2xl animate-pulse-soft"
          style={{ background: "var(--gradient-brand)" }}
        />
        {/* Dashed orbit */}
        <svg
          aria-hidden
          viewBox="0 0 120 120"
          className="absolute inset-0 h-full w-full animate-spin-slow"
        >
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="1"
            strokeDasharray="3 6"
            style={{ stroke: "var(--primary)", strokeOpacity: 0.4 }}
          />
          <circle cx="114" cy="60" r="3" style={{ fill: "var(--accent)" }} />
        </svg>
        {/* Icon disc */}
        <div
          className="absolute inset-4 grid place-items-center rounded-full text-primary-foreground shadow-[var(--shadow-glow)] animate-float"
          style={{ background: "var(--gradient-brand)" }}
        >
          <Icon className="h-8 w-8" />
        </div>
      </div>

      {eyebrow && (
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>
      )}
    </div>
  );
}
