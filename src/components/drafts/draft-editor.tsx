"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDraftAutosave } from "@/lib/hooks/use-draft-autosave";
import { toast } from "sonner";

interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  draftId: string;
  initial: {
    title: string;
    description: string;
    categoryId: string | null;
  };
  categories: CategoryOption[];
}

/**
 * Author-only draft editor. Wraps the basic idea form fields with
 * the {@link useDraftAutosave} hook so changes are debounced and
 * persisted automatically. Surfaces an explicit `Submit` action
 * that promotes the draft to a real Idea.
 */
export function DraftEditor({ draftId, initial, categories }: Props): JSX.Element {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [submitting, setSubmitting] = useState(false);

  const autosave = useDraftAutosave({
    draftId,
    values: { title, description, categoryId },
  });

  async function onSubmit(): Promise<void> {
    setSubmitting(true);
    try {
      // First flush the latest content so the server has it.
      await fetch(`/api/drafts/${draftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, categoryId }),
      });
      const res = await fetch(`/api/drafts/${draftId}/submit`, { method: "POST" });
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
      setSubmitting(false);
    }
  }

  const savedAgo =
    autosave.lastSavedAt !== null
      ? `Saved · ${formatAgo(Date.now() - autosave.lastSavedAt)}`
      : autosave.status === "saving"
        ? "Saving…"
        : "Not saved yet";

  return (
    <div className="space-y-5">
      <div className="text-xs text-muted-foreground" aria-live="polite">
        {autosave.status === "error" ? "Could not autosave — retrying…" : savedAgo}
      </div>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={2000}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || null)}
        >
          <option value="">Choose a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/drafts")}>
          Back to drafts
        </Button>
      </div>
    </div>
  );
}

function formatAgo(ms: number): string {
  if (ms < 5_000) return "just now";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return `${m}m ago`;
}
