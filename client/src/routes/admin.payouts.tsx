import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  computePayoutBalances,
  listAllPayouts,
  recordPayout,
} from "@/lib/admin-extras.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/cart";

export const Route = createFileRoute("/admin/payouts")({
  component: AdminPayouts,
});

function AdminPayouts() {
  const bal = useServerFn(computePayoutBalances);
  const list = useServerFn(listAllPayouts);
  const record = useServerFn(recordPayout);
  const qc = useQueryClient();
  const balQ = useQuery({ queryKey: ["payout-balances"], queryFn: () => bal() });
  const listQ = useQuery({ queryKey: ["payouts-all"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (i: Parameters<typeof record>[0]["data"]) => record({ data: i }),
    onSuccess: () => {
      toast.success("Payout recorded");
      qc.invalidateQueries({ queryKey: ["payout-balances"] });
      qc.invalidateQueries({ queryKey: ["payouts-all"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Seller balances</h2>
        <p className="text-sm text-muted-foreground">
          Earnings = item subtotal × 0.9 (10% platform fee). Record a payout to clear balance.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Store</th>
                <th className="p-3">Earned</th>
                <th className="p-3">Paid</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {balQ.data?.balances.map((b) => (
                <BalanceRow
                  key={b.seller_id}
                  b={b}
                  onPay={(amount) =>
                    m.mutate({
                      seller_id: b.seller_id,
                      amount_cents: amount,
                      reference: "manual",
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold">Recent payouts</h2>
        <ul className="mt-3 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
          {(listQ.data?.payouts ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">
                  {(p as { sellers?: { store_name?: string } }).sellers?.store_name ?? "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()} — {p.reference ?? "manual"}
                </div>
              </div>
              <div className="font-mono">{formatCents(p.amount_cents)}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BalanceRow({
  b,
  onPay,
}: {
  b: { seller_id: string; name: string; earned_cents: number; paid_cents: number; balance_cents: number };
  onPay: (cents: number) => void;
}) {
  const [amt, setAmt] = useState(String(b.balance_cents / 100));
  return (
    <tr className="border-t border-border/60">
      <td className="p-3">{b.name}</td>
      <td className="p-3">{formatCents(b.earned_cents)}</td>
      <td className="p-3">{formatCents(b.paid_cents)}</td>
      <td className="p-3 font-medium">{formatCents(b.balance_cents)}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            className="w-24"
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
          />
          <Button size="sm" onClick={() => onPay(Math.round(Number(amt) * 100))}>
            Pay
          </Button>
        </div>
      </td>
    </tr>
  );
}
