import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createSqliteConnection } from '../db/client.js';
import { runDrizzleMigrations } from '../db/migrate.js';
import { createBookRepository } from './books.js';
import { createChapterAuditRepository } from './chapter-audits.js';
import { createChapterCardRepository } from './chapter-cards.js';
import { createChapterPlanRepository } from './chapter-plans.js';
import { createChapterTensionBudgetRepository } from './chapter-tension-budgets.js';
import { createChapterRepository } from './chapters.js';
import { createArcPlanRepository } from './arc-plans.js';
import { createCharacterArcRepository } from './character-arcs.js';
import { createCharacterRepository } from './characters.js';
import { createEndgamePlanRepository } from './endgame-plans.js';
import { createModelConfigRepository } from './model-configs.js';
import { createNarrativeCheckpointRepository } from './narrative-checkpoints.js';
import { createNarrativeThreadRepository } from './narrative-threads.js';
import { createPlotThreadRepository } from './plot-threads.js';
import { createProgressRepository } from './progress.js';
import { createRelationshipEdgeRepository } from './relationship-edges.js';
import { createRelationshipStateRepository } from './relationship-states.js';
import { createSceneRecordRepository } from './scene-records.js';
import { createSettingsRepository } from './settings.js';
import { createStagePlanRepository } from './stage-plans.js';
import { createStoryBibleRepository } from './story-bibles.js';
import { createStoryStateSnapshotRepository } from './story-state-snapshots.js';
import { createTitleIdeaContractRepository } from './title-idea-contracts.js';
import { createVolumePlanRepository } from './volume-plans.js';
import { createWorldRuleRepository } from './world-rules.js';

export function runMigrations(db: SqliteDatabase) {
  runDrizzleMigrations(db);
}

export function createDatabase(filename: string) {
  const db = createSqliteConnection(filename);
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
    titleIdeaContracts: createTitleIdeaContractRepository(db),
    endgamePlans: createEndgamePlanRepository(db),
    stagePlans: createStagePlanRepository(db),
    arcPlans: createArcPlanRepository(db),
    chapterPlans: createChapterPlanRepository(db),
    storyStateSnapshots: createStoryStateSnapshotRepository(db),
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
