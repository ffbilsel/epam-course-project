"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Entry {
  categoryId: string;
  categoryName: string;
  count: number;
  share: number;
}

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

/**
 * Category-distribution horizontal bar chart. Each bar carries the
 * absolute count + share percentage.
 */
export function CategoryDistributionChart({ data }: { data: Entry[] }): JSX.Element {
  const nonEmpty = data.filter((d) => d.count > 0);
  if (nonEmpty.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
        No submissions across any category in this range.
      </div>
    );
  }
  const height = Math.max(220, nonEmpty.length * 36 + 48);
  return (
    <div className="w-full" style={{ height }} data-testid="category-distribution-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={nonEmpty}
          margin={{ top: 8, right: 32, bottom: 8, left: 16 }}
        >
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="categoryName"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            width={120}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value: number, _name, ctx) => {
              const share = (ctx?.payload?.share ?? 0) as number;
              return [`${value} (${(share * 100).toFixed(1)}%)`, "Ideas"];
            }}
          />
          <Bar dataKey="count" name="Ideas" radius={[0, 4, 4, 0]}>
            {nonEmpty.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
            <LabelList
              dataKey="share"
              position="right"
              formatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              style={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
