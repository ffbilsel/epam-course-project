"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  buildAnswersZodSchema,
  type CategoryFieldDefinition,
} from "@/lib/validation/category-fields";
import { DynamicFieldRenderer } from "@/components/forms/dynamic-field-renderer";

const CoreSchema = z.object({
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
  answers: z.record(z.unknown()).default({}),
});
type FormValues = z.infer<typeof CoreSchema>;

/** A category surface for the form, with its Phase 2 schema. */
export interface CategoryWithSchema {
  id: string;
  name: string;
  fieldSchema: CategoryFieldDefinition[];
}

/**
 * Client form for submitting a new idea. Stages an attachment first
 * (if any), then POSTs the idea with the returned attachment id and
 * any structured answers driven by the selected category schema
 * (Phase 2 / FR-001..FR-004).
 */
export function IdeaForm({ categories }: { categories: CategoryWithSchema[] }): JSX.Element {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
    setValue,
    getValues,
  } = useForm<FormValues>({
    resolver: zodResolver(
      CoreSchema.superRefine((values, ctx) => {
        const cat = categoriesById.get(values.categoryChoice);
        if (!cat) return;
        const result = buildAnswersZodSchema(cat.fieldSchema).safeParse(values.answers ?? {});
        if (!result.success) {
          for (const issue of result.error.issues) {
            ctx.addIssue({
              ...issue,
              path: ["answers", ...issue.path],
            });
          }
        }
      }),
    ),
    defaultValues: {
      title: "",
      description: "",
      categoryChoice: "",
      answers: {},
    },
  });

  const draft = useFormDraft<FormValues>("draft:idea-form", watch(), (next) => reset(next));
  const choice = watch("categoryChoice");
  const currentCategory = categoriesById.get(choice);
  const currentFields = currentCategory?.fieldSchema ?? [];

  // FR-004: when the category changes, keep `answers[key]` values
  // for any field key that still exists in the new schema; drop
  // values whose key is no longer present.
  useEffect(() => {
    const prevAnswers = (getValues("answers") ?? {}) as Record<string, unknown>;
    if (Object.keys(prevAnswers).length === 0) return;
    const keep = new Set(currentFields.map((f) => f.key));
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(prevAnswers)) {
      if (keep.has(k)) next[k] = v;
    }
    setValue("answers", next, { shouldDirty: false, shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

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

      const body = {
        title: values.title,
        description: values.description,
        categoryId: values.categoryChoice,
        attachmentId,
        answers: values.answers ?? {},
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

  const answerErrors = (errors.answers ?? {}) as Record<
    string,
    { message?: string; type?: string } | undefined
  >;

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
        </select>
        {errors.categoryChoice && (
          <p className="text-sm text-destructive">{errors.categoryChoice.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Don&apos;t see a fit?{" "}
          <a href="/categories/propose" className="underline">
            Propose a new category
          </a>{" "}
          (separate from this submission).
        </p>
      </div>
      {currentFields.length > 0 && (
        <section
          aria-labelledby="category-fields-heading"
          className="space-y-4 rounded-md border border-input p-4"
        >
          <h2 id="category-fields-heading" className="text-sm font-medium">
            {currentCategory?.name} details
          </h2>
          {currentFields.map((field) => (
            <DynamicFieldRenderer
              key={field.key}
              field={field}
              register={register as never}
              watch={watch as never}
              error={answerErrors[field.key] as never}
            />
          ))}
        </section>
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
