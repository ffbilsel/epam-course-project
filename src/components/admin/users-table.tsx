"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { ErrorCode } from "@/lib/errors/codes";

interface User {
  id: string;
  email: string;
  displayName: string;
  role: "EMPLOYEE" | "EVALUATOR" | "ADMIN";
}

/**
 * Admin user table with inline role <select>; on change posts to
 * `PATCH /api/users/:id/role` and toasts the result.
 */
export function UsersTable({ users }: { users: User[] }): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function changeRole(u: User, newRole: User["role"]): void {
    setBusyId(u.id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${u.id}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
          throw new Error(body.error?.message ?? "Role change failed");
        }
        toast.success(`${u.email} → ${newRole}`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Role change failed");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.displayName}</TableCell>
                <TableCell>
                  <select
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    disabled={pending && busyId === u.id}
                    onChange={(e) => changeRole(u, e.target.value as User["role"])}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="EVALUATOR">EVALUATOR</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
