import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { IdeaForm } from "@/components/forms/idea-form";
import { auth } from "@/server/auth-options";
import { listCategories, parseSchemaJson } from "@/db/repositories/category-repo";

/**
 * Submit-idea page — fetches active categories server-side and hands
 * them (with their structured-field schemas) to the client form.
 */
export default async function NewIdeaPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/ideas/new");
  const cats = await listCategories("ACTIVE");
  const options = cats.map((c) => ({
    id: c.id,
    name: c.name,
    fieldSchema: parseSchemaJson(c.fieldSchema),
  }));
  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Submit a new idea</h1>
          <a
            href="/drafts"
            className="text-sm text-primary underline underline-offset-4 hover:no-underline"
          >
            Save and continue later → drafts
          </a>
        </div>
        <IdeaForm categories={options} />
      </main>
    </>
  );
}
