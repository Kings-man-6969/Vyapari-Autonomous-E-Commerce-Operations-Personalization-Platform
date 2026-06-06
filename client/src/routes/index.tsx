import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Sparkles,
  Search,
  BarChart3,
  Bot,
  Store,
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  Star,
} from "lucide-react";

import { listFeaturedProducts, listCategories } from "@/lib/catalog.functions";
import { ProductCard } from "@/components/product-card";
import { RecentlyViewed } from "@/components/recently-viewed";
import { Recommendations } from "@/components/recommendations";
import { Button } from "@/components/ui/button";

const featuredQO = queryOptions({
  queryKey: ["featured"],
  queryFn: () => listFeaturedProducts(),
});
const categoriesQO = queryOptions({
  queryKey: ["categories"],
  queryFn: () => listCategories(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vyapari — AI Commerce OS for Modern Sellers" },
      {
        name: "description",
        content:
          "Browse curated electronics, get AI shopping recommendations, and run your storefront with AI-powered analytics on Vyapari.",
      },
      { property: "og:title", content: "Vyapari — AI Commerce OS for Modern Sellers" },
      {
        property: "og:description",
        content:
          "Browse curated electronics, get AI shopping recommendations, and run your storefront with AI-powered analytics on Vyapari.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(featuredQO),
      context.queryClient.ensureQueryData(categoriesQO),
    ]);
  },
  component: Index,
});

const TRUST_LOGOS = [
  "AETHER",
  "VOLT",
  "AURORA",
  "PIXELFORGE",
  "NIMBUS",
  "HELIOS",
  "ORBIT",
  "KESTREL",
];

const PERKS = [
  { icon: Truck, title: "Free shipping", body: "On orders over $99" },
  { icon: RotateCcw, title: "30-day returns", body: "No-questions-asked" },
  { icon: ShieldCheck, title: "2-year warranty", body: "Verified sellers only" },
  { icon: Headphones, title: "Human + AI support", body: "Replies in minutes" },
];

function Index() {
  const { data: featured } = useSuspenseQuery(featuredQO);
  const { data: cats } = useSuspenseQuery(categoriesQO);

  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden
        />
        {/* Decorative blobs kept BEHIND content, away from headline */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute right-[-10rem] top-[-6rem] h-[28rem] w-[28rem] rounded-full blur-3xl opacity-40 animate-blob"
            style={{ background: "var(--gradient-brand)" }}
          />
          <div
            className="absolute right-[10%] bottom-[-8rem] h-80 w-80 rounded-full blur-3xl opacity-30 animate-blob"
            style={{ background: "var(--gradient-gold)", animationDelay: "-6s" }}
          />
        </div>

        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-12 lg:gap-8 lg:py-32">
          <div className="lg:col-span-7">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-medium text-primary animate-fade-in"
              style={{ animationDelay: "0.05s" }}
            >
              <Sparkles className="h-3 w-3" /> AI Commerce OS — Electronics Edition
            </span>

            <h1
              className="mt-6 text-balance text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl animate-slide-up"
              style={{ animationDelay: "0.15s" }}
            >
              The marketplace
              <br className="hidden sm:block" />{" "}
              where{" "}
              <span className="bg-[image:var(--gradient-brand)] bg-clip-text text-transparent animate-gradient-pan">
                AI runs commerce
              </span>
              .
            </h1>

            <p
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground animate-slide-up"
              style={{ animationDelay: "0.3s" }}
            >
              Curated electronics from verified sellers. An AI concierge that actually understands
              what you need. Storefront tooling that runs while you sleep.
            </p>

            <div
              className="mt-9 flex flex-wrap items-center gap-3 animate-slide-up"
              style={{ animationDelay: "0.45s" }}
            >
              <Button asChild size="lg" className="group rounded-full px-6 shadow-[var(--shadow-glow)]">
                <Link to="/shop">
                  Shop the marketplace
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="group rounded-full px-6">
                <Link to="/assistant">
                  <Bot className="mr-2 h-4 w-4" /> Ask Vyapari AI
                </Link>
              </Button>
            </div>

            <div
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground animate-fade-in"
              style={{ animationDelay: "0.6s" }}
            >
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-accent text-accent" />
                ))}
                <span className="ml-1 font-medium text-foreground">4.9</span>
                <span>from 12,400+ buyers</span>
              </div>
              <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
              <span>1,800+ verified sellers</span>
              <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
              <span>Ships from 14 countries</span>
            </div>
          </div>

          {/* Hero side card — preview of AI assistant */}
          <div
            className="relative lg:col-span-5 animate-scale-in"
            style={{ animationDelay: "0.35s" }}
          >
            <div className="relative rounded-3xl border border-border/60 bg-card/80 p-5 shadow-[var(--shadow-elegant)] backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[image:var(--gradient-brand)] text-primary-foreground">
                  <Bot className="h-3.5 w-3.5" />
                </span>
                <div className="text-sm font-medium">Vyapari AI</div>
                <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                  Live
                </span>
              </div>
              <div className="space-y-3 pt-4 text-sm">
                <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-foreground">
                  I edit video on a M-series Mac. Recommend a 27" monitor under $700.
                </div>
                <div className="rounded-2xl rounded-tr-sm bg-[image:var(--gradient-brand)] px-3 py-2 text-primary-foreground">
                  For color-accurate edits, the Aurora 27" 4K is your pick — 98% DPI-P3, hardware
                  calibrated, $649. Two sellers ship in 24h.
                </div>
                <div className="flex gap-2 pt-1">
                  <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
                    Compare alternatives
                  </span>
                  <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
                    Show reviews
                  </span>
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl opacity-50"
              style={{ background: "var(--gradient-gold)" }}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────── Trust marquee ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/40 py-6">
        <div className="mb-3 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by leading electronics brands
        </div>
        <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_15%,#000_85%,transparent)]">
          <div className="flex shrink-0 animate-marquee gap-14 pr-14 text-sm font-semibold tracking-[0.18em] text-muted-foreground/70">
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((name, i) => (
              <span key={i} className="whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
          <div
            aria-hidden
            className="flex shrink-0 animate-marquee gap-14 pr-14 text-sm font-semibold tracking-[0.18em] text-muted-foreground/70"
          >
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((name, i) => (
              <span key={i} className="whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Categories ───────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Browse the catalog
            </div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Shop by category
            </h2>
          </div>
          <Link
            to="/shop"
            className="story-link hidden text-sm font-medium text-foreground sm:inline-block"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {cats.categories.map((c, i) => (
            <Link
              key={c.id}
              to="/shop"
              search={{ category: c.slug }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]"
            >
              <div
                aria-hidden
                className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60"
                style={{
                  background:
                    i % 2 === 0 ? "var(--gradient-brand)" : "var(--gradient-gold)",
                }}
              />
              <div className="text-base font-medium group-hover:text-primary">{c.name}</div>
              <div className="mt-6 flex items-center gap-1 text-xs text-muted-foreground">
                Shop
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────────────────────── Featured ───────────────────────── */}
      <section className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Editor's pick
              </div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Featured this week
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Hand-picked by our AI editorial agent — ranked by buyer satisfaction, build
                quality and price.
              </p>
            </div>
            <Link
              to="/shop"
              className="story-link hidden text-sm font-medium text-foreground sm:inline-block"
            >
              See all →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Perks band ───────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((p) => (
            <div key={p.title} className="flex items-start gap-3 bg-card p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <p.icon className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <RecentlyViewed />
      <Recommendations />

      {/* ───────────────────────── For sellers ───────────────────────── */}
      <section id="sellers" className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-night)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 top-12 -z-10 h-96 w-96 rounded-full blur-3xl opacity-30 animate-blob"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 bottom-0 -z-10 h-96 w-96 rounded-full blur-3xl opacity-25 animate-blob"
          style={{ background: "var(--gradient-gold)", animationDelay: "-5s" }}
        />

        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                <Store className="h-3 w-3" /> For sellers
              </span>
              <h2 className="mt-5 text-4xl font-semibold tracking-tight text-night-foreground sm:text-5xl">
                Run your storefront like it has a{" "}
                <span className="text-gold">24/7 AI co-founder</span>.
              </h2>
              <p className="mt-5 max-w-xl text-lg text-night-foreground/70">
                Onboard in minutes, list products, and let Vyapari's AI write your descriptions,
                tune your pricing, and surface the insights that move revenue.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
                  <Link to="/signup">
                    Start selling on Vyapari <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-night-foreground/30 bg-transparent text-night-foreground hover:bg-night-foreground/10"
                >
                  <Link to="/sell">Open seller console</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-6">
              {[
                {
                  icon: Search,
                  title: "Discoverable storefronts",
                  body: "Your products surface in the marketplace and on your own branded store page.",
                },
                {
                  icon: BarChart3,
                  title: "AI seller analytics",
                  body: "Daily insights on what's selling, what's stalling, and what to list next.",
                },
                {
                  icon: ShieldCheck,
                  title: "Trust by default",
                  body: "Verified sellers, transparent ratings, and built-in dispute protection.",
                },
                {
                  icon: Bot,
                  title: "AI copy & pricing",
                  body: "Auto-generate descriptions, alt text and price tests from one product brief.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-night-foreground/10 bg-night-foreground/5 p-6 backdrop-blur-sm transition-colors hover:bg-night-foreground/10"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-accent">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <div className="mt-4 font-medium text-night-foreground">{f.title}</div>
                  <p className="mt-1 text-sm text-night-foreground/65">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
