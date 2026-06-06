import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  align?: "left" | "center";
  variant?: "default" | "bare";
  className?: string;
};

/**
 * Shared page header used across customer + dashboard routes.
 * Provides a consistent eyebrow → headline → description → actions hierarchy.
 */
export function PageHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  align = "left",
  variant = "default",
  className,
}: PageHeaderProps) {
  const centered = align === "center";
  return (
    <header
      className={cn(
        "relative",
        variant === "default" && "pb-6",
        centered ? "text-center" : "",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
          centered && "sm:flex-col sm:items-center",
        )}
      >
        <div className={cn("min-w-0", centered && "mx-auto max-w-2xl")}>
          {eyebrow && (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground",
                centered && "justify-center",
              )}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {eyebrow}
            </div>
          )}
          <h1
            className={cn(
              "mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className={cn("flex shrink-0 flex-wrap items-center gap-2", centered && "justify-center")}>
            {actions}
          </div>
        )}
      </div>
      {variant === "default" && (
        <div
          aria-hidden
          className="mt-6 h-px w-full"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in oklab, var(--border) 100%, transparent), transparent)",
          }}
        />
      )}
    </header>
  );
}

type SectionHeaderProps = {
  eyebrow?: string;
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Compact header used inside dashboard subroutes (rendered within layout shells).
 * Keeps hierarchy consistent without competing with the parent PageHeader.
 */
export function SectionHeader({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {Icon && <Icon className="h-3 w-3" />}
            {eyebrow}
          </div>
        )}
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
