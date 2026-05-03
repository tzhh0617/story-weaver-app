CREATE TABLE `book_context` (
	`book_id` text PRIMARY KEY NOT NULL,
	`world_setting` text,
	`outline` text,
	`style_guide` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`idea` text NOT NULL,
	`status` text DEFAULT 'creating' NOT NULL,
	`model_id` text NOT NULL,
	`target_chapters` integer NOT NULL,
	`words_per_chapter` integer NOT NULL,
	`viral_strategy_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `world_settings` (
	`book_id` text NOT NULL,
	`category` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`book_id`, `category`, `key`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_plans` (
	`book_id` text NOT NULL,
	`batch_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`arc_index` integer NOT NULL,
	`goal` text NOT NULL,
	`conflict` text NOT NULL,
	`pressure_source` text NOT NULL,
	`change_type` text NOT NULL,
	`thread_actions_json` text NOT NULL,
	`reveal` text NOT NULL,
	`payoff_or_cost` text NOT NULL,
	`ending_hook` text NOT NULL,
	`title_idea_link` text NOT NULL,
	`batch_goal` text NOT NULL,
	`required_payoffs_json` text NOT NULL,
	`forbidden_drift_json` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	PRIMARY KEY(`book_id`, `chapter_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_character_pressures` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`character_id` text NOT NULL,
	`desire_pressure` text NOT NULL,
	`fear_pressure` text NOT NULL,
	`flaw_trigger` text NOT NULL,
	`expected_choice` text NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`, `character_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_generation_audits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`attempt` integer NOT NULL,
	`passed` integer NOT NULL,
	`score` integer NOT NULL,
	`decision` text NOT NULL,
	`issues_json` text NOT NULL,
	`scoring_json` text NOT NULL,
	`state_updates_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_relationship_actions` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`relationship_id` text NOT NULL,
	`action` text NOT NULL,
	`required_change` text NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`, `relationship_id`, `action`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_tension_budgets` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`pressure_level` text NOT NULL,
	`dominant_tension` text NOT NULL,
	`required_turn` text NOT NULL,
	`forced_choice` text NOT NULL,
	`cost_to_pay` text NOT NULL,
	`irreversible_change` text NOT NULL,
	`reader_question` text NOT NULL,
	`hook_pressure` text NOT NULL,
	`flatness_risks_json` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapter_thread_actions` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`thread_id` text NOT NULL,
	`action` text NOT NULL,
	`required_effect` text NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`, `thread_id`, `action`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chapters` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`summary` text,
	`word_count` integer DEFAULT 0 NOT NULL,
	`audit_score` integer,
	`draft_attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` text,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_arcs` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`name` text NOT NULL,
	`role_type` text NOT NULL,
	`desire` text NOT NULL,
	`fear` text NOT NULL,
	`flaw` text NOT NULL,
	`misbelief` text NOT NULL,
	`wound` text,
	`external_goal` text NOT NULL,
	`internal_need` text NOT NULL,
	`arc_direction` text NOT NULL,
	`decision_logic` text NOT NULL,
	`line_will_not_cross` text,
	`line_may_eventually_cross` text,
	`current_arc_phase` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `character_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`character_id` text NOT NULL,
	`character_name` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`location` text,
	`status` text,
	`knowledge` text,
	`emotion` text,
	`power_level` text,
	`arc_phase` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_states_book_character_volume_chapter_idx` ON `character_states` (`book_id`,`character_id`,`volume_index`,`chapter_index`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`name` text NOT NULL,
	`role_type` text NOT NULL,
	`personality` text NOT NULL,
	`speech_style` text,
	`appearance` text,
	`abilities` text,
	`background` text,
	`relationships` text,
	`first_appear` integer,
	`is_active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `narrative_checkpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`report_json` text NOT NULL,
	`future_card_revisions_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `arc_plans` (
	`book_id` text NOT NULL,
	`arc_index` integer NOT NULL,
	`stage_index` integer NOT NULL,
	`chapter_start` integer NOT NULL,
	`chapter_end` integer NOT NULL,
	`chapter_budget` integer NOT NULL,
	`primary_threads_json` text NOT NULL,
	`character_turns_json` text NOT NULL,
	`thread_actions_json` text NOT NULL,
	`target_outcome` text NOT NULL,
	`escalation_mode` text NOT NULL,
	`turning_point` text NOT NULL,
	`required_payoff` text NOT NULL,
	`resulting_instability` text NOT NULL,
	`title_idea_focus` text NOT NULL,
	`min_chapter_count` integer NOT NULL,
	`max_chapter_count` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	PRIMARY KEY(`book_id`, `arc_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `endgame_plans` (
	`book_id` text PRIMARY KEY NOT NULL,
	`title_idea_contract` text NOT NULL,
	`protagonist_end_state` text NOT NULL,
	`final_conflict` text NOT NULL,
	`final_opponent` text NOT NULL,
	`world_end_state` text NOT NULL,
	`core_character_outcomes_json` text NOT NULL,
	`major_payoffs_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `narrative_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`type` text NOT NULL,
	`promise` text NOT NULL,
	`planted_at` integer NOT NULL,
	`expected_payoff` integer,
	`resolved_at` integer,
	`current_state` text NOT NULL,
	`importance` text NOT NULL,
	`payoff_must_change` text NOT NULL,
	`owner_character_id` text,
	`related_relationship_id` text,
	`notes` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plot_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`description` text NOT NULL,
	`planted_at` integer NOT NULL,
	`expected_payoff` integer,
	`resolved_at` integer,
	`importance` text DEFAULT 'normal' NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relationship_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`from_character_id` text NOT NULL,
	`to_character_id` text NOT NULL,
	`visible_label` text NOT NULL,
	`hidden_truth` text,
	`dependency` text,
	`debt` text,
	`misunderstanding` text,
	`affection` text,
	`harm_pattern` text,
	`shared_goal` text,
	`value_conflict` text,
	`trust_level` integer NOT NULL,
	`tension_level` integer NOT NULL,
	`current_state` text NOT NULL,
	`planned_turns_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `relationship_states` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`relationship_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`trust_level` integer NOT NULL,
	`tension_level` integer NOT NULL,
	`current_state` text NOT NULL,
	`change_summary` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `relationship_states_book_relationship_volume_chapter_idx` ON `relationship_states` (`book_id`,`relationship_id`,`volume_index`,`chapter_index`);--> statement-breakpoint
CREATE TABLE `scene_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`location` text NOT NULL,
	`time_in_story` text NOT NULL,
	`characters_present` text NOT NULL,
	`events` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stage_plans` (
	`book_id` text NOT NULL,
	`stage_index` integer NOT NULL,
	`chapter_start` integer NOT NULL,
	`chapter_end` integer NOT NULL,
	`chapter_budget` integer NOT NULL,
	`objective` text NOT NULL,
	`primary_resistance` text NOT NULL,
	`pressure_curve` text NOT NULL,
	`escalation` text NOT NULL,
	`climax` text NOT NULL,
	`payoff` text NOT NULL,
	`irreversible_change` text NOT NULL,
	`next_question` text NOT NULL,
	`title_idea_focus` text NOT NULL,
	`compression_trigger` text NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	PRIMARY KEY(`book_id`, `stage_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `story_state_snapshots` (
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`summary` text NOT NULL,
	`title_idea_alignment` text NOT NULL,
	`flatness_risk` text NOT NULL,
	`character_changes_json` text NOT NULL,
	`relationship_changes_json` text NOT NULL,
	`world_facts_json` text NOT NULL,
	`thread_updates_json` text NOT NULL,
	`unresolved_promises_json` text NOT NULL,
	`stage_progress` text NOT NULL,
	`remaining_chapter_budget` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `chapter_index`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `title_idea_contracts` (
	`book_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`idea` text NOT NULL,
	`core_promise` text NOT NULL,
	`title_hooks_json` text DEFAULT '[]' NOT NULL,
	`forbidden_drift_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `world_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`category` text NOT NULL,
	`rule_text` text NOT NULL,
	`cost` text NOT NULL,
	`who_benefits` text,
	`who_suffers` text,
	`taboo` text,
	`violation_consequence` text,
	`allowed_exception` text,
	`current_status` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `api_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text,
	`model_id` text,
	`phase` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`duration_ms` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model_name` text NOT NULL,
	`api_key` text,
	`base_url` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`config_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `writing_progress` (
	`book_id` text PRIMARY KEY NOT NULL,
	`current_volume` integer,
	`current_chapter` integer,
	`current_stage` integer,
	`current_arc` integer,
	`phase` text,
	`step_label` text,
	`active_task_type` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`error_msg` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action
);
