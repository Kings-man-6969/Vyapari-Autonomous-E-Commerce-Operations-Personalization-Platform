import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  ShoppingBag,
  Heart,
  Package,
  Sparkles,
  Store,
  MessageSquare,
  GitCompare,
  Home,
  User,
  Settings,
  LayoutDashboard,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRole, landingForRole } from "@/lib/use-role";

/**
 * Global ⌘K / Ctrl+K command palette.
 * Mounted once in the root layout; offers quick navigation
 * across the most-used routes for each role.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { role } = useRole();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function go(to: string) {
    setOpen(false);
    // small defer so the dialog close animation doesn't fight the navigation
    setTimeout(() => navigate({ to }), 30);
  }

  const isAdmin = role === "admin";
  const isSeller = role === "seller";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, products, settings…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Jump to">
          <CommandItem onSelect={() => go("/")}>
            <Home className="mr-2 h-4 w-4" />
            Home
          </CommandItem>
          <CommandItem onSelect={() => go("/shop")}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            Shop
          </CommandItem>
          <CommandItem onSelect={() => go("/assistant")}>
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI
          </CommandItem>
          <CommandItem onSelect={() => go("/cart")}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            Cart
          </CommandItem>
          <CommandItem onSelect={() => go("/compare")}>
            <GitCompare className="mr-2 h-4 w-4" />
            Compare
          </CommandItem>
        </CommandGroup>

        {role === "customer" && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Your account">
              <CommandItem onSelect={() => go("/account/orders")}>
                <Package className="mr-2 h-4 w-4" />
                Orders
              </CommandItem>
              <CommandItem onSelect={() => go("/account/wishlist")}>
                <Heart className="mr-2 h-4 w-4" />
                Wishlist
              </CommandItem>
              <CommandItem onSelect={() => go("/account/addresses")}>
                <User className="mr-2 h-4 w-4" />
                Addresses
              </CommandItem>
              <CommandItem onSelect={() => go("/messages")}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Messages
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {isSeller && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Seller">
              <CommandItem onSelect={() => go(landingForRole("seller"))}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Seller dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/sell/products")}>
                <Store className="mr-2 h-4 w-4" />
                Products
              </CommandItem>
              <CommandItem onSelect={() => go("/sell/orders")}>
                <Package className="mr-2 h-4 w-4" />
                Orders
              </CommandItem>
              <CommandItem onSelect={() => go("/sell/promotions")}>
                <Sparkles className="mr-2 h-4 w-4" />
                Promotions
              </CommandItem>
              <CommandItem onSelect={() => go("/sell/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              <CommandItem onSelect={() => go("/admin")}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Overview
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/users")}>
                <User className="mr-2 h-4 w-4" />
                Users
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/orders")}>
                <Package className="mr-2 h-4 w-4" />
                Orders
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/disputes")}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Disputes
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/analytics")}>
                <Search className="mr-2 h-4 w-4" />
                Analytics
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
