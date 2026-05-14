import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { HistoryTab } from "@/components/dashboard/history-tab";
import { auth } from "@/server/auth-options";
import { listConcludedByAuthor } from "@/server/idea-listing";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse every idea in the organisation and your quick actions.
        </p>
      </div>

      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="active">Quick actions</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <HistoryTab rows={history} />
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-8">
                <p className="text-base font-medium">My active ideas</p>
                <p className="text-sm text-muted-foreground">
                  See your in-flight submissions on the{" "}
                  <a href="/my-ideas" className="font-medium underline">
                    My Ideas
                  </a>{" "}
                  page.
                </p>
              </CardContent>
            </Card>
            {(session.user.role === "EVALUATOR" || session.user.role === "ADMIN") && (
              <Card>
                <CardContent className="flex flex-col items-start gap-3 py-8">
                  <p className="text-base font-medium">Review queue</p>
                  <p className="text-sm text-muted-foreground">
                    Triage submitted ideas from the{" "}
                    <a href="/queue" className="font-medium underline">
                      Review queue
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>
            )}
            {session.user.role === "ADMIN" && (
              <Card>
                <CardContent className="flex flex-col items-start gap-3 py-8">
                  <p className="text-base font-medium">Admin tools</p>
                  <p className="text-sm text-muted-foreground">
                    Manage{" "}
                    <a href="/admin/ideas" className="font-medium underline">
                      ideas
                    </a>
                    ,{" "}
                    <a href="/admin/users" className="font-medium underline">
                      users
                    </a>
                    , and{" "}
                    <a href="/admin/categories" className="font-medium underline">
                      categories
                    </a>
                    .
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
