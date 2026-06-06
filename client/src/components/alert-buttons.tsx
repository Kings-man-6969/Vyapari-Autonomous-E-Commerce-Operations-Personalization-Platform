import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bell, BellOff, PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleAlert, getMyAlertsForProduct } from "@/lib/alerts.functions";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToAuthIdentity } from "@/lib/auth-subscribe";

export function AlertButtons({ productId, inStock }: { productId: string; inStock: boolean }) {
  const fetchAlerts = useServerFn(getMyAlertsForProduct);
  const toggle = useServerFn(toggleAlert);
  const qc = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const unsub = subscribeToAuthIdentity((s) => setSignedIn(!!s));
    return () => unsub();
  }, []);

  const { data } = useQuery({
    enabled: signedIn,
    queryKey: ["alerts-for-product", productId],
    queryFn: () => fetchAlerts({ data: { productId } }),
  });
  const kinds = new Set(data?.kinds ?? []);

  async function onToggle(kind: "price_drop" | "back_in_stock") {
    if (!signedIn) {
      toast.error("Sign in to subscribe to alerts.");
      return;
    }
    try {
      const res = await toggle({ data: { productId, kind } });
      toast.success(res.subscribed ? "Alert turned on" : "Alert turned off");
      qc.invalidateQueries({ queryKey: ["alerts-for-product", productId] });
      qc.invalidateQueries({ queryKey: ["my-alerts"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2 text-xs">
      <Button
        size="sm"
        variant={kinds.has("price_drop") ? "default" : "outline"}
        onClick={() => onToggle("price_drop")}
      >
        {kinds.has("price_drop") ? <BellOff className="mr-1.5 h-3.5 w-3.5" /> : <Bell className="mr-1.5 h-3.5 w-3.5" />}
        Price drop alert
      </Button>
      {!inStock && (
        <Button
          size="sm"
          variant={kinds.has("back_in_stock") ? "default" : "outline"}
          onClick={() => onToggle("back_in_stock")}
        >
          <PackageCheck className="mr-1.5 h-3.5 w-3.5" /> Back-in-stock alert
        </Button>
      )}
    </div>
  );
}
