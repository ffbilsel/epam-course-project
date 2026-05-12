"use client";

import { type ReactNode } from "react";
import type { FieldError, UseFormRegister, UseFormWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryFieldDefinition } from "@/lib/validation/category-fields";

/**
 * Renders the single-field shadcn primitive that matches `field.type`,
 * with label, optional help text, and an error message wired via
 * `aria-describedby` for screen readers (Constitution VI.2).
 */
export function DynamicFieldRenderer({
  field,
  register,
  watch,
  error,
}: {
  field: CategoryFieldDefinition;
  register: UseFormRegister<{ answers: Record<string, unknown> }>;
  watch: UseFormWatch<{ answers: Record<string, unknown> }>;
  error?: FieldError | undefined;
}): JSX.Element {
  const name = `answers.${field.key}` as const;
  const inputId = `field-${field.key}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;

  const ariaDescribedBy = [field.helpText ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const sharedAria = {
    "aria-invalid": Boolean(error),
    "aria-describedby": ariaDescribedBy || undefined,
  } as const;

  return (
    <div className="space-y-2">
      <FieldLabel field={field} htmlFor={field.type === "SINGLE_CHOICE" ? undefined : inputId} />
      {field.helpText && (
        <p id={helpId} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      )}
      {field.type === "SHORT_TEXT" && (
        <Input
          id={inputId}
          type="text"
          autoComplete="off"
          maxLength={120}
          {...register(name as never)}
          {...sharedAria}
        />
      )}
      {field.type === "LONG_TEXT" && (
        <Textarea
          id={inputId}
          rows={4}
          maxLength={2000}
          {...register(name as never)}
          {...sharedAria}
        />
      )}
      {field.type === "NUMBER" && (
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step="any"
          min={field.min}
          max={field.max}
          {...register(name as never)}
          {...sharedAria}
        />
      )}
      {field.type === "SINGLE_CHOICE" && (
        <fieldset id={inputId} {...sharedAria} className="space-y-1">
          <legend className="sr-only">{field.label}</legend>
          {field.options.map((opt: { value: string; label: string }) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm"
              htmlFor={`${inputId}-${opt.value}`}
            >
              <input
                id={`${inputId}-${opt.value}`}
                type="radio"
                value={opt.value}
                className="h-4 w-4 accent-primary"
                {...register(name as never)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      {field.type === "YES_NO" && (
        <YesNoToggle
          inputId={inputId}
          name={name}
          register={register}
          watch={watch}
          sharedAria={sharedAria}
        />
      )}
      {error?.message && (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}

function FieldLabel({
  field,
  htmlFor,
}: {
  field: CategoryFieldDefinition;
  htmlFor: string | undefined;
}): ReactNode {
  return (
    <Label htmlFor={htmlFor}>
      {field.label}
      {field.required && (
        <span aria-hidden="true" className="ml-1 text-destructive">
          *
        </span>
      )}
      {field.required && <span className="sr-only">required</span>}
    </Label>
  );
}

function YesNoToggle({
  inputId,
  name,
  register,
  watch,
  sharedAria,
}: {
  inputId: string;
  name: string;
  register: UseFormRegister<{ answers: Record<string, unknown> }>;
  watch: UseFormWatch<{ answers: Record<string, unknown> }>;
  sharedAria: { "aria-invalid": boolean; "aria-describedby": string | undefined };
}): JSX.Element {
  const v: unknown = watch(name as never);
  const checked = v === true || v === "true";
  return (
    <label className="inline-flex items-center gap-2 text-sm" htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        className="h-4 w-4 accent-primary"
        {...register(name as never)}
        {...sharedAria}
      />
      <span>{checked ? "Yes" : "No"}</span>
    </label>
  );
}
