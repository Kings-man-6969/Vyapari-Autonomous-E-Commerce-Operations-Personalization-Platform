import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { listAllDisputes, resolveDispute } from "@/lib/disputes.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/cart";
import { ListSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/admin/disputes")({
  component: AdminDisputes,
});

function AdminDisputes() {
  const fetchAll = useServerFn(listAllDisputes);
  const resolve = useServerFn(resolveDispute);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => fetchAll(),
  });
  const m = useMutation({
    mutationFn: (input: Parameters<typeof resolve>[0]["data"]) => resolve({ data: input }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) return <ListSkeleton />;

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Trust & safety"
        icon={ShieldAlert}
        title="Disputes & refunds"
        description="Mediate buyer-seller issues and issue refunds in a click."
      />

      {data.disputes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No disputes yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.disputes.map((d) => (
            <DisputeRow key={d.id} d={d} onResolve={(payload) => m.mutate(payload)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DisputeRow({
  d,
  onResolve,
}: {
  d: { id: string; order_id: string; reason: string; details: string | null; status: string; refund_cents: number; created_at: string };
  onResolve: (p: { id: string; status: "open" | "investigating" | "resolved" | "rejected"; resolution?: string; refund_cents: number; admin_notes?: string }) => void;
}) {
  const [refund, setRefund] = useState(String(d.refund_cents / 100));
  const [notes, setNotes] = useState("");
  return (
    <li className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono">#{d.order_id.slice(0, 8)}</div>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{d.status}</span>
      </div>
      <p className="mt-2 font-medium">{d.reason}</p>
      {d.details && <p className="mt-1 text-muted-foreground">{d.details}</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          placeholder="Refund $"
        />
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Admin notes (visible to admins only)"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            onResolve({
              id: d.id,
              status: "investigating",
              refund_cents: Math.round(Number(refund) * 100) || 0,
              admin_notes: notes || undefined,
            })
          }
        >
          Mark investigating
        </Button>
        <Button
          size="sm"
          onClick={() =>
            onResolve({
              id: d.id,
              status: "resolved",
              refund_cents: Math.round(Number(refund) * 100) || 0,
              resolution: `Refund ${formatCents(Math.round(Number(refund) * 100))}`,
              admin_notes: notes || undefined,
            })
          }
        >
          Resolve + refund
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onResolve({
              id: d.id,
              status: "rejected",
              refund_cents: 0,
              admin_notes: notes || undefined,
            })
          }
        >
          Reject
        </Button>
      </div>
    </li>
  );
}
