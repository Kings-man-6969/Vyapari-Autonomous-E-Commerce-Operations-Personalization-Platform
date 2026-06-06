import { Check, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Tiny status pill for forms with autosave. Pair with a debounced save hook.
 */
export function AutosaveIndicator({
  status,
  className,
}: {
  status: AutosaveStatus;
  className?: string;
}) {
  if (status === "idle") return null;
  const map = {
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: "Saving…",
      tone: "text-muted-foreground",
    },
    saved: {
      icon: <Check className="h-3 w-3" />,
      label: "Saved",
      tone: "text-primary",
    },
    error: {
      icon: <CloudOff className="h-3 w-3" />,
      label: "Save failed",
      tone: "text-destructive",
    },
  } as const;
  const { icon, label, tone } = map[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
        tone,
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
}
