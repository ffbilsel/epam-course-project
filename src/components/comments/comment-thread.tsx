"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { escapeAndLinebreak } from "@/lib/format/plain-text";
import type { CommentNode } from "@/server/comment-service";
import type { Role } from "@/db/schema";

interface Props {
  ideaId: string;
  viewer: { id: string; role: Role };
  comments: CommentNode[];
}

/** One-level comment thread with author/moderator delete + reply composer. */
export function CommentThread({ ideaId, viewer, comments }: Props): JSX.Element {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">Discussion</h3>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id}>
              <CommentItem ideaId={ideaId} viewer={viewer} c={c} />
              {c.replies.length > 0 ? (
                <ul className="ml-6 mt-2 space-y-2 border-l border-border/60 pl-3">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem ideaId={ideaId} viewer={viewer} c={r} canReply={false} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <CommentComposer ideaId={ideaId} parentId={null} />
    </section>
  );
}

function CommentItem({
  ideaId,
  viewer,
  c,
  canReply = true,
}: {
  ideaId: string;
  viewer: { id: string; role: Role };
  c: CommentNode;
  canReply?: boolean;
}): JSX.Element {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const isMine = c.authorId === viewer.id;
  const isModerator = viewer.role === "EVALUATOR" || viewer.role === "ADMIN";
  const isDeleted = c.deletedAt !== null;

  async function onDelete(): Promise<void> {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/ideas/${ideaId}/comments/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Comment deleted");
      router.refresh();
    } else {
      toast.error("Could not delete");
    }
  }

  return (
    <article className="rounded-md border border-border bg-card/50 p-3 text-sm">
      <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {c.authorName}{" "}
          <span className="text-muted-foreground">({c.authorRoleAtPost.toLowerCase()})</span>
          {c.kind === "DECISION" ? (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Decision
            </span>
          ) : null}
        </span>
        <time dateTime={new Date(c.createdAt).toISOString()}>
          {new Date(c.createdAt).toLocaleString()}
          {c.editedAt ? " · edited" : ""}
        </time>
      </header>
      {isDeleted ? (
        <p className="italic text-muted-foreground">[removed by moderator]</p>
      ) : (
        <p
          className="whitespace-pre-wrap break-words"
          // Safe: body is escaped + LF-to-<br /> via escapeAndLinebreak.
          dangerouslySetInnerHTML={{ __html: escapeAndLinebreak(c.body) }}
        />
      )}
      {!isDeleted ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {canReply ? (
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => setReplying((v) => !v)}
            >
              {replying ? "Cancel" : "Reply"}
            </button>
          ) : null}
          {isMine || isModerator ? (
            <button
              type="button"
              className="text-destructive underline-offset-2 hover:underline"
              onClick={onDelete}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
      {replying ? (
        <CommentComposer ideaId={ideaId} parentId={c.id} onPosted={() => setReplying(false)} />
      ) : null}
    </article>
  );
}

function CommentComposer({
  ideaId,
  parentId,
  onPosted,
}: {
  ideaId: string;
  parentId: string | null;
  onPosted?: () => void;
}): JSX.Element {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  function post(): void {
    if (!body.trim()) return;
    start(async () => {
      const res = await fetch(`/api/ideas/${ideaId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), parentId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        toast.error(j.error?.message ?? "Could not post comment");
        return;
      }
      setBody("");
      onPosted?.();
      router.refresh();
    });
  }
  return (
    <div className="mt-2 space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Add a comment…"}
        rows={3}
        maxLength={2000}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{body.length}/2000</span>
        <Button type="button" size="sm" onClick={post} disabled={pending || !body.trim()}>
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
    </div>
  );
}
