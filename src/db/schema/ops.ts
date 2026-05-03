import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books.js';

export const writingProgress = sqliteTable('writing_progress', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  currentVolume: integer('current_volume'),
  currentChapter: integer('current_chapter'),
  currentStage: integer('current_stage'),
  currentArc: integer('current_arc'),
  phase: text('phase'),
  stepLabel: text('step_label'),
  activeTaskType: text('active_task_type'),
  retryCount: integer('retry_count').notNull().default(0),
  errorMsg: text('error_msg'),
});

export const apiLogs = sqliteTable('api_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id'),
  modelId: text('model_id'),
  phase: text('phase'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  durationMs: integer('duration_ms'),
  createdAt: text('created_at').notNull(),
});

export const modelConfigs = sqliteTable('model_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  modelName: text('model_name').notNull(),
  apiKey: text('api_key'),
  baseUrl: text('base_url'),
  isActive: integer('is_active').notNull().default(1),
  configJson: text('config_json').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
