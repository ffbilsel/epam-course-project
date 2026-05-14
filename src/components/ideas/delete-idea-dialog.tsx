"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorCode } from "@/lib/errors/codes";

const CONFIRM_PHRASE = "delete";

/**
 * US1: Hard-delete confirmation dialog. Requires the user to type
 * the literal word "delete" before the destructive action is
 * enabled. On success, redirects to My Ideas.
 */
export function DeleteIdeaDialog({
  ideaId,
  ideaTitle,
}: {
  ideaId: string;
  ideaTitle: string;
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirmDelete(): Promise<void> {
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
        throw new Error(body.error?.message ?? "Delete failed");
      }
      toast.success("Idea deleted");
      setOpen(false);
      router.push("/my-ideas");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setPhrase("");
          setErr(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">Delete idea</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this idea?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm">
            You&apos;re about to permanently delete{" "}
            <span className="font-medium">&ldquo;{ideaTitle}&rdquo;</span>. This cannot be undone.
          </p>
          <Label htmlFor="confirm-phrase">
            Type <span className="font-mono">{CONFIRM_PHRASE}</span> to confirm
          </Label>
          <Input
            id="confirm-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            autoComplete="off"
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={submitting || phrase.trim().toLowerCase() !== CONFIRM_PHRASE}
          >
            {submitting ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
