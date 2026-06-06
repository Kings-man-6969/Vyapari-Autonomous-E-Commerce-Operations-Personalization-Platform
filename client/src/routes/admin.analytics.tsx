import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";

import { getPlatformAnalytics, getFraudSignals } from "@/lib/admin-extras.functions";
import { formatCents } from "@/lib/cart";
import { DashboardSkeleton } from "@/components/loading-states";
import { SectionHeader } from "@/components/page-header";
import { CsvExportButton } from "@/components/csv-export-button";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  const a = useServerFn(getPlatformAnalytics);
  const f = useServerFn(getFraudSignals);
  const aq = useQuery({ queryKey: ["platform-analytics"], queryFn: () => a() });
  const fq = useQuery({ queryKey: ["fraud-signals"], queryFn: () => f() });

  if (!aq.data) return <DashboardSkeleton />;

  const cohortRows = aq.data.cohorts.map((c) => ({
    week: c.week,
    signups: c.signups,
    ordered: c.ordered,
    rate_percent: Math.round(c.rate * 100),
  }));
  const topSellerRows = aq.data.topSellers.map((s) => ({
    name: s.name,
    gmv_usd: (s.gmv / 100).toFixed(2),
  }));

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Last 30 days"
        icon={BarChart3}
        title="Platform analytics"
        description="GMV, repeat rate, top sellers and fraud signals across the marketplace."
        actions={
          <div className="flex gap-2">
            <CsvExportButton
              filename={`top-sellers-${new Date().toISOString().slice(0, 10)}.csv`}
              rows={topSellerRows}
              columns={[
                { key: "name", label: "Seller" },
                { key: "gmv_usd", label: "GMV (USD)" },
              ]}
              label="Sellers CSV"
            />
            <CsvExportButton
              filename={`cohorts-${new Date().toISOString().slice(0, 10)}.csv`}
              rows={cohortRows}
              columns={[
                { key: "week", label: "Week" },
                { key: "signups", label: "Signups" },
                { key: "ordered", label: "Ordered" },
                { key: "rate_percent", label: "Rate (%)" },
              ]}
              label="Cohorts CSV"
            />
          </div>
        }
      />
      <div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">

          <Stat label="GMV" value={formatCents(aq.data.totalGmv)} />
          <Stat label="Orders" value={aq.data.orderCount} />
          <Stat label="AOV" value={formatCents(Math.round(aq.data.aov))} />
          <Stat
            label="Repeat rate"
            value={`${Math.round(aq.data.repeatRate * 100)}%`}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Top sellers
        </h3>
        <ul className="mt-2 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card text-sm">
          {aq.data.topSellers.map((s) => (
            <li key={s.id} className="flex justify-between p-3">
              <span>{s.name}</span>
              <span className="font-mono">{formatCents(s.gmv)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Cohort retention
        </h3>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Week</th>
                <th className="p-3">Signups</th>
                <th className="p-3">Ordered</th>
                <th className="p-3">Rate</th>
              </tr>
            </thead>
            <tbody>
              {aq.data.cohorts.map((c) => (
                <tr key={c.week} className="border-t border-border/60">
                  <td className="p-3">{c.week}</td>
                  <td className="p-3">{c.signups}</td>
                  <td className="p-3">{c.ordered}</td>
                  <td className="p-3">{Math.round(c.rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Fraud signals
        </h3>
        {fq.data?.flags.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No anomalies detected.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border/60 rounded-2xl border border-border/60 bg-card text-sm">
            {fq.data?.flags.map((f, i) => (
              <li key={i} className="flex justify-between gap-3 p-3">
                <div>
                  <div className="font-medium">{f.kind.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{f.detail}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    f.severity === "high"
                      ? "bg-destructive/20 text-destructive"
                      : "bg-primary/20 text-primary"
                  }`}
                >
                  {f.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
