"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ErrorCode } from "@/lib/errors/codes";

interface Category {
  id: string;
  name: string;
}

/**
 * Admin table for PROPOSED categories — approve or reject (rejection
 * re-links every linked idea to the protected `Other` category).
 */
export function CategoriesTable({ categories }: { categories: Category[] }): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function decide(c: Category, decision: "APPROVE" | "REJECT"): void {
    if (decision === "REJECT") {
      const ok = window.confirm(
        `Reject "${c.name}"? Any ideas in this category will be re-linked to "Other".`,
      );
      if (!ok) return;
    }
    setBusyId(c.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/categories/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
          throw new Error(body.error?.message ?? "Decision failed");
        }
        toast.success(`${c.name}: ${decision}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Decision failed");
      } finally {
        setBusyId(null);
      }
    });
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No categories awaiting review.
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
              <TableHead>Name</TableHead>
              <TableHead className="w-[260px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell className="space-x-2">
                  <Button
                    size="sm"
                    disabled={pending && busyId === c.id}
                    onClick={() => decide(c, "APPROVE")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending && busyId === c.id}
                    onClick={() => decide(c, "REJECT")}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
