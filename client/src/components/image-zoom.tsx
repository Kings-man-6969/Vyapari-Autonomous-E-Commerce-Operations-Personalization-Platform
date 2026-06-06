import { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Hover-to-pan zoom on desktop, click to open a fullscreen lightbox.
 * Falls back gracefully on touch — tap simply opens the lightbox.
 */
export function ImageZoom({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({ x, y });
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <div
        ref={wrapRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setPos(null)}
        onClick={() => setOpen(true)}
        className={cn(
          "group relative cursor-zoom-in overflow-hidden",
          className,
        )}
      >
        <img
          src={src}
          alt={alt}
          loading="eager"
          decoding="async"
          className={cn(
            "h-full w-full object-cover transition-transform duration-300 ease-out will-change-transform",
            pos ? "scale-[1.6]" : "scale-100",
            imgClassName,
          )}
          style={
            pos
              ? { transformOrigin: `${pos.x}% ${pos.y}%` }
              : { transformOrigin: "center center" }
          }
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-foreground/80 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100"
        >
          <ZoomIn className="h-3 w-3" /> Zoom
        </span>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md animate-fade-in"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-[var(--shadow-elegant)]"
          />
        </div>
      )}
    </>
  );
}
