import { listCategories } from "@/db/repositories/category-repo";
import { CategoriesTable } from "@/components/admin/categories-table";

/**
 * Admin → Categories page (PROPOSED queue).
 */
export default async function AdminCategoriesPage(): Promise<JSX.Element> {
  const proposed = await listCategories("PROPOSED");
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Proposed categories</h1>
      <CategoriesTable categories={proposed.map((c) => ({ id: c.id, name: c.name }))} />
    </main>
  );
}
