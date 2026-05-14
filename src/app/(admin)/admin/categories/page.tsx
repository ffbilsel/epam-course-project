import Link from "next/link";
import { listCategories } from "@/db/repositories/category-repo";
import { CategoriesTable } from "@/components/admin/categories-table";

/**
 * Admin → Categories page. Renders the PROPOSED queue (decision
 * actions) and the ACTIVE list (with a link to each category's
 * structured-field schema editor — Phase 2 / Story 3).
 */
export default async function AdminCategoriesPage(): Promise<JSX.Element> {
  const [proposed, active] = await Promise.all([
    listCategories("PROPOSED"),
    listCategories("ACTIVE"),
  ]);
  return (
    <main className="w-full space-y-8 px-4 py-6 sm:px-6 lg:px-10">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Proposed categories</h1>
        <CategoriesTable categories={proposed.map((c) => ({ id: c.id, name: c.name }))} />
      </section>
      <section>
        <h2 className="mb-4 text-xl font-semibold">Active categories</h2>
        <ul className="divide-y rounded-md border border-input">
          {active.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm">{c.name}</span>
              <Link href={`/admin/categories/${c.id}/schema`} className="text-sm underline">
                Edit schema
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
