import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Package, Heart, MapPin, LogOut, Bell, Gift, MessageCircle } from "lucide-react";

import { useRequireAuth } from "@/lib/use-require-auth";
import { signOutEverywhere } from "@/lib/sign-out";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/loading-states";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Vyapari" }, { name: "robots", content: "noindex" }] }),
  component: AccountLayout,
});

const links = [
  { to: "/account/orders", label: "Orders", icon: Package },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/referrals", label: "Refer & earn", icon: Gift },
  { to: "/messages", label: "Messages", icon: MessageCircle },
] as const;

function AccountLayout() {
  const { status, user } = useRequireAuth();
  
  const location = useLocation();

  if (status !== "authed" || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <DashboardSkeleton />
      </div>
    );
  }
  const email = user.email ?? "";


  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-3xl border border-border/60 bg-card/50 p-6 sm:p-8">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          My account
        </div>
        <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-1">
          {links.map((l) => {
            const active = location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
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
          <div className="my-3 h-px bg-border/60" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-destructive"
            onClick={() => {
              void signOutEverywhere("/");
            }}
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
