import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RangePicker } from "@/components/insights/range-picker";
import { SubmissionTrendChart } from "@/components/insights/charts/submission-trend-chart";
import { ApprovalRateChart } from "@/components/insights/charts/approval-rate-chart";
import { CategoryDistributionChart } from "@/components/insights/charts/category-distribution-chart";
import {
  getApprovalRate,
  getCategoryDistribution,
  getSubmissionTrend,
} from "@/server/insights-service";
import type { InsightsRangeInput } from "@/lib/validation/insights";
import type { Role } from "@/db/schema";

interface Props {
  range: InsightsRangeInput;
  actor: { id: string; role: Role };
  title?: string;
  subtitle?: string;
}

/**
 * Server-side insights surface. Parallel-fetches the three charts via
 * the pure service layer (no HTTP round-trip from the RSC). Honours
 * the role-scope rule inside the service (EVALUATOR sees aggregate
 * only; EMPLOYEE → INSIGHTS_FORBIDDEN).
 */
export async function InsightsPage({ range, actor, title, subtitle }: Props): Promise<JSX.Element> {
  const [trend, approval, dist] = await Promise.all([
    Promise.resolve(getSubmissionTrend(range, actor)),
    Promise.resolve(getApprovalRate(range, actor)),
    Promise.resolve(getCategoryDistribution(range, actor)),
  ]);

  return (
    <main className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title ?? "Insights"}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">
          Window: {trend.range.from} → {trend.range.to} · bucket: {trend.range.bucket}
        </p>
      </div>

      <RangePicker />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submission trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionTrendChart data={trend.data} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approval rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalRateChart data={approval.data} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Category distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryDistributionChart data={dist.data} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
