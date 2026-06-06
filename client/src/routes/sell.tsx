import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Package, ShoppingBag, Settings, Sparkles, Store, Tag, Upload, UserCircle, LogOut } from "lucide-react";

import { getMyStore, createStore } from "@/lib/seller.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { signOutEverywhere } from "@/lib/sign-out";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { DashboardSkeleton } from "@/components/loading-states";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [{ title: "Seller dashboard — Vyapari" }, { name: "robots", content: "noindex" }] }),
  component: SellLayout,
});

const links = [
  { to: "/sell" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/sell/products" as const, label: "Products", icon: Package },
  { to: "/sell/products/import" as const, label: "Bulk import", icon: Upload },
  { to: "/sell/orders" as const, label: "Orders", icon: ShoppingBag },
  { to: "/sell/promotions" as const, label: "Promotions", icon: Tag },
  { to: "/sell/assistant" as const, label: "AI Assistant", icon: Sparkles },
  { to: "/sell/settings" as const, label: "Store settings", icon: Settings },
  { to: "/sell/profile" as const, label: "Profile", icon: UserCircle },
];
const exactPaths = new Set<string>(["/sell"]);

function SellLayout() {
  const { status } = useRequireAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fetchStore = useServerFn(getMyStore);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => fetchStore(),
    enabled: status === "authed",
  });

  if (status !== "authed" || isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <DashboardSkeleton />
      </div>
    );
  }


  if (!data?.store) {
    return <OnboardingPanel onDone={() => refetch()} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div
        className="relative overflow-hidden rounded-3xl border border-border/60 p-6 sm:p-8"
        style={{ background: "var(--gradient-night)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl opacity-30"
          style={{ background: "var(--gradient-gold)" }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-night-foreground/60">
              <Store className="h-3 w-3" /> Seller console
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-night-foreground sm:text-4xl">
              {data.store.store_name}
            </h1>
            <p className="mt-1.5 text-sm text-night-foreground/65">
              Public storefront:{" "}
              <Link
                to="/store/$slug"
                params={{ slug: data.store.store_slug }}
                className="text-accent hover:underline"
              >
                /store/{data.store.store_slug}
              </Link>
            </p>
          </div>
          <Button asChild size="sm" className="rounded-full bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/sell/products/new">+ New product</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
        <aside className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {links.map((l) => {
            const active = exactPaths.has(l.to)
              ? location.pathname === l.to
              : location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            );
          })}
          <div className="my-3 hidden h-px bg-border/60 lg:block" />
          <Button
            variant="ghost"
            size="sm"
            className="justify-start text-muted-foreground hover:text-destructive lg:w-full"
            onClick={() => void signOutEverywhere("/")}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </aside>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function OnboardingPanel({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createStore);
  const [storeName, setStoreName] = useState("");
  const [bio, setBio] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await create({
        data: {
          store_name: storeName,
          bio: bio || null,
          logo_url: logo || null,
          banner_url: null,
        },
      });
      toast.success("Store created!");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create store");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-brand)] text-primary-foreground">
          <Store className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Open your storefront</h1>
          <p className="text-sm text-muted-foreground">
            Start selling electronics on Vyapari in under a minute.
          </p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-border/60 bg-card p-6">
        <div>
          <Label htmlFor="store_name">Store name</Label>
          <Input
            id="store_name"
            required
            minLength={2}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Voltbox Electronics"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="bio">About your store</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What do you sell, who's it for?"
            rows={4}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="logo">Logo URL (optional)</Label>
          <Input
            id="logo"
            type="url"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://…/logo.png"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create store"}
        </Button>
      </form>
    </div>
  );
}
