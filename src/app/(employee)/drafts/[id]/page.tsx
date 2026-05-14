import { notFound, redirect } from "next/navigation";
import { DraftEditor } from "@/components/drafts/draft-editor";
import { auth } from "@/server/auth-options";
import { loadDraft } from "@/server/draft-service";
import { listCategories } from "@/db/repositories/category-repo";
import { AppError } from "@/lib/errors/AppError";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Single-draft editor page (RSC). Verifies ownership via
 * `loadDraft`, fetches active categories, and renders the editor.
 */
export default async function DraftEditPage({ params }: Props): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/drafts");
  const { id } = await params;
  let draft;
  try {
    draft = await loadDraft(id, { id: session.user.id });
  } catch (err) {
    if (err instanceof AppError && (err.code === "DRAFT_NOT_FOUND" || err.code === "DRAFT_FORBIDDEN")) {
      notFound();
    }
    throw err;
  }
  const cats = await listCategories("ACTIVE");
  return (
          <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit draft</h1>
        <DraftEditor
          draftId={draft.id}
          initial={{
            title: draft.title,
            description: draft.description,
            categoryId: draft.categoryId,
          }}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        />
      </main>
  );
}
