"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErrorCode } from "@/lib/errors/codes";
import {
  CATEGORY_FIELD_LIMIT,
  type CategoryFieldDefinition,
  type CategoryFieldType,
} from "@/lib/validation/category-fields";

interface Props {
  categoryId: string;
  categoryName: string;
  initialFields: CategoryFieldDefinition[];
}

type EditableField = CategoryFieldDefinition & { _id: string };

let counter = 0;
function nextLocalId(): string {
  counter += 1;
  return `f-${counter}`;
}

function withLocalIds(fields: readonly CategoryFieldDefinition[]): EditableField[] {
  return fields.map((f) => ({ ...f, _id: nextLocalId() } as EditableField));
}

function emptyField(type: CategoryFieldType): EditableField {
  const base = { _id: nextLocalId(), key: "", label: "", required: false } as const;
  if (type === "SINGLE_CHOICE") {
    return { ...base, type, options: [{ value: "option_1", label: "Option 1" }] };
  }
  if (type === "NUMBER") {
    return { ...base, type };
  }
  return { ...base, type } as EditableField;
}

/**
 * Admin-facing client editor for a category's structured-field
 * schema. Renders one row per field with inline controls for label,
 * type, required-flag, and (for `SINGLE_CHOICE`) an options
 * sub-editor. Submits the whole schema as a single `PUT` per the
 * full-replace contract from `contracts/openapi.yaml`.
 */
export function CategorySchemaEditor({
  categoryId,
  categoryName,
  initialFields,
}: Props): JSX.Element {
  const router = useRouter();
  const [fields, setFields] = useState<EditableField[]>(() => withLocalIds(initialFields));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateField(id: string, patch: Partial<EditableField>): void {
    setFields((prev) =>
      prev.map((f) => (f._id === id ? ({ ...f, ...patch } as EditableField) : f)),
    );
  }

  function move(id: string, delta: -1 | 1): void {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f._id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  function remove(id: string): void {
    setFields((prev) => prev.filter((f) => f._id !== id));
  }

  function addField(): void {
    if (fields.length >= CATEGORY_FIELD_LIMIT) return;
    setFields((prev) => [...prev, emptyField("SHORT_TEXT")]);
  }

  function save(): void {
    setError(null);
    // strip local ids before submitting
    const payload = fields.map(({ _id, ...rest }) => rest);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/categories/${categoryId}/schema`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: payload }),
        });
        if (!res.ok) {
          const body = (await res.json()) as {
            error?: { code?: ErrorCode; message?: string };
          };
          throw new Error(body.error?.message ?? "Save failed");
        }
        toast.success(`Saved ${categoryName} schema`);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Save failed";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-destructive p-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {fields.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            This category has no extra fields yet. Click <em>Add field</em> to create one.
          </CardContent>
        </Card>
      )}
      {fields.map((field, idx) => (
        <FieldRow
          key={field._id}
          field={field}
          isFirst={idx === 0}
          isLast={idx === fields.length - 1}
          onChange={(patch) => updateField(field._id, patch)}
          onMoveUp={() => move(field._id, -1)}
          onMoveDown={() => move(field._id, 1)}
          onRemove={() => remove(field._id)}
        />
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={addField}
          disabled={fields.length >= CATEGORY_FIELD_LIMIT}
        >
          Add field ({fields.length}/{CATEGORY_FIELD_LIMIT})
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save schema"}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  isFirst,
  isLast,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  field: EditableField;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<EditableField>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}): JSX.Element {
  const id = field._id;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">{field.label || "(unnamed field)"}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isFirst}
            onClick={onMoveUp}
            aria-label="Move up"
          >
            ↑
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isLast}
            onClick={onMoveDown}
            aria-label="Move down"
          >
            ↓
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onRemove}
            aria-label="Remove field"
          >
            Remove
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-key`}>Key (machine name)</Label>
          <Input
            id={`${id}-key`}
            value={field.key}
            onChange={(e) => onChange({ key: e.target.value })}
            placeholder="snake_case_key"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-label`}>Label (shown to users)</Label>
          <Input
            id={`${id}-label`}
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-type`}>Type</Label>
          <select
            id={`${id}-type`}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={field.type}
            onChange={(e) => {
              const t = e.target.value as CategoryFieldType;
              const reset = emptyField(t);
              onChange({
                ...reset,
                _id: field._id,
                key: field.key,
                label: field.label,
                required: field.required,
              } as Partial<EditableField>);
            }}
          >
            <option value="SHORT_TEXT">Short text</option>
            <option value="LONG_TEXT">Long text</option>
            <option value="NUMBER">Number</option>
            <option value="SINGLE_CHOICE">Single choice</option>
            <option value="YES_NO">Yes / No</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id={`${id}-required`}
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={field.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          <Label htmlFor={`${id}-required`}>Required</Label>
        </div>
        {field.type === "NUMBER" && (
          <>
            <div className="space-y-1">
              <Label htmlFor={`${id}-min`}>Minimum</Label>
              <Input
                id={`${id}-min`}
                type="number"
                value={field.min ?? ""}
                onChange={(e) =>
                  onChange({ min: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-max`}>Maximum</Label>
              <Input
                id={`${id}-max`}
                type="number"
                value={field.max ?? ""}
                onChange={(e) =>
                  onChange({ max: e.target.value === "" ? undefined : Number(e.target.value) })
                }
              />
            </div>
          </>
        )}
        {field.type === "SINGLE_CHOICE" && (
          <div className="space-y-2 sm:col-span-2">
            <Label>Options</Label>
            <OptionsEditor
              options={field.options}
              onChange={(options) => onChange({ options } as Partial<EditableField>)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: readonly { value: string; label: string }[];
  onChange: (next: { value: string; label: string }[]) => void;
}): JSX.Element {
  function update(idx: number, patch: Partial<{ value: string; label: string }>): void {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  }
  function remove(idx: number): void {
    onChange(options.filter((_, i) => i !== idx));
  }
  function add(): void {
    onChange([...options, { value: `option_${options.length + 1}`, label: "New option" }]);
  }
  return (
    <div className="space-y-2">
      {options.map((opt, idx) => (
        <div key={idx} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`Option ${idx + 1} value`}
            className="max-w-[200px]"
            value={opt.value}
            onChange={(e) => update(idx, { value: e.target.value })}
            placeholder="snake_case_value"
          />
          <Input
            aria-label={`Option ${idx + 1} label`}
            value={opt.label}
            onChange={(e) => update(idx, { label: e.target.value })}
            placeholder="Display label"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => remove(idx)}
            disabled={options.length <= 1}
            aria-label={`Remove option ${idx + 1}`}
          >
            ×
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="secondary" onClick={add}>
        Add option
      </Button>
    </div>
  );
}
