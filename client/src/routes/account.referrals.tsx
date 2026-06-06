import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { getOrCreateMyReferral } from "@/lib/referrals.functions";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";

export const Route = createFileRoute("/account/referrals")({
  head: () => ({ meta: [{ title: "Referrals — Vyapari" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const fetch = useServerFn(getOrCreateMyReferral);
  const { data, isLoading } = useQuery({ queryKey: ["my-referral"], queryFn: () => fetch() });
  const [copied, setCopied] = useState(false);

  if (isLoading) return <ListSkeleton />;
  if (!data) return null;

  const link = typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${data.code}` : "";
  const reward = (data.reward_cents / 100).toFixed(2);
  const earned = (data.total_reward_cents / 100).toFixed(2);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Refer & earn"
        icon={Gift}
        title="Invite friends, both get credit"
        description={`Give $${reward}, get $${reward} when a friend signs up and places their first order.`}
      />
      <div className="space-y-6">
        <div className="rounded-2xl border border-border/60 bg-[image:var(--gradient-brand)]/10 p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your invite code</div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="rounded-xl bg-background px-4 py-3 font-mono text-lg font-semibold tracking-widest">
              {data.code}
            </div>
            <Button onClick={copy}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              Copy invite link
            </Button>
          </div>
        </div>


      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Friends joined</p>
          <p className="mt-1 text-3xl font-semibold">{data.completed_count}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Credit earned</p>
          <p className="mt-1 text-3xl font-semibold">${earned}</p>
        </div>
      </div>
      </div>
    </div>
  );
}
