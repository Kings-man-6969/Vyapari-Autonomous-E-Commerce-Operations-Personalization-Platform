import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Mail, Trash2, Bell, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/page-header";
import {
  clearMockNotifications,
  listMockNotifications,
  type MockNotification,
} from "@/lib/notifications";
import { listMyAlerts, toggleAlert } from "@/lib/alerts.functions";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";
import { formatCents } from "@/lib/cart";

export const Route = createFileRoute("/account/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Vyapari" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [items, setItems] = useState<MockNotification[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const fetchAlerts = useServerFn(listMyAlerts);
  const toggle = useServerFn(toggleAlert);
  const qc = useQueryClient();

  useEffect(() => {
    const refresh = () => setItems(listMockNotifications());
    refresh();
    window.addEventListener("mock-notifications-updated", refresh);
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const unsub = subscribeToAuthIdentity((s) => setSignedIn(!!s));
    return () => {
      window.removeEventListener("mock-notifications-updated", refresh);
      unsub();
    };
  }, []);

  const { data: alertData } = useQuery({
    enabled: signedIn,
    queryKey: ["my-alerts"],
    queryFn: () => fetchAlerts(),
  });

  async function unsubscribe(productId: string, kind: "price_drop" | "back_in_stock") {
    await toggle({ data: { productId, kind } });
    toast.success("Unsubscribed");
    qc.invalidateQueries({ queryKey: ["my-alerts"] });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Inbox"
        icon={Bell}
        title="Notifications"
        description="Mock inbox — real email delivery comes later."
        actions={
          items.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => clearMockNotifications()}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear
            </Button>
          ) : null
        }
      />


      {signedIn && (alertData?.alerts.length ?? 0) > 0 && (
        <section className="mt-8 rounded-2xl border border-border/60 bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Bell className="h-4 w-4" /> Active alerts ({alertData?.alerts.length})
          </h2>
          <ul className="mt-3 divide-y divide-border/60">
            {alertData?.alerts.map((a) => {
              const p = (a as unknown as { products?: { title: string; slug: string; price_cents: number; stock: number } | null }).products;
              return (
                <li key={a.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    {p ? (
                      <Link to="/shop/$slug" params={{ slug: p.slug }} className="font-medium hover:text-primary">
                        {p.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">(deleted product)</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {a.kind === "price_drop" ? "Price drop alert" : "Back-in-stock alert"}
                      {p && ` · ${formatCents(p.price_cents)}`}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => unsubscribe(a.product_id, a.kind as "price_drop" | "back_in_stock")}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Off
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
            <Mail className="mx-auto mb-3 h-6 w-6 opacity-60" />
            No notifications yet.
          </div>
        ) : (
          items.map((n) => (
            <article
              key={n.id}
              className="rounded-2xl border border-border/60 bg-card p-4"
            >
              <header className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">{n.kind}</span>
                <time>{new Date(n.createdAt).toLocaleString()}</time>
              </header>
              <h2 className="mt-1 text-base font-semibold">{n.subject}</h2>
              <p className="mt-1 text-sm text-muted-foreground">To: {n.to}</p>
              <p className="mt-3 whitespace-pre-wrap text-sm">{n.body}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
