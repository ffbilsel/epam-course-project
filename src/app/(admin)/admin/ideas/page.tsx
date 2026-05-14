import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ideas/status-badge";
import { IdeaFilterBar } from "@/components/ideas/idea-filter-bar";
import { IdeaPagination } from "@/components/ideas/idea-pagination";
import { ExportIdeasButton } from "@/components/admin/export-ideas-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/server/auth-options";
import { runListingQuery } from "@/server/idea-listing";
import { listCategories } from "@/db/repositories/category-repo";
import { parseListingQuery } from "@/lib/validation/idea";
import { formatDate } from "@/lib/format/date";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function toSearchParams(searchParams: PageProps["searchParams"]): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (Array.isArray(v)) for (const x of v) sp.append(k, x);
    else if (v !== undefined) sp.set(k, v);
  }
  return sp;
}

/**
 * Admin all-ideas listing — unrestricted scope, all filters, plus
 * the CSV export button (US5, wired in a follow-up commit).
 */
export default async function AdminIdeasPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/ideas");
  if (session.user.role !== "ADMIN") redirect("/my-ideas");

  const sp = toSearchParams(searchParams);
  sp.set("scope", "all");
  const query = parseListingQuery(sp);
  const page = await runListingQuery(query, {
    id: session.user.id,
    role: session.user.role,
  });
  const cats = await listCategories("ACTIVE");

  return (
          <main className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">All ideas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cross-tenant view for administrators.
          </p>
        </div>

        <IdeaFilterBar categories={cats.map((c) => ({ id: c.id, name: c.name }))} />

        <div className="mb-4 flex justify-end">
          <ExportIdeasButton />
        </div>

        {page.total === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              No ideas match the current filters.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.rows.map((i) => (
                    <TableRow key={i.id} className="transition-colors hover:bg-accent/40">
                      <TableCell>
                        <Link href={`/ideas/${i.id}`} className="font-medium hover:underline">
                          {i.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i.authorName}</TableCell>
                      <TableCell>{i.categoryName}</TableCell>
                      <TableCell>
                        <StatusBadge status={i.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(new Date(i.updatedAt))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <IdeaPagination
          page={page.page}
          pageSize={page.pageSize}
          totalPages={page.totalPages}
          total={page.total}
        />
      </main>
  );
}
