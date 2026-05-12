ALTER TABLE `categories` ADD `field_schema` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideas` ADD `category_answers` text DEFAULT '[]' NOT NULL;