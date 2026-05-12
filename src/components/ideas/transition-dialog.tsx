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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessages } from "@/lib/errors/error-messages";
import type { ErrorCode } from "@/lib/errors/codes";
import type { TransitionAction } from "@/server/idea-state-machine";

interface Props {
  ideaId: string;
  action: TransitionAction;
  label: string;
  requireComment?: boolean;
}

/**
 * Reviewer action button + comment dialog. Posts to
 * `POST /api/ideas/:id/transitions` with the chosen action.
 */
export function TransitionDialog({ ideaId, action, label, requireComment }: Props): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (requireComment && comment.trim().length === 0) {
      setErr(errorMessages.IDEA_COMMENT_REQUIRED);
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/transitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
        throw new Error(body.error?.message ?? "Action failed");
      }
      toast.success(`${label} succeeded`);
      setOpen(false);
      setComment("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={action === "REJECT" ? "destructive" : "default"}>{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="comment">Comment{requireComment ? " (required)" : " (optional)"}</Label>
          <Textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Working…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
