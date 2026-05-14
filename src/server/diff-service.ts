import { diffArrays, diffWordsWithSpace } from "diff";

/** One word-level segment for a prose diff. */
export interface DiffSegment {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/** A prose field diff (title / description). */
export interface ProseFieldDiff {
  kind: "prose";
  field: string;
  changed: boolean;
  truncated: boolean;
  segments: DiffSegment[];
}

/** A structured-answer field diff (opaque before / after). */
export interface StructuredFieldDiff {
  kind: "structured";
  field: string;
  changed: boolean;
  from: unknown;
  to: unknown;
}

/** Attachment list diff. */
export interface AttachmentDiff {
  kind: "attachments";
  changed: boolean;
  added: string[];
  removed: string[];
  reordered: boolean;
}

/** Union returned by {@link diffIdeaVersions}. */
export type FieldDiff = ProseFieldDiff | StructuredFieldDiff | AttachmentDiff;

/** Aggregate diff between two `IdeaVersion` snapshots. */
export interface IdeaDiff {
  fromVersion: number;
  toVersion: number;
  fields: FieldDiff[];
}

/** Minimal `IdeaVersion` shape consumed by the diff function. */
export interface DiffInput {
  versionNo: number;
  title: string;
  description: string;
  categoryAnswers: unknown;
  attachmentIds: string[];
}

const MAX_PROSE_BYTES = 200 * 1024;

function diffProse(field: string, a: string, b: string): ProseFieldDiff {
  if (a === b) {
    return { kind: "prose", field, changed: false, truncated: false, segments: [] };
  }
  const truncated = a.length > MAX_PROSE_BYTES || b.length > MAX_PROSE_BYTES;
  const A = truncated ? a.slice(0, MAX_PROSE_BYTES) : a;
  const B = truncated ? b.slice(0, MAX_PROSE_BYTES) : b;
  const segments = diffWordsWithSpace(A, B).map((p) => {
    const seg: DiffSegment = { value: p.value };
    if (p.added) seg.added = true;
    if (p.removed) seg.removed = true;
    return seg;
  });
  return { kind: "prose", field, changed: true, truncated, segments };
}

function diffStructured(a: unknown, b: unknown): StructuredFieldDiff[] {
  const aArr = Array.isArray(a) ? a : [];
  const bArr = Array.isArray(b) ? b : [];
  const keys = new Set<string>();
  for (const r of [...aArr, ...bArr]) {
    if (r && typeof r === "object" && "fieldKey" in r) {
      keys.add(String((r as { fieldKey: unknown }).fieldKey));
    }
  }
  const result: StructuredFieldDiff[] = [];
  for (const k of keys) {
    const av = (aArr as Array<{ fieldKey: string; value: unknown }>).find((r) => r.fieldKey === k);
    const bv = (bArr as Array<{ fieldKey: string; value: unknown }>).find((r) => r.fieldKey === k);
    const from = av?.value;
    const to = bv?.value;
    const changed = JSON.stringify(from ?? null) !== JSON.stringify(to ?? null);
    result.push({ kind: "structured", field: k, changed, from, to });
  }
  return result;
}

function diffAttachments(a: string[], b: string[]): AttachmentDiff {
  const setA = new Set(a);
  const setB = new Set(b);
  const added = b.filter((id) => !setA.has(id));
  const removed = a.filter((id) => !setB.has(id));
  const reordered =
    added.length === 0 &&
    removed.length === 0 &&
    a.length === b.length &&
    a.some((id, i) => b[i] !== id);
  const changed = added.length > 0 || removed.length > 0 || reordered;
  return { kind: "attachments", changed, added, removed, reordered };
}

/**
 * Pure diff between two version snapshots per [data-model §4]
 * (../../specs/005-attachments-history-notifications/data-model.md).
 * Prose fields are word-level, structured fields are opaque
 * `from`/`to`, attachments produce `+/-` plus a `reordered` flag.
 */
export function diffIdeaVersions(a: DiffInput, b: DiffInput): IdeaDiff {
  // touch unused import so lint doesn't complain when used only via index
  void diffArrays;
  const fields: FieldDiff[] = [
    diffProse("title", a.title, b.title),
    diffProse("description", a.description, b.description),
    ...diffStructured(a.categoryAnswers, b.categoryAnswers),
    diffAttachments(a.attachmentIds, b.attachmentIds),
  ];
  return { fromVersion: a.versionNo, toVersion: b.versionNo, fields };
}
