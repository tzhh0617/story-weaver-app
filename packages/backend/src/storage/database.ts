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

function ensurePlotThreadsScopedPrimaryKey(db: SqliteDatabase) {
  const columns = db
    .prepare('PRAGMA table_info(plot_threads)')
    .all() as Array<{ name: string; pk: number }>;
  const primaryKeyColumns = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);

  if (
    primaryKeyColumns.length === 2 &&
    primaryKeyColumns[0] === 'book_id' &&
    primaryKeyColumns[1] === 'id'
  ) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS plot_threads_scoped;

      CREATE TABLE plot_threads_scoped (
        id TEXT NOT NULL,
        book_id TEXT NOT NULL,
        description TEXT NOT NULL,
        planted_at INTEGER NOT NULL,
        expected_payoff INTEGER,
        resolved_at INTEGER,
        importance TEXT NOT NULL DEFAULT 'normal',
        PRIMARY KEY (book_id, id),
        FOREIGN KEY (book_id) REFERENCES books(id)
      );

      INSERT OR REPLACE INTO plot_threads_scoped (
        id,
        book_id,
        description,
        planted_at,
        expected_payoff,
        resolved_at,
        importance
      )
      SELECT
        id,
        book_id,
        description,
        planted_at,
        expected_payoff,
        resolved_at,
        importance
      FROM plot_threads;

      DROP TABLE plot_threads;
      ALTER TABLE plot_threads_scoped RENAME TO plot_threads;
    `);
  })();
}

function hasBookScopedIdPrimaryKey(db: SqliteDatabase, tableName: string) {
  const columns = db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all() as Array<{ name: string; pk: number }>;
  const primaryKeyColumns = columns
    .filter((column) => column.pk > 0)
    .sort((left, right) => left.pk - right.pk)
    .map((column) => column.name);

  return (
    primaryKeyColumns.length === 2 &&
    primaryKeyColumns[0] === 'book_id' &&
    primaryKeyColumns[1] === 'id'
  );
}

function recreateScopedIdTable(
  db: SqliteDatabase,
  input: {
    tableName: string;
    createTableSql: (tableName: string) => string;
    columns: string[];
  }
) {
  const tempTableName = `${input.tableName}_scoped`;
  const columnList = input.columns.join(', ');

  db.exec(`
    DROP TABLE IF EXISTS ${tempTableName};

    ${input.createTableSql(tempTableName)}

    INSERT OR REPLACE INTO ${tempTableName} (${columnList})
    SELECT ${columnList}
    FROM ${input.tableName};

    DROP TABLE ${input.tableName};
    ALTER TABLE ${tempTableName} RENAME TO ${input.tableName};
  `);
}

function ensureNarrativeGraphScopedPrimaryKeys(db: SqliteDatabase) {
  const tables = [
    {
      tableName: 'character_arcs',
      columns: [
        'id',
        'book_id',
        'name',
        'role_type',
        'desire',
        'fear',
        'flaw',
        'misbelief',
        'wound',
        'external_goal',
        'internal_need',
        'arc_direction',
        'decision_logic',
        'line_will_not_cross',
        'line_may_eventually_cross',
        'current_arc_phase',
      ],
      createTableSql: (tableName: string) => `
        CREATE TABLE ${tableName} (
          id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          name TEXT NOT NULL,
          role_type TEXT NOT NULL,
          desire TEXT NOT NULL,
          fear TEXT NOT NULL,
          flaw TEXT NOT NULL,
          misbelief TEXT NOT NULL,
          wound TEXT,
          external_goal TEXT NOT NULL,
          internal_need TEXT NOT NULL,
          arc_direction TEXT NOT NULL,
          decision_logic TEXT NOT NULL,
          line_will_not_cross TEXT,
          line_may_eventually_cross TEXT,
          current_arc_phase TEXT NOT NULL,
          PRIMARY KEY (book_id, id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );
      `,
    },
    {
      tableName: 'relationship_edges',
      columns: [
        'id',
        'book_id',
        'from_character_id',
        'to_character_id',
        'visible_label',
        'hidden_truth',
        'dependency',
        'debt',
        'misunderstanding',
        'affection',
        'harm_pattern',
        'shared_goal',
        'value_conflict',
        'trust_level',
        'tension_level',
        'current_state',
        'planned_turns_json',
      ],
      createTableSql: (tableName: string) => `
        CREATE TABLE ${tableName} (
          id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          from_character_id TEXT NOT NULL,
          to_character_id TEXT NOT NULL,
          visible_label TEXT NOT NULL,
          hidden_truth TEXT,
          dependency TEXT,
          debt TEXT,
          misunderstanding TEXT,
          affection TEXT,
          harm_pattern TEXT,
          shared_goal TEXT,
          value_conflict TEXT,
          trust_level INTEGER NOT NULL,
          tension_level INTEGER NOT NULL,
          current_state TEXT NOT NULL,
          planned_turns_json TEXT NOT NULL DEFAULT '[]',
          PRIMARY KEY (book_id, id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );
      `,
    },
    {
      tableName: 'world_rules',
      columns: [
        'id',
        'book_id',
        'category',
        'rule_text',
        'cost',
        'who_benefits',
        'who_suffers',
        'taboo',
        'violation_consequence',
        'allowed_exception',
        'current_status',
      ],
      createTableSql: (tableName: string) => `
        CREATE TABLE ${tableName} (
          id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          category TEXT NOT NULL,
          rule_text TEXT NOT NULL,
          cost TEXT NOT NULL,
          who_benefits TEXT,
          who_suffers TEXT,
          taboo TEXT,
          violation_consequence TEXT,
          allowed_exception TEXT,
          current_status TEXT NOT NULL,
          PRIMARY KEY (book_id, id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );
      `,
    },
    {
      tableName: 'narrative_threads',
      columns: [
        'id',
        'book_id',
        'type',
        'promise',
        'planted_at',
        'expected_payoff',
        'resolved_at',
        'current_state',
        'importance',
        'payoff_must_change',
        'owner_character_id',
        'related_relationship_id',
        'notes',
      ],
      createTableSql: (tableName: string) => `
        CREATE TABLE ${tableName} (
          id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          type TEXT NOT NULL,
          promise TEXT NOT NULL,
          planted_at INTEGER NOT NULL,
          expected_payoff INTEGER,
          resolved_at INTEGER,
          current_state TEXT NOT NULL,
          importance TEXT NOT NULL,
          payoff_must_change TEXT NOT NULL,
          owner_character_id TEXT,
          related_relationship_id TEXT,
          notes TEXT,
          PRIMARY KEY (book_id, id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );
      `,
    },
    {
      tableName: 'characters',
      columns: [
        'id',
        'book_id',
        'name',
        'role_type',
        'personality',
        'speech_style',
        'appearance',
        'abilities',
        'background',
        'relationships',
        'first_appear',
        'is_active',
      ],
      createTableSql: (tableName: string) => `
        CREATE TABLE ${tableName} (
          id TEXT NOT NULL,
          book_id TEXT NOT NULL,
          name TEXT NOT NULL,
          role_type TEXT NOT NULL,
          personality TEXT NOT NULL,
          speech_style TEXT,
          appearance TEXT,
          abilities TEXT,
          background TEXT,
          relationships TEXT,
          first_appear INTEGER,
          is_active INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (book_id, id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        );
      `,
    },
  ];

  db.transaction(() => {
    for (const table of tables) {
      if (!hasBookScopedIdPrimaryKey(db, table.tableName)) {
        recreateScopedIdTable(db, table);
      }
    }
  })();
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
  ensurePlotThreadsScopedPrimaryKey(db);
  ensureNarrativeGraphScopedPrimaryKeys(db);
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
