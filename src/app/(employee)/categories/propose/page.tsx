import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ProposeCategoryForm } from "@/components/forms/propose-category-form";
import { auth } from "@/server/auth-options";

/**
 * Propose-a-category page — available to any authenticated user.
 * Decoupled from idea submission so employees can propose new
 * categories independently (and so the idea form stays focused).
 */
export default async function ProposeCategoryPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/categories/propose");
  return (
    <>
      <Header />
      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="mb-2 text-2xl font-semibold">Propose a category</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Don&apos;t see a fit in the existing list? Propose a new category and an Admin will review
          it.
        </p>
        <ProposeCategoryForm />
      </main>
    </>
  );
}
