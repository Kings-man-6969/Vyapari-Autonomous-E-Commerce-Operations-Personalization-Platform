import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

import {
  listMyCoupons,
  createSellerCoupon,
  toggleSellerCoupon,
  deleteSellerCoupon,
} from "@/lib/seller-coupons.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/sell/promotions")({
  component: SellerPromotions,
});

function SellerPromotions() {
  const fetchAll = useServerFn(listMyCoupons);
  const create = useServerFn(createSellerCoupon);
  const toggle = useServerFn(toggleSellerCoupon);
  const del = useServerFn(deleteSellerCoupon);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-coupons"], queryFn: () => fetchAll() });

  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [minSub, setMinSub] = useState("0");
  const [maxUses, setMaxUses] = useState("");
  const [expires, setExpires] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!percent && !amount) {
      toast.error("Set a percent or amount discount");
      return;
    }
    setBusy(true);
    try {
      await create({
        data: {
          code: code.toUpperCase(),
          description: desc || null,
          percent_off: percent ? parseInt(percent, 10) : null,
          amount_off_cents: amount ? Math.round(parseFloat(amount) * 100) : null,
          min_subtotal_cents: Math.round(parseFloat(minSub || "0") * 100),
          max_uses: maxUses ? parseInt(maxUses, 10) : null,
          expires_at: expires ? new Date(expires).toISOString() : null,
          is_active: true,
        },
      });
      toast.success("Promo created");
      setCode(""); setPercent(""); setAmount(""); setMinSub("0");
      setMaxUses(""); setExpires(""); setDesc("");
      qc.invalidateQueries({ queryKey: ["my-coupons"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Promotions</h2>
        <p className="text-sm text-muted-foreground">
          Create promo codes shoppers enter at checkout. Currently apply to the full subtotal.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SUMMER10"
            pattern="[A-Z0-9_\-]+"
            className="mt-1.5 font-mono uppercase"
          />
        </div>
        <div>
          <Label htmlFor="pct">Percent off</Label>
          <Input
            id="pct"
            type="number"
            min="1"
            max="90"
            value={percent}
            onChange={(e) => { setPercent(e.target.value); if (e.target.value) setAmount(""); }}
            placeholder="10"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="amt">— or amount off (USD)</Label>
          <Input
            id="amt"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); if (e.target.value) setPercent(""); }}
            placeholder="5.00"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="min">Min subtotal (USD)</Label>
          <Input
            id="min"
            type="number"
            step="0.01"
            min="0"
            value={minSub}
            onChange={(e) => setMinSub(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="max">Max uses</Label>
          <Input
            id="max"
            type="number"
            min="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Unlimited"
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="exp">Expires</Label>
          <Input
            id="exp"
            type="datetime-local"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="d">Description (shown internally)</Label>
          <Input
            id="d"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={200}
            className="mt-1.5"
          />
        </div>
        <Button type="submit" size="lg" disabled={busy} className="sm:col-span-2">
          <Plus className="mr-1.5 h-4 w-4" /> {busy ? "Creating…" : "Create promo"}
        </Button>
      </form>

      <div>
        <h3 className="mb-3 text-sm font-medium">Your promo codes</h3>
        {data?.coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            <Tag className="mx-auto mb-2 h-6 w-6 opacity-60" />
            No promos yet.
          </div>
        ) : (
          <div className="space-y-2">
            {data?.coupons.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
              >
                <span className="font-mono text-sm font-semibold">{c.code}</span>
                <Badge variant={c.is_active ? "default" : "secondary"}>
                  {c.is_active ? "Active" : "Off"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {c.percent_off
                    ? `${c.percent_off}% off`
                    : `$${((c.amount_off_cents ?? 0) / 100).toFixed(2)} off`}
                  {c.min_subtotal_cents > 0 &&
                    ` · min $${(c.min_subtotal_cents / 100).toFixed(2)}`}
                  {c.max_uses && ` · ${c.uses}/${c.max_uses} used`}
                  {c.expires_at && ` · exp ${new Date(c.expires_at).toLocaleDateString()}`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={async (v) => {
                      await toggle({ data: { id: c.id, is_active: v } });
                      qc.invalidateQueries({ queryKey: ["my-coupons"] });
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete promo ${c.code}?`)) return;
                      await del({ data: { id: c.id } });
                      toast.success("Deleted");
                      qc.invalidateQueries({ queryKey: ["my-coupons"] });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
