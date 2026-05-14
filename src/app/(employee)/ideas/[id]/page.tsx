import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ideas/status-badge";
import { TransitionDialog } from "@/components/ideas/transition-dialog";
import { CategoryDetailsPanel } from "@/components/ideas/category-details-panel";
import { EditIdeaButton } from "@/components/ideas/edit-idea-button";
import { DeleteIdeaDialog } from "@/components/ideas/delete-idea-dialog";
import { IdeaHistoryTab } from "@/components/ideas/idea-history-tab";
import { auth } from "@/server/auth-options";
import { getIdeaDetail } from "@/server/idea-service";
import { getIdeaHistory } from "@/server/idea-history";
import { formatDateTime } from "@/lib/format/date";
import { canTransition, canAuthorEdit } from "@/server/idea-state-machine";

interface PageProps {
  params: { id: string };
}

/**
 * Idea detail page: visible to the author and to reviewers/admins.
 * Renders status, attachment download, and the audit-log timeline;
 * reviewers see transition controls when allowed.
 */
export default async function IdeaDetailPage({ params }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/ideas/${params.id}`);

  let detail;
  try {
    detail = await getIdeaDetail(params.id);
  } catch {
    notFound();
  }
  const isAuthor = detail.authorId === session.user.id;
  const isReviewer = session.user.role === "EVALUATOR" || session.user.role === "ADMIN";
  if (!isAuthor && !isReviewer) {
    redirect("/my-ideas");
  }
  const transitions = await getIdeaHistory(detail.id, {
    id: session.user.id,
    role: session.user.role,
  });

  const stateMachineInput = {
    idea: { status: detail.status, authorId: detail.authorId, categoryState: detail.categoryState },
    actor: { id: session.user.id, role: session.user.role },
    comment: null,
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{detail.title}</h1>
            <p className="text-sm text-muted-foreground">
              {detail.categoryName}
              {detail.categoryState === "PROPOSED" && (
                <Badge variant="secondary" className="ml-2">
                  Category pending
                </Badge>
              )}
            </p>
          </div>
          <StatusBadge status={detail.status} />
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">{detail.description}</CardContent>
            </Card>

            <CategoryDetailsPanel answers={detail.answers} categoryName={detail.categoryName} />

            {detail.attachment && (
              <Card>
                <CardHeader>
                  <CardTitle>Attachment</CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    className="text-sm underline"
                    href={`/api/ideas/${detail.id}/attachment`}
                    prefetch={false}
                  >
                    {detail.attachment.originalName} ({Math.round(detail.attachment.sizeBytes / 1024)}{" "}
                    KB)
                  </Link>
                </CardContent>
              </Card>
            )}

            {isReviewer && !isAuthor && (
              <Card>
                <CardHeader>
                  <CardTitle>Reviewer actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {canTransition({ ...stateMachineInput, action: "START_REVIEW" }) && (
                    <TransitionDialog ideaId={detail.id} action="START_REVIEW" label="Start review" />
                  )}
                  {canTransition({ ...stateMachineInput, action: "APPROVE" }) && (
                    <TransitionDialog
                      ideaId={detail.id}
                      action="APPROVE"
                      label="Approve"
                      requireComment
                    />
                  )}
                  {canTransition({ ...stateMachineInput, action: "REJECT" }) && (
                    <TransitionDialog
                      ideaId={detail.id}
                      action="REJECT"
                      label="Reject"
                      requireComment
                    />
                  )}
                  {canTransition({ ...stateMachineInput, action: "IMPLEMENT" }) && (
                    <TransitionDialog ideaId={detail.id} action="IMPLEMENT" label="Mark implemented" />
                  )}
                  {detail.categoryState === "PROPOSED" && (
                    <p className="text-sm text-muted-foreground">
                      This idea&apos;s category is awaiting Admin approval.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {isAuthor &&
              canAuthorEdit({
                idea: { status: detail.status, authorId: detail.authorId },
                actor: { id: session.user.id },
              }) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Manage your idea</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <EditIdeaButton ideaId={detail.id} />
                    <DeleteIdeaDialog ideaId={detail.id} ideaTitle={detail.title} />
                  </CardContent>
                </Card>
              )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="py-4">
                <IdeaHistoryTab events={transitions} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTime(new Date(detail.createdAt))} • Updated{" "}
          {formatDateTime(new Date(detail.updatedAt))}
        </p>
      </main>
    </>
  );
}
