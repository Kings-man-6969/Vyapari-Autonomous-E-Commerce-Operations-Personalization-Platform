import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "vyapari-cookie-consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  function decide(value: "accepted" | "declined") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
    setShow(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vyapari-consent", { detail: value }));
    }
  }

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-border/60 bg-background/95 p-4 shadow-[var(--shadow-elegant)] backdrop-blur-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Cookie className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">We use cookies</p>
          <p className="mt-0.5 text-muted-foreground">
            We use essential cookies to run Vyapari and optional analytics cookies to
            improve it. You can change this any time.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide("accepted")}>
              Accept all
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide("declined")}>
              Essential only
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => decide("declined")}
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
