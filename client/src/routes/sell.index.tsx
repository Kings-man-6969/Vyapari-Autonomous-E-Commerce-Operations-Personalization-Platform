import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Package, ShoppingBag, TrendingUp, AlertTriangle, LineChart } from "lucide-react";

import { getSellerAnalytics } from "@/lib/seller.functions";
import { getSellerInsights } from "@/lib/seller-extras.functions";
import { formatCents } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/loading-states";
import { KpiStat, splitTrendDelta } from "@/components/kpi-stat";
import { SellerOnboardingChecklist } from "@/components/seller-onboarding-checklist";


export const Route = createFileRoute("/sell/")({
  component: SellerDashboard,
});

function SellerDashboard() {
  const fetchAnalytics = useServerFn(getSellerAnalytics);
  const fetchInsights = useServerFn(getSellerInsights);
  const { data, isLoading } = useQuery({
    queryKey: ["seller-analytics"],
    queryFn: () => fetchAnalytics(),
  });
  const { data: insights } = useQuery({
    queryKey: ["seller-insights"],
    queryFn: () => fetchInsights(),
  });

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const max = Math.max(1, ...data.daily.map((d) => d.revenue_cents));
  const revenueDelta = splitTrendDelta(data.daily, (d) => d.revenue_cents);

  return (
    <div className="space-y-8">
      {insights && (
        <SellerOnboardingChecklist
          hasLogo={insights.onboarding?.hasLogo ?? false}
          hasProducts={data.products > 0}
          hasOrders={data.orders > 0}
          hasPayoutInfo={insights.onboarding?.hasBio ?? false}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiStat
          label="Revenue"
          value={formatCents(data.revenue_cents)}
          icon={DollarSign}
          delta={revenueDelta}
          hint="Last 7 days vs prior 7 days"
        />
        <KpiStat label="Units sold" value={data.units} icon={TrendingUp} />
        <KpiStat label="Orders" value={data.orders} icon={ShoppingBag} />
        <KpiStat label="Products" value={data.products} icon={Package} />
      </div>

      {insights && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <LineChart className="h-4 w-4" /> 7-day forecast
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Projected from your last {insights.forecast.based_on_days} days.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Revenue</div>
                <div className="text-2xl font-semibold">
                  {formatCents(insights.forecast.next_7_days_revenue_cents)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Units</div>
                <div className="text-2xl font-semibold">{insights.forecast.next_7_days_units}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock
              {insights.lowStock.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {insights.lowStock.length} item{insights.lowStock.length === 1 ? "" : "s"}
                </span>
              )}
            </h2>
            {insights.lowStock.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">All products are well-stocked.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border/60 text-sm">
                {insights.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <Link to="/sell/products/$id" params={{ id: p.id }} className="truncate hover:text-primary">
                      {p.title}
                    </Link>
                    <span
                      className={
                        p.stock === 0
                          ? "text-destructive text-xs font-medium"
                          : "text-amber-500 text-xs font-medium"
                      }
                    >
                      {p.stock === 0 ? "Out of stock" : `${p.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="text-sm font-medium">Revenue — last 14 days</h2>
        <div className="mt-4 flex h-32 items-end gap-1">
          {data.daily.map((d) => (
            <div key={d.date} className="flex-1" title={`${d.date}: ${formatCents(d.revenue_cents)}`}>
              <div
                className="w-full rounded-t bg-primary/70"
                style={{ height: `${(d.revenue_cents / max) * 100}%`, minHeight: 2 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{data.daily[0]?.date}</span>
          <span>{data.daily.at(-1)?.date}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Top products</h2>
          <Button asChild size="sm" variant="ghost">
            <Link to="/sell/products">Manage products</Link>
          </Button>
        </div>
        {data.top_products.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No sales yet. Add a product to get started.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {data.top_products.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <span className="truncate pr-3">{p.title}</span>
                <span className="shrink-0 text-muted-foreground">
                  {p.units} sold · {formatCents(p.revenue_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
