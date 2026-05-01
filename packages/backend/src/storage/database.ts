import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import path from 'node:path';
import { migrations } from './migrations.js';
import { backupDatabaseBeforeMigration, migrateDatabase } from './migrate.js';
import { createBookRepository } from './books.js';
import { createChapterAuditRepository } from './chapter-audits.js';
import { createChapterCardRepository } from './chapter-cards.js';
import { createChapterTensionBudgetRepository } from './chapter-tension-budgets.js';
import { createChapterRepository } from './chapters.js';
import { createCharacterArcRepository } from './character-arcs.js';
import { createCharacterRepository } from './characters.js';
import { createModelConfigRepository } from './model-configs.js';
import { createNarrativeCheckpointRepository } from './narrative-checkpoints.js';
import { createNarrativeThreadRepository } from './narrative-threads.js';
import { createPlotThreadRepository } from './plot-threads.js';
import { createProgressRepository } from './progress.js';
import { createRelationshipEdgeRepository } from './relationship-edges.js';
import { createRelationshipStateRepository } from './relationship-states.js';
import { createSceneRecordRepository } from './scene-records.js';
import { createSettingsRepository } from './settings.js';
import { createStoryBibleRepository } from './story-bibles.js';
import { createVolumePlanRepository } from './volume-plans.js';
import { createWorldRuleRepository } from './world-rules.js';

function ensureBookViralStrategyColumn(db: SqliteDatabase) {
  const columns = db
    .prepare('PRAGMA table_info(books)')
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('viral_strategy_json')) {
    db.prepare('ALTER TABLE books ADD COLUMN viral_strategy_json TEXT').run();
  }
}

function ensureStoryBibleViralProtocolColumn(db: SqliteDatabase) {
  const columns = db
    .prepare('PRAGMA table_info(story_bibles)')
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('viral_protocol_json')) {
    db.prepare('ALTER TABLE story_bibles ADD COLUMN viral_protocol_json TEXT').run();
  }
}

function ensureChapterNarrativeColumns(db: SqliteDatabase) {
  const columns = db
    .prepare('PRAGMA table_info(chapters)')
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('audit_score')) {
    db.prepare('ALTER TABLE chapters ADD COLUMN audit_score INTEGER').run();
  }

  if (!columnNames.has('draft_attempts')) {
    db.prepare(
      'ALTER TABLE chapters ADD COLUMN draft_attempts INTEGER NOT NULL DEFAULT 0'
    ).run();
  }
}

export function runMigrations(
  db: SqliteDatabase,
  options?: { databaseFile?: string }
) {
  for (const migration of migrations) {
    db.exec(migration);
  }

  ensureBookViralStrategyColumn(db);
  ensureStoryBibleViralProtocolColumn(db);
  ensureChapterNarrativeColumns(db);
  if (options?.databaseFile && options.databaseFile !== ':memory:') {
    backupDatabaseBeforeMigration(db, {
      databaseFile: options.databaseFile,
      backupDir: path.join(path.dirname(options.databaseFile), 'backups'),
    });
  }
  migrateDatabase(db);
}

export type Repositories = {
  books: ReturnType<typeof createBookRepository>;
  chapters: ReturnType<typeof createChapterRepository>;
  storyBibles: ReturnType<typeof createStoryBibleRepository>;
  characterArcs: ReturnType<typeof createCharacterArcRepository>;
  relationshipEdges: ReturnType<typeof createRelationshipEdgeRepository>;
  worldRules: ReturnType<typeof createWorldRuleRepository>;
  narrativeThreads: ReturnType<typeof createNarrativeThreadRepository>;
  volumePlans: ReturnType<typeof createVolumePlanRepository>;
  chapterCards: ReturnType<typeof createChapterCardRepository>;
  chapterTensionBudgets: ReturnType<typeof createChapterTensionBudgetRepository>;
  chapterAudits: ReturnType<typeof createChapterAuditRepository>;
  relationshipStates: ReturnType<typeof createRelationshipStateRepository>;
  narrativeCheckpoints: ReturnType<typeof createNarrativeCheckpointRepository>;
  characters: ReturnType<typeof createCharacterRepository>;
  plotThreads: ReturnType<typeof createPlotThreadRepository>;
  sceneRecords: ReturnType<typeof createSceneRecordRepository>;
  progress: ReturnType<typeof createProgressRepository>;
  settings: ReturnType<typeof createSettingsRepository>;
  modelConfigs: ReturnType<typeof createModelConfigRepository>;
};

export function createDatabase(filename: string): SqliteDatabase {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  runMigrations(db, { databaseFile: filename });

  return db;
}

export function createRepositories(db: SqliteDatabase): Repositories {
  const characterArcs = createCharacterArcRepository(db);
  const relationshipEdges = createRelationshipEdgeRepository(db);
  const worldRules = createWorldRuleRepository(db);
  const narrativeThreads = createNarrativeThreadRepository(db);

  return {
    books: createBookRepository(db),
    chapters: createChapterRepository(db),
    storyBibles: createStoryBibleRepository(db, {
      characterArcs,
      relationshipEdges,
      worldRules,
      narrativeThreads,
    }),
    characterArcs,
    relationshipEdges,
    worldRules,
    narrativeThreads,
    volumePlans: createVolumePlanRepository(db),
    chapterCards: createChapterCardRepository(db),
    chapterTensionBudgets: createChapterTensionBudgetRepository(db),
    chapterAudits: createChapterAuditRepository(db),
    relationshipStates: createRelationshipStateRepository(db),
    narrativeCheckpoints: createNarrativeCheckpointRepository(db),
    characters: createCharacterRepository(db),
    plotThreads: createPlotThreadRepository(db),
    sceneRecords: createSceneRecordRepository(db),
    progress: createProgressRepository(db),
    settings: createSettingsRepository(db),
    modelConfigs: createModelConfigRepository(db),
  };
}
