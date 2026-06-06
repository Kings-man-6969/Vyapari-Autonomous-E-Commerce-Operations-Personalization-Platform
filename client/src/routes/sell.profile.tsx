import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  User,
  Store as StoreIcon,
  Mail,
  Calendar,
  Star,
  Package,
  ShoppingBag,
  DollarSign,
  LogOut,
  KeyRound,
  ExternalLink,
  Settings,
} from "lucide-react";

import {
  getMyProfile,
  updateMyProfile,
  getMyStore,
  getSellerAnalytics,
} from "@/lib/seller.functions";
import { supabase } from "@/integrations/supabase/client";
import { signOutEverywhere } from "@/lib/sign-out";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sell/profile")({
  head: () => ({ meta: [{ title: "Seller profile — Vyapari" }] }),
  component: SellerProfile,
});

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SellerProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchStore = useServerFn(getMyStore);
  const fetchAnalytics = useServerFn(getSellerAnalytics);
  const updateProfile = useServerFn(updateMyProfile);

  const { data: profileData } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });
  const { data: storeData } = useQuery({
    queryKey: ["my-store"],
    queryFn: () => fetchStore(),
  });
  const { data: analytics } = useQuery({
    queryKey: ["seller-analytics-mini"],
    queryFn: () => fetchAnalytics(),
  });

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (profileData?.profile) {
      setFullName(profileData.profile.full_name ?? "");
      setAvatarUrl(profileData.profile.avatar_url ?? "");
    }
  }, [profileData]);

  const email = profileData?.email ?? "";
  const store = storeData?.store;
  const initials = (fullName || email || "S")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({
        data: { full_name: fullName, avatar_url: avatarUrl || null },
      });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function onResetPassword() {
    if (!email) return;
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPwLoading(false);
    }
  }

  async function onSignOut() {
    await signOutEverywhere("/");
  }

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar className="h-20 w-20">
            <AvatarImage src={avatarUrl || undefined} alt={fullName || "Seller"} />
            <AvatarFallback className="bg-[image:var(--gradient-brand)] text-lg text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                {fullName || "Unnamed seller"}
              </h2>
              <Badge variant="secondary" className="uppercase tracking-wide">
                Seller
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {email || "—"}
              </span>
              {profileData?.profile?.created_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {new Date(profileData.profile.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {store && (
            <Button asChild variant="outline" size="sm">
              <Link to="/store/$slug" params={{ slug: store.store_slug }}>
                <ExternalLink className="mr-1.5 h-4 w-4" /> View storefront
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Total revenue"
          value={analytics ? formatMoney(analytics.revenue_cents) : "—"}
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders"
          value={analytics ? String(analytics.orders) : "—"}
        />
        <StatCard
          icon={Package}
          label="Products"
          value={analytics ? String(analytics.products) : "—"}
        />
        <StatCard
          icon={Star}
          label="Store rating"
          value={store?.rating ? Number(store.rating).toFixed(1) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Personal info */}
        <form onSubmit={onSave} className="space-y-5 rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Personal information</h3>
          </div>
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input
              id="avatar_url"
              type="url"
              placeholder="https://…/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} disabled className="mt-1.5" />
            <p className="mt-1 text-xs text-muted-foreground">
              Contact support to change your email.
            </p>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>

        {/* Store snapshot + actions */}
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
            <div className="flex items-center gap-2">
              <StoreIcon className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Store</h3>
            </div>
            {store ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 rounded-lg">
                    <AvatarImage src={store.logo_url ?? undefined} />
                    <AvatarFallback className="rounded-lg">
                      {store.store_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{store.store_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      /store/{store.store_slug}
                    </p>
                  </div>
                </div>
                {store.bio && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{store.bio}</p>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/sell/settings">
                    <Settings className="mr-1.5 h-4 w-4" /> Edit store settings
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No store yet.</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-6">
            <h3 className="font-semibold">Security & account</h3>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={onResetPassword}
              disabled={pwLoading || !email}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {pwLoading ? "Sending…" : "Send password reset email"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
