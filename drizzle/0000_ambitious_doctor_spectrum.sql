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
CREATE INDEX `idx_api_logs_book_id_created_at` ON `api_logs` (`book_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `book_context` (
	`book_id` text PRIMARY KEY NOT NULL,
	`world_setting` text,
	`outline` text,
	`style_guide` text
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
CREATE INDEX `idx_books_status` ON `books` (`status`);--> statement-breakpoint
CREATE TABLE `chapter_cards` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`title` text NOT NULL,
	`plot_function` text NOT NULL,
	`pov_character_id` text,
	`external_conflict` text NOT NULL,
	`internal_conflict` text NOT NULL,
	`relationship_change` text NOT NULL,
	`world_rule_used_or_tested` text NOT NULL,
	`information_reveal` text NOT NULL,
	`reader_reward` text NOT NULL,
	`ending_hook` text NOT NULL,
	`must_change` text NOT NULL,
	`forbidden_moves_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`)
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
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`, `character_id`)
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
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chapter_relationship_actions` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`relationship_id` text NOT NULL,
	`action` text NOT NULL,
	`required_change` text NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`, `relationship_id`, `action`)
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
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`)
);
--> statement-breakpoint
CREATE TABLE `chapter_thread_actions` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`thread_id` text NOT NULL,
	`action` text NOT NULL,
	`required_effect` text NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`, `thread_id`, `action`)
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
	PRIMARY KEY(`book_id`, `volume_index`, `chapter_index`)
);
--> statement-breakpoint
CREATE INDEX `idx_chapters_book_id` ON `chapters` (`book_id`);--> statement-breakpoint
CREATE TABLE `character_arcs` (
	`id` text NOT NULL,
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
	PRIMARY KEY(`book_id`, `id`)
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
CREATE UNIQUE INDEX `character_states_book_id_character_id_volume_index_chapter_index_unique` ON `character_states` (`book_id`,`character_id`,`volume_index`,`chapter_index`);--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text NOT NULL,
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
	PRIMARY KEY(`book_id`, `id`)
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
CREATE TABLE `narrative_checkpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`chapter_index` integer NOT NULL,
	`report_json` text NOT NULL,
	`future_card_revisions_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `narrative_threads` (
	`id` text NOT NULL,
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
	PRIMARY KEY(`book_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `plot_threads` (
	`id` text NOT NULL,
	`book_id` text NOT NULL,
	`description` text NOT NULL,
	`planted_at` integer NOT NULL,
	`expected_payoff` integer,
	`resolved_at` integer,
	`importance` text DEFAULT 'normal' NOT NULL,
	PRIMARY KEY(`book_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `relationship_edges` (
	`id` text NOT NULL,
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
	PRIMARY KEY(`book_id`, `id`)
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
CREATE UNIQUE INDEX `relationship_states_book_id_relationship_id_volume_index_chapter_index_unique` ON `relationship_states` (`book_id`,`relationship_id`,`volume_index`,`chapter_index`);--> statement-breakpoint
CREATE TABLE `scene_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`chapter_index` integer NOT NULL,
	`location` text NOT NULL,
	`time_in_story` text NOT NULL,
	`characters_present` text NOT NULL,
	`events` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story_bibles` (
	`book_id` text PRIMARY KEY NOT NULL,
	`premise` text NOT NULL,
	`genre_contract` text NOT NULL,
	`target_reader_experience` text NOT NULL,
	`theme_question` text NOT NULL,
	`theme_answer_direction` text NOT NULL,
	`central_dramatic_question` text NOT NULL,
	`ending_state_json` text NOT NULL,
	`voice_guide` text NOT NULL,
	`viral_protocol_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `volume_plans` (
	`book_id` text NOT NULL,
	`volume_index` integer NOT NULL,
	`title` text NOT NULL,
	`chapter_start` integer NOT NULL,
	`chapter_end` integer NOT NULL,
	`role_in_story` text NOT NULL,
	`main_pressure` text NOT NULL,
	`promised_payoff` text NOT NULL,
	`character_arc_movement` text NOT NULL,
	`relationship_movement` text NOT NULL,
	`world_expansion` text NOT NULL,
	`ending_turn` text NOT NULL,
	PRIMARY KEY(`book_id`, `volume_index`)
);
--> statement-breakpoint
CREATE TABLE `world_rules` (
	`id` text NOT NULL,
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
	PRIMARY KEY(`book_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `world_settings` (
	`book_id` text NOT NULL,
	`category` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`book_id`, `category`, `key`)
);
--> statement-breakpoint
CREATE TABLE `writing_progress` (
	`book_id` text PRIMARY KEY NOT NULL,
	`current_volume` integer,
	`current_chapter` integer,
	`phase` text,
	`step_label` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`error_msg` text
);
--> statement-breakpoint
CREATE INDEX `idx_writing_progress_book_id` ON `writing_progress` (`book_id`);