import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/server/auth-options";
import { listQueueIdeas } from "@/server/idea-service";
import { formatDate } from "@/lib/format/date";

/**
 * Reviewer queue: SUBMITTED ideas, oldest first.
 */
export default async function QueuePage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/queue");
  if (session.user.role === "EMPLOYEE") redirect("/my-ideas");

  const ideas = await listQueueIdeas();
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Review queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted ideas awaiting evaluation, oldest first.
          </p>
        </div>
        {ideas.length === 0 ? (
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
                No ideas are awaiting review right now. Check back soon.
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
                    <TableHead>Category</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ideas.map((i) => (
                    <TableRow key={i.id} className="transition-colors hover:bg-accent/40">
                      <TableCell>
                        <Link href={`/ideas/${i.id}`} className="font-medium hover:underline">
                          {i.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {i.categoryName}
                        {i.categoryState === "PROPOSED" && (
                          <Badge variant="secondary" className="ml-2">
                            Pending
                          </Badge>
                        )}
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
      </main>
    </>
  );
}
