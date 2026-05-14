import { z } from "zod";
import { IDEA_STATUSES } from "@/db/schema";

/**
 * Notification kind enum — mirrors `notification_events.kind` and the
 * Drizzle `NOTIFICATION_KINDS` tuple (ADR-0026). The five members
 * cover every Phase-5 fan-out path: state machine, comment, rating,
 * reviewer reply, and admin bulk-transition digest.
 */
export const NotificationKindEnum = z.enum([
  "STATUS_CHANGED",
  "COMMENT_ADDED",
  "RATING_ADDED",
  "REPLY_ON_REVIEW",
  "BULK_DIGEST",
]);

/** Inferred TypeScript type for {@link NotificationKindEnum}. */
export type NotificationKind = z.infer<typeof NotificationKindEnum>;

const IdeaStatusEnum = z.enum(IDEA_STATUSES);

const StatusChangedPayload = z.object({
  kind: z.literal("STATUS_CHANGED"),
  ideaTitle: z.string().min(1).max(500),
  fromState: IdeaStatusEnum,
  toState: IdeaStatusEnum,
  actorDisplayName: z.string().min(1).max(200),
});

const CommentAddedPayload = z.object({
  kind: z.literal("COMMENT_ADDED"),
  ideaTitle: z.string().min(1).max(500),
  snippet: z.string().max(280),
  actorDisplayName: z.string().min(1).max(200),
});

const RatingAddedPayload = z.object({
  kind: z.literal("RATING_ADDED"),
  ideaTitle: z.string().min(1).max(500),
  perDimension: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(null)]),
      }),
    )
    .max(20),
  actorDisplayName: z.string().min(1).max(200),
});

const ReplyOnReviewPayload = z.object({
  kind: z.literal("REPLY_ON_REVIEW"),
  ideaTitle: z.string().min(1).max(500),
  snippet: z.string().max(280),
  actorDisplayName: z.string().min(1).max(200),
});

const BulkDigestPayload = z.object({
  kind: z.literal("BULK_DIGEST"),
  actorDisplayName: z.string().min(1).max(200),
  items: z
    .array(
      z.object({
        ideaId: z.string().min(1),
        ideaTitle: z.string().min(1).max(500),
        fromState: IdeaStatusEnum,
        toState: IdeaStatusEnum,
      }),
    )
    .min(1),
});

/**
 * Tagged-union schema for `notification_events.payload` per
 * data-model §5. The `kind` discriminator matches the row's column.
 */
export const NotificationPayloadSchema = z.discriminatedUnion("kind", [
  StatusChangedPayload,
  CommentAddedPayload,
  RatingAddedPayload,
  ReplyOnReviewPayload,
  BulkDigestPayload,
]);

/** Inferred TypeScript type for {@link NotificationPayloadSchema}. */
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
