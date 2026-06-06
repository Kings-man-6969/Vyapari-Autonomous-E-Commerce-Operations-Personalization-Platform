import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, Truck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";
import { fetchPrimaryRole, landingForRole } from "@/lib/use-role";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Vyapari" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoading(false);
      return toast.error(error?.message ?? "Sign in failed");
    }
    const role = await fetchPrimaryRole(data.user.id);
    setLoading(false);
    toast.success(`Welcome back — signed in as ${role}`);
    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      navigate({ to: redirect });
    } else {
      navigate({ to: landingForRole(role) });
    }
  }

  return (
    <div className="grid min-h-[calc(100vh-9rem)] lg:grid-cols-2">
      {/* Brand panel */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ background: "var(--gradient-night)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl opacity-40 animate-blob"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full blur-3xl opacity-30 animate-blob"
          style={{ background: "var(--gradient-gold)", animationDelay: "-4s" }}
        />
        <Link to="/" className="relative flex items-center gap-2 text-night-foreground">
          <BrandLogo size={32} className="text-accent" />
          <span className="font-display text-xl font-semibold">Vyapari</span>
        </Link>
        <div className="relative max-w-md text-night-foreground">
          <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            The AI commerce platform <span className="text-gold">trusted by 12,400+ buyers</span>.
          </h2>
          <p className="mt-4 text-night-foreground/70">
            Sign in to access your orders, wishlist, conversations with sellers, and saved
            recommendations from Vyapari AI.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-night-foreground/80">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> Bank-grade encryption
            </li>
            <li className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-accent" /> Real-time order tracking
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Personal AI shopping concierge
            </li>
          </ul>
        </div>
        <div className="relative text-xs text-night-foreground/40">
          © {new Date().getFullYear()} Vyapari — AI Commerce OS
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-2">
              <BrandLogo size={32} className="text-primary" />
              <span className="font-display text-xl font-semibold">Vyapari</span>
            </Link>
          </div>
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Welcome back
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Don't have one yet?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
            .
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="text-xs text-muted-foreground">Min 8 characters</span>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full shadow-[var(--shadow-glow)]"
              size="lg"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By signing in you agree to our terms of service and privacy policy.
          </p>
        </div>
      </section>
    </div>
  );
}
