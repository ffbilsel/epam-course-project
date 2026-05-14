import { redirect } from "next/navigation";
import { DraftList } from "@/components/drafts/draft-list";
import { auth } from "@/server/auth-options";
import { listMyDrafts } from "@/server/draft-service";

/**
 * Employee "My Drafts" page (RSC). Lists drafts authored by the
 * current user. Drafts are strictly private — no other role can
 * reach this page or read any draft.
 */
export default async function MyDraftsPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/drafts");
  const drafts = await listMyDrafts(session.user.id);
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-10">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">My Drafts</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Saved ideas that you haven&apos;t submitted yet. Only you can see them.
      </p>
      <DraftList drafts={drafts} />
    </main>
  );
}
