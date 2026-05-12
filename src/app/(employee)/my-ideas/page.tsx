import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ideas/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/server/auth-options";
import { listMineIdeas } from "@/server/idea-service";
import { formatDate } from "@/lib/format/date";

/**
 * "My Ideas" — Employee landing page listing the caller's own
 * submissions.
 */
export default async function MyIdeasPage(): Promise<JSX.Element> {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/my-ideas");

  const ideas = await listMineIdeas(session.user.id);
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
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

        {ideas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-foreground"
              >
                💡
              </div>
              <p className="text-base font-medium">No ideas yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Got an idea worth sharing? Submit your first one and start the conversation.
              </p>
              <Button asChild className="mt-2">
                <Link href="/ideas/new">Submit your first idea</Link>
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
      </main>
    </>
  );
}
