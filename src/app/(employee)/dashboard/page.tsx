import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { HistoryTab } from "@/components/dashboard/history-tab";
import { auth } from "@/server/auth-options";
import { listConcludedByAuthor } from "@/server/idea-listing";

/**
 * Employee dashboard with an Active / History tab split (FR-037).
 * The History tab lists the caller's concluded ideas (APPROVED,
 * REJECTED, IMPLEMENTED); Active is a stub link surface — the
 * primary "Active" experience is still the My Ideas list.
 */
export default async function EmployeeDashboardPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  const history = await listConcludedByAuthor({
    id: session.user.id,
    role: session.user.role,
  });

  return (
          <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your active work and concluded ideas.
          </p>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-base font-medium">Active ideas</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  See your in-flight submissions on the{" "}
                  <a href="/my-ideas" className="font-medium underline">
                    My Ideas
                  </a>{" "}
                  page.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab rows={history} />
          </TabsContent>
        </Tabs>
      </main>
  );
}
