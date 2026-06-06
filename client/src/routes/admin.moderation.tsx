import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getModerationQueue,
  resolveModerationItem,
  scanContentWithAI,
} from "@/lib/admin-extras.functions";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/loading-states";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

function AdminModeration() {
  const list = useServerFn(getModerationQueue);
  const scan = useServerFn(scanContentWithAI);
  const resolve = useServerFn(resolveModerationItem);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["moderation"],
    queryFn: () => list(),
  });
  const scanM = useMutation({
    mutationFn: () => scan(),
    onSuccess: (r) => {
      toast.success(`Scanned ${r.scanned}, flagged ${r.flagged}, queued ${r.inserted}`);
      qc.invalidateQueries({ queryKey: ["moderation"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const resolveM = useMutation({
    mutationFn: (i: Parameters<typeof resolve>[0]["data"]) => resolve({ data: i }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["moderation"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">AI moderation queue</h2>
        <Button size="sm" onClick={() => scanM.mutate()} disabled={scanM.isPending}>
          {scanM.isPending ? "Scanning…" : "Run AI scan"}
        </Button>
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : data?.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Queue is empty. Run a scan.</p>
      ) : (
        <ul className="space-y-3">
          {data?.items.map((i) => (
            <li
              key={i.id}
              className="rounded-2xl border border-border/60 bg-card p-4 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">
                  {i.entity_type} · <span className="font-mono">{i.entity_id.slice(0, 8)}</span>
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {i.status} {i.ai_score ? `· score ${Number(i.ai_score).toFixed(2)}` : ""}
                </span>
              </div>
              {i.reason && <p className="mt-1 text-muted-foreground">{i.reason}</p>}
              {i.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => resolveM.mutate({ id: i.id, action: "remove" })}
                  >
                    Remove content
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveM.mutate({ id: i.id, action: "approve" })}
                  >
                    Approve
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
