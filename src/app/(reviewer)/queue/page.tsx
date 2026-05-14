import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
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
 * Reviewer queue: SUBMITTED + UNDER_REVIEW ideas, with the shared
 * filter bar (US2) and pagination (US3). Status whitelist is
 * enforced by the listing service for `scope=queue`.
 */
export default async function QueuePage({ searchParams }: PageProps): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/queue");
  if (session.user.role === "EMPLOYEE") redirect("/my-ideas");

  const sp = toSearchParams(searchParams);
  sp.set("scope", "queue");
  const query = parseListingQuery(sp);
  const page = await runListingQuery(query, {
    id: session.user.id,
    role: session.user.role,
  });
  const cats = await listCategories("ACTIVE");

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted and under-review ideas. Newest first.
          </p>
        </div>

        <IdeaFilterBar
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          showStatuses={true}
        />

        {page.total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-foreground"
              >
                ✓
              </div>
              <p className="text-base font-medium">All caught up</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                No ideas match the current filters.
              </p>
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
                    <TableHead>Submitted</TableHead>
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
                        {formatDate(new Date(i.createdAt))}
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
    </>
  );
}
