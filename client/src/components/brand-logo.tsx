import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: number;
  title?: string;
};

/**
 * Vyapari layered-tag mark: two stacked rounded squares with a "V".
 * Uses currentColor for the front tile so it inherits theme color; the
 * back tile uses primary at reduced opacity for the layered effect.
 */
export function BrandLogo({ className, size = 32, title = "Vyapari" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
    >
      <title>{title}</title>
      {/* back tile */}
      <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" opacity="0.28" />
      {/* front tile */}
      <rect x="10" y="10" width="28" height="28" rx="7" fill="currentColor" />
      {/* V */}
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fontSize="18"
        fontWeight="600"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fill="var(--primary-foreground)"
      >
        V
      </text>
    </svg>
  );
}
