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
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold">Review queue</h1>
        {ideas.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No ideas awaiting review.
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
                    <TableRow key={i.id}>
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
                      <TableCell>{formatDate(new Date(i.createdAt))}</TableCell>
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
