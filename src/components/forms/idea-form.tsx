"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessages } from "@/lib/errors/error-messages";
import type { ErrorCode } from "@/lib/errors/codes";
import { useFormDraft } from "@/lib/hooks/use-form-draft";

const FormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, errorMessages.IDEA_TITLE_REQUIRED)
      .max(120, errorMessages.IDEA_TITLE_TOO_LONG),
    description: z
      .string()
      .trim()
      .min(1, errorMessages.IDEA_DESCRIPTION_REQUIRED)
      .max(2000, errorMessages.IDEA_DESCRIPTION_TOO_LONG),
    categoryChoice: z.string().min(1, errorMessages.IDEA_CATEGORY_INVALID),
    proposedCategoryName: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .refine(
    (v) => v.categoryChoice !== "__propose__" || (v.proposedCategoryName ?? "").trim().length > 0,
    { message: errorMessages.IDEA_CATEGORY_INVALID, path: ["proposedCategoryName"] },
  );
type FormValues = z.infer<typeof FormSchema>;

/**
 * Client form for submitting a new idea. Stages an attachment first
 * (if any), then POSTs the idea with the returned attachment id.
 */
export function IdeaForm({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}): JSX.Element {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    getValues,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { title: "", description: "", categoryChoice: "", proposedCategoryName: "" },
  });

  const draft = useFormDraft<FormValues>("draft:idea-form", watch(), (next) => reset(next));

  const choice = watch("categoryChoice");

  async function onSubmit(values: FormValues): Promise<void> {
    setSubmitting(true);
    try {
      let attachmentId: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const upRes = await fetch("/api/attachments", { method: "POST", body: fd });
        if (!upRes.ok) {
          const err = (await upRes.json()) as { error?: { code?: ErrorCode; message?: string } };
          throw new Error(err.error?.message ?? "Upload failed");
        }
        const upJson = (await upRes.json()) as { id: string };
        attachmentId = upJson.id;
      }

      const body =
        values.categoryChoice === "__propose__"
          ? {
              title: values.title,
              description: values.description,
              proposedCategoryName: values.proposedCategoryName,
              attachmentId,
            }
          : {
              title: values.title,
              description: values.description,
              categoryId: values.categoryChoice,
              attachmentId,
            };

      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
        throw new Error(err.error?.message ?? "Submit failed");
      }
      const created = (await res.json()) as { id: string };
      draft.clear();
      toast.success("Idea submitted");
      router.push(`/ideas/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
      aria-describedby="form-help"
    >
      <p id="form-help" className="sr-only">
        All fields except attachment are required.
      </p>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" autoComplete="off" {...register("title")} aria-invalid={!!errors.title} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={6}
          {...register("description")}
          aria-invalid={!!errors.description}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="categoryChoice">Category</Label>
        <select
          id="categoryChoice"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("categoryChoice")}
          aria-invalid={!!errors.categoryChoice}
        >
          <option value="">Select a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="__propose__">Propose new category…</option>
        </select>
        {errors.categoryChoice && (
          <p className="text-sm text-destructive">{errors.categoryChoice.message}</p>
        )}
      </div>
      {choice === "__propose__" && (
        <div className="space-y-2">
          <Label htmlFor="proposedCategoryName">Proposed category name</Label>
          <Input
            id="proposedCategoryName"
            {...register("proposedCategoryName")}
            aria-invalid={!!errors.proposedCategoryName}
          />
          {errors.proposedCategoryName && (
            <p className="text-sm text-destructive">{errors.proposedCategoryName.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Your idea will sit pending an Admin review of this category.
          </p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="file">Attachment (optional, ≤ 25 MB)</Label>
        <input
          id="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm"
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit idea"}
      </Button>
    </form>
  );
}
