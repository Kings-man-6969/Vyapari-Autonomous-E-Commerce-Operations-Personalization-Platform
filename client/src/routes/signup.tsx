import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Store, ShieldCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — Vyapari" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — check your email to confirm.");
    navigate({ to: "/" });
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
          style={{ background: "var(--gradient-gold)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-96 w-96 rounded-full blur-3xl opacity-30 animate-blob"
          style={{ background: "var(--gradient-brand)", animationDelay: "-4s" }}
        />
        <Link to="/" className="relative flex items-center gap-2 text-night-foreground">
          <BrandLogo size={32} className="text-accent" />
          <span className="font-display text-xl font-semibold">Vyapari</span>
        </Link>
        <div className="relative max-w-md text-night-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            <Sparkles className="h-3 w-3" /> Free to join
          </span>
          <h2 className="mt-5 text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Start shopping with AI — or <span className="text-gold">open a storefront</span> later.
          </h2>
          <p className="mt-4 text-night-foreground/70">
            One account, two superpowers. Buy with an AI concierge in your pocket, or flip the
            switch and start selling to the entire marketplace.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-night-foreground/80">
            <li className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Personalized AI recommendations
            </li>
            <li className="flex items-center gap-2">
              <Store className="h-4 w-4 text-accent" /> One-click seller onboarding
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" /> 30-day return protection
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
            Get started
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Already on Vyapari?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
            .
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1.5 h-11"
              />
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full shadow-[var(--shadow-glow)]"
              size="lg"
            >
              {loading ? "Creating…" : "Create account"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By creating an account you agree to our terms of service and privacy policy.
          </p>
        </div>
      </section>
    </div>
  );
}
