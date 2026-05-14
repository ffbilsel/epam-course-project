"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Summary {
  approved: number;
  rejected: number;
  pending: number;
  rate: number;
  series: Array<{ bucket: string; count: number }>;
}

/**
 * Approval-rate composed chart. KPI cards (approved/rejected/pending
 * and the percentage rate) plus a per-bucket bar series.
 */
export function ApprovalRateChart({ data }: { data: Summary }): JSX.Element {
  const ratePct = Math.round(data.rate * 1000) / 10;
  const decided = data.approved + data.rejected;
  return (
    <div className="space-y-4" data-testid="approval-rate-chart">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile label="Approved" value={data.approved} tone="positive" />
        <KpiTile label="Rejected" value={data.rejected} tone="negative" />
        <KpiTile label="Pending" value={data.pending} tone="muted" />
        <KpiTile
          label="Approval rate"
          value={decided === 0 ? "—" : `${ratePct.toFixed(1)}%`}
          tone="brand"
        />
      </div>
      {data.series.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
          No decisions in this range.
        </div>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} width={32} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="count"
                name="Submissions"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Trend"
                stroke="hsl(var(--chart-1))"
                fill="transparent"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "positive" | "negative" | "muted" | "brand";
}): JSX.Element {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : tone === "brand"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
