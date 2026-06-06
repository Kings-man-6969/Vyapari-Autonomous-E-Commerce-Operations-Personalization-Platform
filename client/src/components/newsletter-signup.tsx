import { useState } from "react";
import { Mail, Loader2, Check } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
});

const KEY = "vyapari-newsletter";

export function NewsletterSignup() {
  const [state, setState] = useState<"idle" | "loading" | "done">(() => {
    try {
      return typeof localStorage !== "undefined" && localStorage.getItem(KEY)
        ? "done"
        : "idle";
    } catch {
      return "idle";
    }
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: fd.get("email") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setState("loading");
    // Simulated double opt-in
    await new Promise((r) => setTimeout(r, 600));
    try {
      localStorage.setItem(KEY, parsed.data.email);
    } catch {
      /* ignore */
    }
    setState("done");
    toast.success("Almost there", {
      description: "Check your inbox to confirm your subscription.",
    });
  }

  if (state === "done") {
    return (
      <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-primary" /> You're subscribed — check your inbox.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row"
      aria-label="Subscribe to the Vyapari newsletter"
    >
      <label htmlFor="newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="relative flex-1">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="pl-9"
          autoComplete="email"
        />
      </div>
      <Button type="submit" disabled={state === "loading"} className="shrink-0">
        {state === "loading" ? (
          <>
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Subscribing
          </>
        ) : (
          "Subscribe"
        )}
      </Button>
    </form>
  );
}
