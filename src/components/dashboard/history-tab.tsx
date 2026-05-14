import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ideas/status-badge";
import { formatDate } from "@/lib/format/date";
import type { EmployeeHistoryRow } from "@/server/idea-listing";

/**
 * Renders the "History" tab of the Employee dashboard (FR-037):
 * concluded ideas authored by the viewer (APPROVED / REJECTED /
 * IMPLEMENTED) with title, category, concluded date, and final
 * decision. Each row links to the idea detail page.
 * @example
 *   <HistoryTab rows={rows} />
 */
export function HistoryTab({ rows }: { rows: ReadonlyArray<EmployeeHistoryRow> }): JSX.Element {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-foreground"
          >
            ✓
          </div>
          <p className="text-base font-medium">No concluded ideas yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Ideas you submit will appear here once a reviewer approves, rejects, or marks them
            implemented.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Concluded</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="transition-colors hover:bg-accent/40">
                <TableCell>
                  <Link href={`/ideas/${r.id}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                </TableCell>
                <TableCell>{r.categoryName}</TableCell>
                <TableCell>
                  <StatusBadge status={r.decision} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(new Date(r.concludedAt))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
