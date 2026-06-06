import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, LayoutDashboard, Package, ShoppingBag, Store, Users } from "lucide-react";

import { getAdminStats } from "@/lib/admin.functions";
import { formatCents } from "@/lib/cart";
import { DashboardSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";
import { KpiStat, splitTrendDelta } from "@/components/kpi-stat";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const fetchStats = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchStats() });

  if (isLoading || !data) return <DashboardSkeleton />;

  const max = Math.max(1, ...data.trend.map((t) => t.cents));
  const revenueDelta = splitTrendDelta(data.trend, (t) => t.cents);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Overview"
        icon={LayoutDashboard}
        title="Platform pulse"
        description="A snapshot of revenue, orders and ecosystem health across every store."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiStat
          label="Revenue (gross)"
          value={formatCents(data.revenueCents)}
          icon={DollarSign}
          delta={revenueDelta}
          hint="Last 7 days vs prior 7 days"
        />
        <KpiStat label="Orders" value={data.orders} icon={ShoppingBag} />
        <KpiStat label="Products" value={data.products} icon={Package} />
        <KpiStat label="Stores" value={data.stores} icon={Store} />
        <KpiStat label="Users" value={data.users} icon={Users} />
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-medium">Revenue — last 14 days</h2>
        {data.trend.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No recent orders.</p>
        ) : (
          <>
            <div className="mt-4 flex h-32 items-end gap-1">
              {data.trend.map((t) => (
                <div key={t.date} className="flex-1" title={`${t.date}: ${formatCents(t.cents)}`}>
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${(t.cents / max) * 100}%`, minHeight: 2 }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{data.trend[0]?.date}</span>
              <span>{data.trend.at(-1)?.date}</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
