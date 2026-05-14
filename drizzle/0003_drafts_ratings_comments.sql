-- Phase 4: Advanced Evaluation Experience.
--
-- Adds drafts, multi-dimensional ratings, comment threads, and the
-- anonymity column on ideas + categories. See specs/004 data-model
-- for the full schema rationale.

ALTER TABLE `categories` ADD `anonymous_default` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `ideas` ADD `anonymous` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `idea_drafts` (
  `id` text PRIMARY KEY NOT NULL,
  `author_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `title` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `category_id` text REFERENCES `categories`(`id`) ON DELETE SET NULL,
  `category_answers` text DEFAULT '[]' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_drafts_author_updated` ON `idea_drafts` (`author_id`, `updated_at`);
--> statement-breakpoint
CREATE TABLE `rating_dimensions` (
  `id` text PRIMARY KEY NOT NULL,
  `category_id` text REFERENCES `categories`(`id`) ON DELETE CASCADE,
  `label` text NOT NULL,
  `description` text,
  `position` integer DEFAULT 0 NOT NULL,
  `required` integer DEFAULT 0 NOT NULL,
  `active` integer DEFAULT 1 NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_dimensions_category` ON `rating_dimensions` (`category_id`, `position`);
--> statement-breakpoint
CREATE TABLE `ratings` (
  `id` text PRIMARY KEY NOT NULL,
  `idea_id` text NOT NULL REFERENCES `ideas`(`id`) ON DELETE CASCADE,
  `evaluator_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `dimension_id` text NOT NULL REFERENCES `rating_dimensions`(`id`) ON DELETE RESTRICT,
  `score` integer,
  `locked_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_ratings_idea_eval_dim` ON `ratings` (`idea_id`, `evaluator_id`, `dimension_id`);
--> statement-breakpoint
CREATE INDEX `idx_ratings_idea` ON `ratings` (`idea_id`);
--> statement-breakpoint
CREATE INDEX `idx_ratings_evaluator` ON `ratings` (`evaluator_id`);
--> statement-breakpoint
CREATE TABLE `comments` (
  `id` text PRIMARY KEY NOT NULL,
  `idea_id` text NOT NULL REFERENCES `ideas`(`id`) ON DELETE CASCADE,
  `author_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE RESTRICT,
  `author_role_at_post` text NOT NULL,
  `parent_id` text REFERENCES `comments`(`id`) ON DELETE CASCADE,
  `kind` text DEFAULT 'COMMENT' NOT NULL,
  `body` text NOT NULL,
  `created_at` integer NOT NULL,
  `edited_at` integer,
  `deleted_at` integer,
  `deleted_by_id` text REFERENCES `users`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `idx_comments_idea_created` ON `comments` (`idea_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `idx_comments_parent` ON `comments` (`parent_id`);
--> statement-breakpoint
CREATE INDEX `idx_ideas_status_created` ON `ideas` (`status`, `created_at`);
--> statement-breakpoint
INSERT INTO `rating_dimensions` (`id`, `category_id`, `label`, `description`, `position`, `required`, `active`, `created_at`) VALUES
  ('dim-default-feasibility',  NULL, 'Feasibility',  'How realistic is this idea to build?',    1, 1, 1, unixepoch() * 1000),
  ('dim-default-impact',       NULL, 'Impact',       'Expected magnitude of value if shipped.', 2, 1, 1, unixepoch() * 1000),
  ('dim-default-originality',  NULL, 'Originality',  'How novel is the approach?',              3, 0, 1, unixepoch() * 1000),
  ('dim-default-alignment',    NULL, 'Alignment',    'Fit with current strategic priorities.',  4, 0, 1, unixepoch() * 1000);
