import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * The three roles a user may hold in Phase 1.
 */
export const ROLES = ["EMPLOYEE", "EVALUATOR", "ADMIN"] as const;
/**
 * Union type of {@link ROLES}.
 */
export type Role = (typeof ROLES)[number];

/**
 * Allowed Idea statuses.
 */
export const IDEA_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "IMPLEMENTED",
] as const;
/**
 * Union type of {@link IDEA_STATUSES}.
 */
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

/**
 * Allowed Category lifecycle states.
 */
export const CATEGORY_STATES = ["ACTIVE", "PROPOSED", "REJECTED"] as const;
/**
 * Union type of {@link CATEGORY_STATES}.
 */
export type CategoryState = (typeof CATEGORY_STATES)[number];

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ROLES }).notNull().default("EMPLOYEE"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    emailLower: uniqueIndex("idx_users_email_lower").on(sql`lower(${t.email})`),
    roleCheck: check("users_role_check", sql`${t.role} IN ('EMPLOYEE','EVALUATOR','ADMIN')`),
  }),
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires").notNull(),
});

export const accounts = sqliteTable("accounts", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires").notNull(),
});

/**
 * Marker row that records the bootstrap-admin email until a matching
 * user registers (FR-005b). Cleared once consumed.
 */
export const bootstrapAdminMarker = sqliteTable("bootstrap_admin_marker", {
  email: text("email").primaryKey(),
  createdAt: integer("created_at").notNull(),
});

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    state: text("state", { enum: CATEGORY_STATES }).notNull(),
    proposedById: text("proposed_by_id").references(() => users.id, { onDelete: "restrict" }),
    decidedById: text("decided_by_id").references(() => users.id, { onDelete: "restrict" }),
    decidedAt: integer("decided_at"),
    createdAt: integer("created_at").notNull(),
    isProtected: integer("is_protected").notNull().default(0),
    fieldSchema: text("field_schema").notNull().default("[]"),
    anonymousDefault: integer("anonymous_default").notNull().default(0),
  },
  (t) => ({
    nameLower: uniqueIndex("uniq_categories_name_lower").on(sql`lower(${t.name})`),
    stateIdx: index("idx_categories_state").on(t.state),
    stateCheck: check(
      "categories_state_check",
      sql`${t.state} IN ('ACTIVE','PROPOSED','REJECTED')`,
    ),
  }),
);

export const ideas = sqliteTable(
  "ideas",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    status: text("status", { enum: IDEA_STATUSES }).notNull().default("SUBMITTED"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    categoryAnswers: text("category_answers").notNull().default("[]"),
    anonymous: integer("anonymous").notNull().default(0),
  },
  (t) => ({
    authorUpdatedIdx: index("idx_ideas_author_updated").on(t.authorId, t.updatedAt),
    statusIdx: index("idx_ideas_status").on(t.status),
    categoryIdx: index("idx_ideas_category").on(t.categoryId),
    statusCreatedIdx: index("idx_ideas_status_created").on(t.status, t.createdAt),
    statusCheck: check(
      "ideas_status_check",
      sql`${t.status} IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED')`,
    ),
  }),
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
    uploaderId: text("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    originalName: text("original_name").notNull(),
    storedPath: text("stored_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedAt: integer("uploaded_at").notNull(),
  },
  (t) => ({
    ideaUniq: uniqueIndex("uniq_attachments_idea").on(t.ideaId),
  }),
);

export const statusTransitions = sqliteTable(
  "status_transitions",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    actorId: text("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    fromState: text("from_state", { enum: IDEA_STATUSES }).notNull(),
    toState: text("to_state", { enum: IDEA_STATUSES }).notNull(),
    comment: text("comment"),
    recordedAt: integer("recorded_at").notNull(),
  },
  (t) => ({
    ideaRecordedIdx: index("idx_transitions_idea_recorded").on(t.ideaId, t.recordedAt),
    fromCheck: check(
      "transitions_from_check",
      sql`${t.fromState} IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED')`,
    ),
    toCheck: check(
      "transitions_to_check",
      sql`${t.toState} IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED')`,
    ),
  }),
);

/**
 * Phase 4 — Author-private draft of an idea. Submitting a draft
 * promotes it into an {@link ideas} row in `SUBMITTED` (ADR-0017).
 */
export const ideaDrafts = sqliteTable(
  "idea_drafts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    categoryAnswers: text("category_answers").notNull().default("[]"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    authorUpdatedIdx: index("idx_drafts_author_updated").on(t.authorId, t.updatedAt),
  }),
);

/**
 * Phase 4 — Per-category rating dimensions. Rows with
 * `categoryId IS NULL` form the default set returned when a category
 * has no dimensions of its own.
 */
export const ratingDimensions = sqliteTable(
  "rating_dimensions",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    required: integer("required").notNull().default(0),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    categoryPositionIdx: index("idx_dimensions_category").on(t.categoryId, t.position),
  }),
);

/**
 * Phase 4 — Per-(idea, evaluator, dimension) rating row. `lockedAt`
 * non-null marks the row as read-only after a decision (ADR-0019).
 */
export const ratings = sqliteTable(
  "ratings",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    evaluatorId: text("evaluator_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dimensionId: text("dimension_id")
      .notNull()
      .references(() => ratingDimensions.id, { onDelete: "restrict" }),
    score: integer("score"),
    lockedAt: integer("locked_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("uniq_ratings_idea_eval_dim").on(t.ideaId, t.evaluatorId, t.dimensionId),
    ideaIdx: index("idx_ratings_idea").on(t.ideaId),
    evaluatorIdx: index("idx_ratings_evaluator").on(t.evaluatorId),
  }),
);

/**
 * Comment kinds. `DECISION` rows are written by the idea-service in
 * the same transaction as an APPROVE / REJECT transition.
 */
export const COMMENT_KINDS = ["COMMENT", "DECISION"] as const;
export type CommentKind = (typeof COMMENT_KINDS)[number];

/**
 * Phase 4 — Comment thread row. One level of nesting only (enforced
 * in service). Soft-delete via `deletedAt` (ADR-0020).
 */
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    ideaId: text("idea_id")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    authorRoleAtPost: text("author_role_at_post", { enum: ROLES }).notNull(),
    parentId: text("parent_id"),
    kind: text("kind", { enum: COMMENT_KINDS }).notNull().default("COMMENT"),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
    editedAt: integer("edited_at"),
    deletedAt: integer("deleted_at"),
    deletedById: text("deleted_by_id").references(() => users.id, { onDelete: "restrict" }),
  },
  (t) => ({
    ideaCreatedIdx: index("idx_comments_idea_created").on(t.ideaId, t.createdAt),
    parentIdx: index("idx_comments_parent").on(t.parentId),
  }),
);

