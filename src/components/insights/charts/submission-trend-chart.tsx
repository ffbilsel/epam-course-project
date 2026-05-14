"use client";

import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Point {
  bucket: string;
  count: number;
}

/**
 * Submission-trend area chart. Renders an empty-state panel when the
 * range produced no data (FR-030).
 */
export function SubmissionTrendChart({ data }: { data: Point[] }): JSX.Element {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-card/40 text-sm text-muted-foreground">
        No submissions in this range.
      </div>
    );
  }
  return (
    <div className="h-72 w-full" data-testid="submission-trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickMargin={6}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Submissions"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#trend-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
