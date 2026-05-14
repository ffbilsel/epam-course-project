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
import { errorMessages } from "@/lib/errors/error-messages";
import type { ErrorCode } from "@/lib/errors/codes";

const Schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, errorMessages.IDEA_CATEGORY_INVALID)
    .max(40, errorMessages.IDEA_CATEGORY_INVALID),
});
type FormValues = z.infer<typeof Schema>;

/**
 * Standalone form for proposing a new category. Posts to
 * `POST /api/categories`; on success the user is sent back to their
 * home (My Ideas / Queue) where the proposal sits until an Admin
 * approves or rejects it.
 */
export function ProposeCategoryForm(): JSX.Element {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    setSubmitting(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name.trim() }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { code?: ErrorCode; message?: string } };
        throw new Error(err.error?.message ?? "Submit failed");
      }
      toast.success("Category proposed — awaiting Admin review");
      reset();
      router.push("/my-ideas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Category name</Label>
        <Input
          id="name"
          autoComplete="off"
          {...register("name")}
          aria-invalid={!!errors.name}
          maxLength={40}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        <p className="text-xs text-muted-foreground">
          1–40 characters. An Admin will approve or reject your proposal.
        </p>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Propose category"}
      </Button>
    </form>
  );
}
