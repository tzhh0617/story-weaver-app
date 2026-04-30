import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { migrations } from './migrations.js';
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

function shouldResetDevelopmentStorySchema(db: SqliteDatabase) {
  const chapterTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chapters'")
    .get();
  if (!chapterTable) return false;

  const columns = db
    .prepare('PRAGMA table_info(chapters)')
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  return columnNames.has('outline') || !columnNames.has('audit_score');
}

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

function resetDevelopmentStorySchema(db: SqliteDatabase) {
  db.exec(`
    DROP TABLE IF EXISTS narrative_checkpoints;
    DROP TABLE IF EXISTS chapter_generation_audits;
    DROP TABLE IF EXISTS chapter_relationship_actions;
    DROP TABLE IF EXISTS chapter_tension_budgets;
    DROP TABLE IF EXISTS chapter_character_pressures;
    DROP TABLE IF EXISTS chapter_thread_actions;
    DROP TABLE IF EXISTS chapter_cards;
    DROP TABLE IF EXISTS chapters;
    DROP TABLE IF EXISTS volume_plans;
    DROP TABLE IF EXISTS relationship_states;
    DROP TABLE IF EXISTS relationship_edges;
    DROP TABLE IF EXISTS narrative_threads;
    DROP TABLE IF EXISTS world_rules;
    DROP TABLE IF EXISTS character_states;
    DROP TABLE IF EXISTS character_arcs;
    DROP TABLE IF EXISTS story_bibles;
    DROP TABLE IF EXISTS characters;
    DROP TABLE IF EXISTS plot_threads;
    DROP TABLE IF EXISTS world_settings;
  `);
}

export function runMigrations(db: SqliteDatabase) {
  for (const migration of migrations) {
    db.exec(migration);
  }

  ensureBookViralStrategyColumn(db);
  ensureStoryBibleViralProtocolColumn(db);

  if (shouldResetDevelopmentStorySchema(db)) {
    resetDevelopmentStorySchema(db);
    for (const migration of migrations) {
      db.exec(migration);
    }
  }
}

export function createDatabase(filename: string) {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  return db;
}

export function createRepositories(db: SqliteDatabase) {
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
