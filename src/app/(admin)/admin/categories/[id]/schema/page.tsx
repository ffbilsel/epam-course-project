import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/server/auth-options";
import { findCategoryById, parseSchemaJson } from "@/db/repositories/category-repo";
import { CategorySchemaEditor } from "@/components/admin/category-schema-editor";

interface PageProps {
  params: { id: string };
}

/**
 * Admin → Categories → [id] → Schema. Renders the editor for the
 * structured-field schema attached to an `ACTIVE` category. Any
 * other state redirects back to the categories list.
 */
export default async function CategorySchemaPage({ params }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/categories/${params.id}/schema`);
  }
  if (session.user.role !== "ADMIN") {
    redirect("/my-ideas");
  }
  const cat = await findCategoryById(params.id);
  if (!cat) notFound();
  if (cat.state !== "ACTIVE") {
    redirect("/admin/categories");
  }
  const fields = parseSchemaJson(cat.fieldSchema);
  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-4 px-4 py-6 sm:px-6 lg:px-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{cat.name} — schema</h1>
          <p className="text-sm text-muted-foreground">
            Edit the additional fields shown when an employee picks this category.
          </p>
        </div>
        <Link href="/admin/categories" className="text-sm underline">
          ← Back to categories
        </Link>
      </div>
      <CategorySchemaEditor categoryId={cat.id} categoryName={cat.name} initialFields={fields} />
    </main>
  );
}
