CREATE TABLE `book_contracts` (
	`book_id` text PRIMARY KEY NOT NULL,
	`title_promise` text NOT NULL,
	`core_premise` text NOT NULL,
	`mainline_promise` text NOT NULL,
	`protagonist_core_desire` text NOT NULL,
	`protagonist_no_drift_rules_json` text NOT NULL,
	`key_character_boundaries_json` text NOT NULL,
	`mandatory_payoffs_json` text NOT NULL,
	`anti_drift_rules_json` text NOT NULL,
	`active_template` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_checkpoints` (
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`checkpoint_type` text NOT NULL,
	`contract_digest` text NOT NULL,
	`plan_digest` text NOT NULL,
	`ledger_digest_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `chapter_index`, `checkpoint_type`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_events` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`event_type` text NOT NULL,
	`summary` text NOT NULL,
	`affected_ids_json` text NOT NULL,
	`irreversible` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_ledgers` (
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`mainline_progress` text NOT NULL,
	`active_subplots_json` text NOT NULL,
	`open_promises_json` text NOT NULL,
	`character_truths_json` text NOT NULL,
	`relationship_deltas_json` text NOT NULL,
	`world_facts_json` text NOT NULL,
	`rhythm_position` text NOT NULL,
	`risk_flags_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `chapter_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `writing_progress` ADD `drift_level` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `writing_progress` ADD `last_healthy_checkpoint_chapter` integer;--> statement-breakpoint
ALTER TABLE `writing_progress` ADD `cooldown_until` text;--> statement-breakpoint
ALTER TABLE `writing_progress` ADD `starvation_score` integer DEFAULT 0 NOT NULL;