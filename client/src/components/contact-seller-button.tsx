import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { openThread } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function ContactSellerButton({
  sellerId,
  productId,
}: {
  sellerId: string;
  productId?: string;
}) {
  const open = useServerFn(openThread);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      const { thread_id } = await open({ data: { seller_id: sellerId, product_id: productId } });
      navigate({ to: "/messages", search: { t: thread_id } as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start chat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={onClick} variant="outline" disabled={busy} className="mt-3 w-full">
      <MessageCircle className="mr-1.5 h-4 w-4" />
      {busy ? "Opening…" : "Message seller"}
    </Button>
  );
}
