CREATE TABLE `accounts` (
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text,
	`uploader_id` text NOT NULL,
	`original_name` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `bootstrap_admin_marker` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`state` text NOT NULL,
	`proposed_by_id` text,
	`decided_by_id` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`is_protected` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`proposed_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`decided_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category_id` text NOT NULL,
	`status` text DEFAULT 'SUBMITTED' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `status_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`idea_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`from_state` text NOT NULL,
	`to_state` text NOT NULL,
	`comment` text,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`idea_id`) REFERENCES `ideas`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'EMPLOYEE' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_attachments_idea` ON `attachments` (`idea_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_categories_name_lower` ON `categories` (lower("name"));--> statement-breakpoint
CREATE INDEX `idx_categories_state` ON `categories` (`state`);--> statement-breakpoint
CREATE INDEX `idx_ideas_author_updated` ON `ideas` (`author_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ideas_status` ON `ideas` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ideas_category` ON `ideas` (`category_id`);--> statement-breakpoint
CREATE INDEX `idx_transitions_idea_recorded` ON `status_transitions` (`idea_id`,`recorded_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email_lower` ON `users` (lower("email"));