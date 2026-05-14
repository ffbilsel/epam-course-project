/**
 * Phase 4 / 5 — Shared client/server type re-exports.
 */

export type { Draft, DraftSummary } from "@/server/draft-service";
export type { InsightsBucket, InsightsPreset, InsightsRangeInput } from "@/lib/validation/insights";

// Phase 5 — Validation-derived types
export type { NotificationKind, NotificationPayload } from "@/lib/validation/notification";
export type { VersionRangeInput } from "@/lib/validation/version";
export type { EmailPreferenceUpdateInput } from "@/lib/validation/email-preference";
export type {
  AttachmentBatchUploadInput,
  AttachmentReorderInput,
} from "@/lib/validation/attachment";

import type { NotificationKind, NotificationPayload } from "@/lib/validation/notification";
import type { IdeaStructuredAnswer } from "@/lib/validation/category-fields";

/**
 * Phase 5 — Server-derived classification of an attachment for the
 * preview pipeline (data-model §2). The client trusts this verbatim
 * and never looks at the file extension.
 */
export type AttachmentPreviewKind = "image" | "pdf" | "text" | "download";

/**
 * Phase 5 — Refined attachment summary returned by listing /
 * preview / reorder endpoints (data-model §2).
 */
export interface AttachmentSummary {
  id: string;
  ideaId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  displayOrder: number;
  uploadedAt: string;
  previewKind: AttachmentPreviewKind;
}

/** Phase 5 — Whole-idea snapshot row (data-model §3). */
export interface IdeaVersion {
  id: string;
  ideaId: string;
  versionNo: number;
  actorId: string;
  createdAt: string;
  title: string;
  description: string;
  categoryId: string | null;
  categoryAnswers: IdeaStructuredAnswer[];
  attachmentIds: string[];
}

/** Phase 5 — Lightweight summary used by the version-timeline UI. */
export type IdeaVersionSummary = Pick<IdeaVersion, "id" | "versionNo" | "actorId" | "createdAt">;

/** Phase 5 — One contiguous run of equal / added / removed words in a prose diff hunk. */
export interface ProseHunk {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/** Phase 5 — Per-field diff cell returned by `diffIdeaVersions` (data-model §4). */
export type IdeaDiffField =
  | { kind: "prose"; name: string; hunks: ProseHunk[]; changed: boolean }
  | { kind: "structured"; name: string; from: unknown; to: unknown; changed: boolean }
  | {
      kind: "attachments";
      added: AttachmentSummary[];
      removed: AttachmentSummary[];
      reordered: boolean;
      changed: boolean;
    };

/** Phase 5 — Top-level idea-version diff (data-model §4). */
export interface IdeaDiff {
  ideaId: string;
  fromVersionNo: number;
  toVersionNo: number;
  fields: IdeaDiffField[];
  truncated: boolean;
}

/** Phase 5 — In-app notification row (data-model §5). */
export interface NotificationEvent {
  id: string;
  recipientId: string;
  ideaId: string | null;
  kind: NotificationKind;
  payload: NotificationPayload;
  createdAt: string;
  readAt: string | null;
}

/** Phase 5 — Outbound email attempt row (data-model §6). */
export interface EmailDelivery {
  id: string;
  eventId: string;
  status: "pending" | "sent" | "failed" | "suppressed";
  attemptCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
}

/** Phase 5 — Per-user transactional email opt-ins (data-model §7). */
export interface EmailPreference {
  userId: string;
  statusChanges: boolean;
  commentsOnMyIdeas: boolean;
  ratingsOnMyIdeas: boolean;
  repliesOnIdeasIReview: boolean;
  updatedAt: string;
}
