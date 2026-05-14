import { redirect } from "next/navigation";
import { auth } from "@/server/auth-options";
import { InsightsPage } from "@/components/insights/insights-page";
import { InsightsRangeSchema } from "@/lib/validation/insights";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Insights surface (`/insights`). Open to EVALUATOR and ADMIN.
 * EVALUATOR sees the aggregate-only projection; ADMIN sees the full
 * payload. EMPLOYEE is redirected to `/my-ideas`.
 */
export default async function InsightsRoute({ searchParams }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/insights");
  if (session.user.role === "EMPLOYEE") redirect("/my-ideas");

  const range = InsightsRangeSchema.parse({
    preset: paramStr(searchParams.preset),
    bucket: paramStr(searchParams.bucket),
    from: paramStr(searchParams.from),
    to: paramStr(searchParams.to),
  });

  const subtitle =
    session.user.role === "ADMIN"
      ? "Organisation-wide submissions, decisions, and category mix."
      : "Aggregate submissions, decisions, and category mix (identities masked).";

  return (
    <InsightsPage
      range={range}
      actor={{ id: session.user.id, role: session.user.role }}
      subtitle={subtitle}
    />
  );
}

function paramStr(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v && v.length > 0 ? v : undefined;
}
