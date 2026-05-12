import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TransitionDialog } from "@/components/ideas/transition-dialog";
import { auth } from "@/server/auth-options";
import { getIdeaDetail, listIdeaTransitions } from "@/server/idea-service";
import { formatDateTime } from "@/lib/format/date";
import { canTransition } from "@/server/idea-state-machine";

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
  const transitions = await listIdeaTransitions(detail.id);

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
          <Badge>{detail.status.replace("_", " ")}</Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{detail.description}</CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            {transitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status changes yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {transitions.map((t) => (
                  <li key={t.id} className="border-l-2 border-muted pl-3">
                    <div>
                      <span className="font-medium">{t.from.replace("_", " ")}</span> →{" "}
                      <span className="font-medium">{t.to.replace("_", " ")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(new Date(t.recordedAt))}
                    </div>
                    {t.comment && <p className="mt-1 italic">“{t.comment}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTime(new Date(detail.createdAt))} • Updated{" "}
          {formatDateTime(new Date(detail.updatedAt))}
        </p>
      </main>
    </>
  );
}
