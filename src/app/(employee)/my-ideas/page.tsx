import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ideas/status-badge";
import { IdeaFilterBar } from "@/components/ideas/idea-filter-bar";
import { IdeaPagination } from "@/components/ideas/idea-pagination";
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
 * "My Ideas" — Employee landing page. Lists the caller's own
 * ideas, with the shared filter bar (US2) and pagination (US3).
 */
export default async function MyIdeasPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/my-ideas");

  const sp = toSearchParams(searchParams);
  sp.set("scope", "mine");
  const query = parseListingQuery(sp);
  const page = await runListingQuery(query, {
    id: session.user.id,
    role: session.user.role,
  });
  const cats = await listCategories("ACTIVE");

  return (
          <main className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">My Ideas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track the status of every idea you&apos;ve submitted.
            </p>
          </div>
          <Button asChild size="lg" className="shadow-sm">
            <Link href="/ideas/new">+ Submit new idea</Link>
          </Button>
        </div>

        <IdeaFilterBar categories={cats.map((c) => ({ id: c.id, name: c.name }))} />

        {page.total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-foreground"
              >
                💡
              </div>
              <p className="text-base font-medium">No ideas match your filters</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Adjust the search above or submit a brand-new idea.
              </p>
              <Button asChild className="mt-2">
                <Link href="/ideas/new">Submit a new idea</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
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
