import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Users, Store, Package, ShoppingBag, ShieldCheck, AlertTriangle, Wallet, Flag, BarChart3, BookOpen, LogOut } from "lucide-react";

import { checkIsAdmin } from "@/lib/admin.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { signOutEverywhere } from "@/lib/sign-out";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardSkeleton } from "@/components/loading-states";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Vyapari" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const links = [
  { to: "/admin" as const, label: "Overview", icon: LayoutDashboard },
  { to: "/admin/analytics" as const, label: "Analytics", icon: BarChart3 },
  { to: "/admin/users" as const, label: "Users", icon: Users },
  { to: "/admin/stores" as const, label: "Stores", icon: Store },
  { to: "/admin/products" as const, label: "Products", icon: Package },
  { to: "/admin/orders" as const, label: "Orders", icon: ShoppingBag },
  { to: "/admin/disputes" as const, label: "Disputes", icon: AlertTriangle },
  { to: "/admin/payouts" as const, label: "Payouts", icon: Wallet },
  { to: "/admin/moderation" as const, label: "Moderation", icon: Flag },
  { to: "/admin/blog" as const, label: "Blog", icon: BookOpen },
];
const exact = new Set<string>(["/admin"]);

function AdminLayout() {
  const { status } = useRequireAuth();
  const location = useLocation();
  const check = useServerFn(checkIsAdmin);

  const { data, isLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => check(),
    enabled: status === "authed",
  });

  if (status !== "authed" || isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <DashboardSkeleton />
      </div>
    );
  }
  if (!data?.isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin privileges.
        </p>
      </div>
    );
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
          style={{ background: "var(--gradient-brand)" }}
        />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/20 text-accent backdrop-blur-sm">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-night-foreground/60">
              Platform control
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-night-foreground sm:text-3xl">
              Admin console
            </h1>
            <p className="text-xs text-night-foreground/60">
              Moderation, payouts, disputes & oversight
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
        <aside className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {links.map((l) => {
            const active = exact.has(l.to)
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
