import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My Ideas</h1>
          <Button asChild>
            <Link href="/ideas/new">Submit new idea</Link>
          </Button>
        </div>

        {ideas.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              You haven&apos;t submitted any ideas yet.{" "}
              <Link href="/ideas/new" className="underline">
                Submit your first idea.
              </Link>
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
                      <TableCell>
                        <Badge>{i.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(new Date(i.updatedAt))}</TableCell>
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
