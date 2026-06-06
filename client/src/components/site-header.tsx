import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  ShoppingBag,
  Search,
  User,
  ShoppingCart,
  GitCompare,
  Menu,
  LogOut,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { useCompare } from "@/lib/compare";
import { useRole, landingForRole, type Role } from "@/lib/use-role";
import { signOutEverywhere } from "@/lib/sign-out";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationBell } from "@/components/notification-bell";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useRole();
  const items = useCart();
  const compareItems = useCompare();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const compareCount = compareItems.length;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const unsub = subscribeToAuthIdentity((s) => {
      setEmail(s?.user.email ?? null);
    });
    return () => unsub();
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navLinks = getNavLinks(role, !!email);
  const showShopperChrome = !email || role === "customer";

  const isActive = (to: string) =>
    pathname === to || (to !== "/" && pathname.startsWith(to + "/"));

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        {/* Mobile menu trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-2"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-xs p-0 flex flex-col gap-0"
          >
            <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
              <SheetTitle className="flex items-center gap-2 text-base">
                <BrandLogo size={28} className="text-primary" />
                Vyapari
                {role && email && (
                  <span className="ml-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {role}
                  </span>
                )}
              </SheetTitle>
            </SheetHeader>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="flex flex-col gap-0.5">
                {navLinks.map((l, idx) => {
                  const active = isActive(l.to);
                  return (
                    <li
                      key={l.to}
                      className="animate-fade-in"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <SheetClose asChild>
                        <Link
                          to={l.to}
                          className={cn(
                            "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary"
                              : "text-foreground/80 hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {l.label}
                        </Link>
                      </SheetClose>
                    </li>
                  );
                })}
              </ul>

              {showShopperChrome && (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <p className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Quick links
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    <li>
                      <SheetClose asChild>
                        <Link
                          to="/cart"
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent"
                        >
                          <span className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" /> Cart
                          </span>
                          {cartCount > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                              {cartCount}
                            </span>
                          )}
                        </Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose asChild>
                        <Link
                          to="/compare"
                          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm hover:bg-accent"
                        >
                          <span className="flex items-center gap-2">
                            <GitCompare className="h-4 w-4" /> Compare
                          </span>
                          {compareCount > 0 && (
                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                              {compareCount}
                            </span>
                          )}
                        </Link>
                      </SheetClose>
                    </li>
                    <li>
                      <SheetClose asChild>
                        <Link
                          to="/assistant"
                          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-accent"
                        >
                          <Sparkles className="h-4 w-4" /> Ask AI
                        </Link>
                      </SheetClose>
                    </li>
                  </ul>
                </div>
              )}
            </nav>

            <div className="border-t border-border/60 p-4">
              {email ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{email}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setMobileOpen(false);
                      await signOutEverywhere("/");
                    }}
                  >
                    <LogOut className="mr-1.5 h-4 w-4" /> Sign out
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <SheetClose asChild>
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link to="/login">Sign in</Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button asChild size="sm" className="flex-1">
                      <Link to="/signup">Get started</Link>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Link
          to={email && role ? landingForRole(role) : "/"}
          className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <BrandLogo size={32} className="text-primary drop-shadow-[var(--shadow-glow)]" />
          <span className="text-lg">Vyapari</span>
          {role && email && (
            <span className="ml-1 hidden rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              {role}
            </span>
          )}
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          {navLinks.map((l) => {
            const active = isActive(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "story-link transition-colors hover:text-foreground",
                  active && "text-foreground font-medium",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />

          {showShopperChrome && (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
                <Link to="/shop">
                  <Search className="mr-1.5 h-4 w-4" /> Browse
                  <kbd className="ml-2 hidden rounded border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:inline">
                    ⌘K
                  </kbd>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/assistant">
                  <Sparkles className="mr-1.5 h-4 w-4" /> Ask AI
                </Link>
              </Button>
              {compareCount > 0 && (
                <Button asChild variant="ghost" size="icon" className="relative hidden sm:inline-flex">
                  <Link to="/compare" aria-label="Compare">
                    <GitCompare className="h-4 w-4" />
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                      {compareCount}
                    </span>
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link to="/cart" aria-label="Cart">
                  <ShoppingCart className="h-4 w-4" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground animate-scale-in">
                      {cartCount}
                    </span>
                  )}
                </Link>
              </Button>
            </>
          )}
          {email && <NotificationBell />}

          {email ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="hidden sm:inline-flex">
                  <User className="mr-1.5 h-4 w-4" />
                  <span className="hidden md:inline">{email.split("@")[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={role ? landingForRole(role) : "/"}>
                    {role === "admin"
                      ? "Admin console"
                      : role === "seller"
                        ? "Seller dashboard"
                        : "Shop"}
                  </Link>
                </DropdownMenuItem>
                {role === "customer" && (
                  <DropdownMenuItem asChild>
                    <Link to="/account/orders">My orders</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    void signOutEverywhere("/");
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link to="/signup">
                  <ShoppingBag className="mr-1.5 h-4 w-4" /> Get started
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

type NavLink = { to: string; label: string };

function getNavLinks(role: Role | null, signedIn: boolean): NavLink[] {
  if (!signedIn) {
    return [
      { to: "/shop", label: "Shop" },
      { to: "/blog", label: "Blog" },
      { to: "/assistant", label: "AI Assistant" },
      { to: "/sell", label: "Sell on Vyapari" },
    ];
  }
  if (role === "admin") {
    return [
      { to: "/admin", label: "Overview" },
      { to: "/admin/analytics", label: "Analytics" },
      { to: "/admin/users", label: "Users" },
      { to: "/admin/stores", label: "Stores" },
      { to: "/admin/orders", label: "Orders" },
      { to: "/admin/disputes", label: "Disputes" },
      { to: "/admin/blog", label: "Blog" },
    ];
  }
  if (role === "seller") {
    return [
      { to: "/sell", label: "Dashboard" },
      { to: "/sell/products", label: "Products" },
      { to: "/sell/orders", label: "Orders" },
      { to: "/sell/promotions", label: "Promotions" },
      { to: "/sell/assistant", label: "AI Assistant" },
      { to: "/messages", label: "Messages" },
    ];
  }
  return [
    { to: "/shop", label: "Shop" },
    { to: "/blog", label: "Blog" },
    { to: "/assistant", label: "AI Assistant" },
    { to: "/account/orders", label: "Orders" },
    { to: "/account/wishlist", label: "Wishlist" },
    { to: "/messages", label: "Messages" },
  ];
}
