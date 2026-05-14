"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * "Save as draft" action button. POSTs the current form values to
 * `/api/drafts` and (on success) redirects the author to their
 * drafts list.
 */
export function SaveDraftButton({
  values,
  className,
}: {
  values: { title?: string; description?: string; categoryId?: string | null };
  className?: string;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function onClick(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success("Draft saved");
      router.push("/drafts");
      router.refresh();
    } catch {
      toast.error("Could not save draft");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button type="button" variant="outline" onClick={onClick} disabled={busy} className={className}>
      {busy ? "Saving…" : "Save as draft"}
    </Button>
  );
}
