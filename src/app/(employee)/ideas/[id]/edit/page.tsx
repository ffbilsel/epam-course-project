import { notFound, redirect } from "next/navigation";
import { IdeaForm } from "@/components/forms/idea-form";
import { auth } from "@/server/auth-options";
import { listCategories, parseSchemaJson } from "@/db/repositories/category-repo";
import { getIdeaDetail } from "@/server/idea-service";
import { canAuthorEdit } from "@/server/idea-state-machine";

interface PageProps {
  params: { id: string };
}

/**
 * US1: Edit-idea page. Only the author may open it and only while
 * the idea is still `SUBMITTED`. Anything else redirects to the
 * detail page.
 */
export default async function EditIdeaPage({ params }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/ideas/${params.id}/edit`);

  let detail;
  try {
    detail = await getIdeaDetail(params.id);
  } catch {
    notFound();
  }

  const editable = canAuthorEdit({
    idea: { status: detail.status, authorId: detail.authorId },
    actor: { id: session.user.id },
  });
  if (!editable) {
    redirect(`/ideas/${detail.id}`);
  }

  const cats = await listCategories("ACTIVE");
  const options = cats.map((c) => ({
    id: c.id,
    name: c.name,
    fieldSchema: parseSchemaJson(c.fieldSchema),
  }));

  const answersRecord = Object.fromEntries(detail.answers.map((a) => [a.key, a.value]));

  return (
          <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-1 text-2xl font-semibold">Edit idea</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          You can edit your idea while it is still Submitted. Once a reviewer starts the evaluation,
          edits are locked.
        </p>
        <IdeaForm
          categories={options}
          mode="edit"
          ideaId={detail.id}
          defaultValues={{
            title: detail.title,
            description: detail.description,
            categoryChoice: detail.categoryId,
            answers: answersRecord,
          }}
        />
      </main>
  );
}
