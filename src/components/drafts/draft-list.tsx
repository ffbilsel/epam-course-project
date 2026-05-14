"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { DraftSummary } from "@/server/draft-service";

/** Renders the caller's drafts with edit, submit, and delete actions. */
export function DraftList({ drafts }: { drafts: DraftSummary[] }): JSX.Element {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (drafts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You have no saved drafts yet. Start one from{" "}
          <Link href="/ideas/new" className="text-primary underline">
            Submit a new idea
          </Link>{" "}
          and click <em>Save as draft</em>.
        </CardContent>
      </Card>
    );
  }

  async function onDelete(id: string): Promise<void> {
    if (!confirm("Delete this draft? This cannot be undone.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success("Draft deleted");
      router.refresh();
    } catch {
      toast.error("Could not delete draft");
    } finally {
      setBusyId(null);
    }
  }

  async function onSubmit(id: string): Promise<void> {
    setBusyId(id);
    try {
      const res = await fetch(`/api/drafts/${id}/submit`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        ideaId?: string;
        error?: { message?: string };
      };
      if (!res.ok || !json.ideaId) {
        throw new Error(json.error?.message ?? "submit failed");
      }
      toast.success("Idea submitted");
      router.push(`/ideas/${json.ideaId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="space-y-3">
      {drafts.map((d) => (
        <li key={d.id}>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="truncate text-base font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  Last edited {new Date(d.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/drafts/${d.id}`}>Edit</Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onSubmit(d.id)}
                  disabled={busyId === d.id}
                >
                  Submit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(d.id)}
                  disabled={busyId === d.id}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
