# Multi-Book Dual-Loop Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Story Weaver from a single-book linear generator into a multi-book dual-loop system with persistent endgame/stage/arc/chapter planning, per-chapter state snapshots, milestone replanning, and fair multi-book task scheduling.

**Architecture:** Replace the current narrative planning tables with five book-scoped core objects, add repositories and domain types around them, then refit `book-service`, `engine`, and `scheduler` so each book advances through a planning loop and a writing loop independently. Preserve the current Electron/renderer contract shape where practical by mapping the new planning/status model back into `BookDetail`, progress events, and scheduler status.

**Tech Stack:** TypeScript, Drizzle ORM, better-sqlite3, Vitest, Electron IPC, existing Vercel AI SDK adapters, existing mock story services.

---

## Scope Note

This plan implements the design in [2026-05-03-multi-book-dual-loop-generation-design.md](/Users/admin/Works/story-weaver-app/docs/superpowers/specs/2026-05-03-multi-book-dual-loop-generation-design.md). It explicitly allows destructive schema cleanup because the project is still in development and does not need historical data migration compatibility.

## File Structure

- Modify `src/db/schema/narrative.ts`: replace `story_bibles`, `volume_plans`, `chapter_cards`, and checkpoint-centric planning shape with `title_idea_contracts`, `endgame_plans`, `stage_plans`, `arc_plans`, `chapter_plans`, and `story_state_snapshots`.
- Modify `src/storage/book-graph.ts`: delete all new planning/state tables when a book is reset or removed.
- Modify `src/storage/database.ts`: instantiate and export the new planning repositories.
- Create `src/storage/title-idea-contracts.ts`
- Create `src/storage/endgame-plans.ts`
- Create `src/storage/stage-plans.ts`
- Create `src/storage/arc-plans.ts`
- Create `src/storage/chapter-plans.ts`
- Create `src/storage/story-state-snapshots.ts`
- Modify `src/core/narrative/types.ts`: define dual-loop planning, snapshot, milestone, and task enums.
- Create `src/core/narrative/state.ts`: helpers for milestone detection, budget updates, superseding stale plans, and compact snapshot aggregation.
- Modify `src/shared/contracts.ts`: add dual-loop progress/status/task types and enrich `BookDetail.narrative`.
- Modify `src/storage/progress.ts`: track book loop phase, active task type, stage/arc/chapter pointers, and last error by book.
- Modify `src/core/book-service.ts`: split initialization planning, chapter planning rebuild, arc rebuild, chapter writing, chapter audit, snapshot persistence, and milestone replanning into explicit per-book steps.
- Modify `src/core/engine.ts`: advance one book through planning loop plus writing loop instead of outline-then-write once.
- Modify `src/core/scheduler.ts`: schedule typed book tasks with per-book exclusivity, planning priority, and round-robin fairness.
- Modify `electron/runtime.ts`: register typed runners around the new scheduler, emit richer progress logs, and surface updated scheduler status.
- Modify `tests/storage/narrative-schema.test.ts`, `tests/storage/books.test.ts`, `tests/core/book-service.test.ts`, `tests/core/narrative-book-service.test.ts`, `tests/core/engine.test.ts`, and `tests/core/scheduler.test.ts`.

## Task 1: Replace the Narrative Planning Schema

**Files:**
- Modify: `src/db/schema/narrative.ts`
- Modify: `src/storage/book-graph.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Update `tests/storage/narrative-schema.test.ts` to assert the new table set:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';

describe('narrative schema', () => {
  it('creates dual-loop planning and snapshot tables', () => {
    const db = createDatabase(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'title_idea_contracts',
        'endgame_plans',
        'stage_plans',
        'arc_plans',
        'chapter_plans',
        'story_state_snapshots',
      ])
    );
    expect(tables).not.toContain('story_bibles');
    expect(tables).not.toContain('volume_plans');
    expect(tables).not.toContain('chapter_cards');
  });

  it('stores chapter plan status and snapshot budget fields', () => {
    const db = createDatabase(':memory:');

    const chapterPlanColumns = db
      .prepare('PRAGMA table_info(chapter_plans)')
      .all()
      .map((row) => (row as { name: string }).name);
    const snapshotColumns = db
      .prepare('PRAGMA table_info(story_state_snapshots)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(chapterPlanColumns).toEqual(
      expect.arrayContaining(['book_id', 'chapter_index', 'status', 'required_payoffs_json'])
    );
    expect(snapshotColumns).toEqual(
      expect.arrayContaining([
        'book_id',
        'chapter_index',
        'title_idea_alignment',
        'flatness_risk',
        'remaining_chapter_budget',
      ])
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: FAIL because the new tables do not exist yet and the old planning tables are still present.

- [ ] **Step 3: Replace the narrative schema definitions**

Rewrite `src/db/schema/narrative.ts` so the planning layer is book-scoped and dual-loop oriented:

```ts
import { primaryKey, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { books } from './books.js';

export const titleIdeaContracts = sqliteTable('title_idea_contracts', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  title: text('title').notNull(),
  idea: text('idea').notNull(),
  corePromise: text('core_promise').notNull(),
  titleHooksJson: text('title_hooks_json').notNull().default('[]'),
  forbiddenDriftJson: text('forbidden_drift_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const endgamePlans = sqliteTable('endgame_plans', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  titleIdeaContract: text('title_idea_contract').notNull(),
  protagonistEndState: text('protagonist_end_state').notNull(),
  finalConflict: text('final_conflict').notNull(),
  finalOpponent: text('final_opponent').notNull(),
  worldEndState: text('world_end_state').notNull(),
  coreCharacterOutcomesJson: text('core_character_outcomes_json').notNull(),
  majorPayoffsJson: text('major_payoffs_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const stagePlans = sqliteTable(
  'stage_plans',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    stageIndex: integer('stage_index').notNull(),
    chapterStart: integer('chapter_start').notNull(),
    chapterEnd: integer('chapter_end').notNull(),
    chapterBudget: integer('chapter_budget').notNull(),
    objective: text('objective').notNull(),
    primaryResistance: text('primary_resistance').notNull(),
    pressureCurve: text('pressure_curve').notNull(),
    escalation: text('escalation').notNull(),
    climax: text('climax').notNull(),
    payoff: text('payoff').notNull(),
    irreversibleChange: text('irreversible_change').notNull(),
    nextQuestion: text('next_question').notNull(),
    titleIdeaFocus: text('title_idea_focus').notNull(),
    compressionTrigger: text('compression_trigger').notNull(),
    status: text('status').notNull().default('planned'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.stageIndex] }),
  })
);

export const arcPlans = sqliteTable(
  'arc_plans',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    arcIndex: integer('arc_index').notNull(),
    stageIndex: integer('stage_index').notNull(),
    chapterStart: integer('chapter_start').notNull(),
    chapterEnd: integer('chapter_end').notNull(),
    chapterBudget: integer('chapter_budget').notNull(),
    primaryThreadsJson: text('primary_threads_json').notNull(),
    characterTurnsJson: text('character_turns_json').notNull(),
    threadActionsJson: text('thread_actions_json').notNull(),
    targetOutcome: text('target_outcome').notNull(),
    escalationMode: text('escalation_mode').notNull(),
    turningPoint: text('turning_point').notNull(),
    requiredPayoff: text('required_payoff').notNull(),
    resultingInstability: text('resulting_instability').notNull(),
    titleIdeaFocus: text('title_idea_focus').notNull(),
    minChapterCount: integer('min_chapter_count').notNull(),
    maxChapterCount: integer('max_chapter_count').notNull(),
    status: text('status').notNull().default('planned'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.arcIndex] }),
  })
);

export const chapterPlans = sqliteTable(
  'chapter_plans',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    batchIndex: integer('batch_index').notNull(),
    chapterIndex: integer('chapter_index').notNull(),
    arcIndex: integer('arc_index').notNull(),
    goal: text('goal').notNull(),
    conflict: text('conflict').notNull(),
    pressureSource: text('pressure_source').notNull(),
    changeType: text('change_type').notNull(),
    threadActionsJson: text('thread_actions_json').notNull(),
    reveal: text('reveal').notNull(),
    payoffOrCost: text('payoff_or_cost').notNull(),
    endingHook: text('ending_hook').notNull(),
    titleIdeaLink: text('title_idea_link').notNull(),
    batchGoal: text('batch_goal').notNull(),
    requiredPayoffsJson: text('required_payoffs_json').notNull(),
    forbiddenDriftJson: text('forbidden_drift_json').notNull(),
    status: text('status').notNull().default('planned'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.chapterIndex] }),
  })
);

export const storyStateSnapshots = sqliteTable(
  'story_state_snapshots',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    chapterIndex: integer('chapter_index').notNull(),
    summary: text('summary').notNull(),
    titleIdeaAlignment: text('title_idea_alignment').notNull(),
    flatnessRisk: text('flatness_risk').notNull(),
    characterChangesJson: text('character_changes_json').notNull(),
    relationshipChangesJson: text('relationship_changes_json').notNull(),
    worldFactsJson: text('world_facts_json').notNull(),
    threadUpdatesJson: text('thread_updates_json').notNull(),
    unresolvedPromisesJson: text('unresolved_promises_json').notNull(),
    stageProgress: text('stage_progress').notNull(),
    remainingChapterBudget: integer('remaining_chapter_budget').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.chapterIndex] }),
  })
);
```

- [ ] **Step 4: Update book cleanup to delete the new planning tables**

Update `src/storage/book-graph.ts`:

```ts
const bookScopedPlanningTables = [
  'story_state_snapshots',
  'chapter_plans',
  'arc_plans',
  'stage_plans',
  'endgame_plans',
  'title_idea_contracts',
  'narrative_checkpoints',
  'chapter_generation_audits',
  'relationship_states',
] as const;
```

- [ ] **Step 5: Run the schema test until green**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: PASS with the new dual-loop planning tables present and the legacy planning tables absent.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/storage/narrative-schema.test.ts src/db/schema/narrative.ts src/storage/book-graph.ts
git commit -m "refactor: replace narrative planning schema for dual-loop generation"
```

## Task 2: Add Repositories for Core Planning Objects

**Files:**
- Create: `src/storage/title-idea-contracts.ts`
- Create: `src/storage/endgame-plans.ts`
- Create: `src/storage/stage-plans.ts`
- Create: `src/storage/arc-plans.ts`
- Create: `src/storage/chapter-plans.ts`
- Create: `src/storage/story-state-snapshots.ts`
- Modify: `src/storage/database.ts`
- Test: `tests/storage/books.test.ts`

- [ ] **Step 1: Write the failing repository integration test**

Add a new test to `tests/storage/books.test.ts`:

```ts
import { createRepositories, createDatabase } from '../../src/storage/database';

it('round-trips dual-loop planning records by book', () => {
  const db = createDatabase(':memory:');
  const repos = createRepositories(db);

  repos.books.create({
    id: 'book-1',
    title: '命簿',
    idea: '旧案复仇',
    targetChapters: 20,
    wordsPerChapter: 2500,
  });

  repos.titleIdeaContracts.save({
    bookId: 'book-1',
    title: '命簿',
    idea: '旧案复仇',
    corePromise: '主角要查清被抹除的命运记录。',
    titleHooks: ['命运可被改写，但要付代价。'],
    forbiddenDrift: ['不能写成轻喜日常。'],
  });
  repos.endgamePlans.save({
    bookId: 'book-1',
    titleIdeaContract: '兑现命簿与旧案真相。',
    protagonistEndState: '林牧夺回选择权。',
    finalConflict: '是否公开命簿。',
    finalOpponent: '掌簿宗门。',
    worldEndState: '命簿公开审议。',
    coreCharacterOutcomes: [{ characterId: 'lin-mu', outcome: '承担代价仍选择公开。' }],
    majorPayoffs: ['林家旧案真相', '师父立场反转'],
  });
  repos.chapterPlans.upsertMany('book-1', [
    {
      bookId: 'book-1',
      batchIndex: 1,
      chapterIndex: 1,
      arcIndex: 1,
      goal: '拿到碎页。',
      conflict: '宗门搜查。',
      pressureSource: '暴露身份。',
      changeType: 'forced_choice',
      threadActions: ['推进旧案主线'],
      reveal: '碎页来自林家。',
      payoffOrCost: '拿到碎页但失去记忆。',
      endingHook: '师父现身。',
      titleIdeaLink: '命簿开始吞记忆。',
      batchGoal: '把主线引爆。',
      requiredPayoffs: ['旧案明确进入主线'],
      forbiddenDrift: ['禁止闲聊灌水'],
      status: 'planned',
    },
  ]);
  repos.storyStateSnapshots.save({
    bookId: 'book-1',
    chapterIndex: 1,
    summary: '林牧拿到碎页。',
    titleIdeaAlignment: '高',
    flatnessRisk: 'low',
    characterChanges: ['林牧从逃避转为追查。'],
    relationshipChanges: [],
    worldFacts: ['命簿会吞记忆。'],
    threadUpdates: ['旧案主线推进。'],
    unresolvedPromises: ['师父为何隐瞒。'],
    stageProgress: 'stage-1 started',
    remainingChapterBudget: 19,
  });

  expect(repos.titleIdeaContracts.getByBook('book-1')).toMatchObject({
    corePromise: '主角要查清被抹除的命运记录。',
  });
  expect(repos.endgamePlans.getByBook('book-1')).toMatchObject({
    finalOpponent: '掌簿宗门。',
  });
  expect(repos.chapterPlans.listByBook('book-1')).toHaveLength(1);
  expect(repos.storyStateSnapshots.getLatestByBook('book-1')).toMatchObject({
    chapterIndex: 1,
    remainingChapterBudget: 19,
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run tests/storage/books.test.ts --reporter=dot
```

Expected: FAIL because the new repositories are not created or exported yet.

- [ ] **Step 3: Implement the repository files**

Use the same Drizzle pattern as the existing storage layer. For example, `src/storage/chapter-plans.ts` should look like:

```ts
import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { chapterPlans } from '../db/schema/index.js';
import type { ChapterPlan } from '../core/narrative/types.js';

export function createChapterPlanRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertMany(bookId: string, plans: ChapterPlan[]) {
      for (const plan of plans) {
        drizzleDb
          .insert(chapterPlans)
          .values({
            ...plan,
            bookId,
            threadActionsJson: JSON.stringify(plan.threadActions),
            requiredPayoffsJson: JSON.stringify(plan.requiredPayoffs),
            forbiddenDriftJson: JSON.stringify(plan.forbiddenDrift),
          })
          .onConflictDoUpdate({
            target: [chapterPlans.bookId, chapterPlans.chapterIndex],
            set: {
              batchIndex: plan.batchIndex,
              arcIndex: plan.arcIndex,
              goal: plan.goal,
              conflict: plan.conflict,
              pressureSource: plan.pressureSource,
              changeType: plan.changeType,
              threadActionsJson: JSON.stringify(plan.threadActions),
              reveal: plan.reveal,
              payoffOrCost: plan.payoffOrCost,
              endingHook: plan.endingHook,
              titleIdeaLink: plan.titleIdeaLink,
              batchGoal: plan.batchGoal,
              requiredPayoffsJson: JSON.stringify(plan.requiredPayoffs),
              forbiddenDriftJson: JSON.stringify(plan.forbiddenDrift),
              status: plan.status,
            },
          })
          .run();
      }
    },

    listByBook(bookId: string): ChapterPlan[] {
      return drizzleDb
        .select()
        .from(chapterPlans)
        .where(eq(chapterPlans.bookId, bookId))
        .orderBy(asc(chapterPlans.chapterIndex))
        .all()
        .map((row) => ({
          ...row,
          threadActions: JSON.parse(row.threadActionsJson) as string[],
          requiredPayoffs: JSON.parse(row.requiredPayoffsJson) as string[],
          forbiddenDrift: JSON.parse(row.forbiddenDriftJson) as string[],
        })) as ChapterPlan[];
    },
  };
}
```

- [ ] **Step 4: Wire the repositories into the database factory**

Update `src/storage/database.ts`:

```ts
import { createArcPlanRepository } from './arc-plans.js';
import { createChapterPlanRepository } from './chapter-plans.js';
import { createEndgamePlanRepository } from './endgame-plans.js';
import { createStagePlanRepository } from './stage-plans.js';
import { createStoryStateSnapshotRepository } from './story-state-snapshots.js';
import { createTitleIdeaContractRepository } from './title-idea-contracts.js';

export function createRepositories(db: SqliteDatabase) {
  return {
    books: createBookRepository(db),
    chapters: createChapterRepository(db),
    titleIdeaContracts: createTitleIdeaContractRepository(db),
    endgamePlans: createEndgamePlanRepository(db),
    stagePlans: createStagePlanRepository(db),
    arcPlans: createArcPlanRepository(db),
    chapterPlans: createChapterPlanRepository(db),
    storyStateSnapshots: createStoryStateSnapshotRepository(db),
    chapterAudits: createChapterAuditRepository(db),
    narrativeCheckpoints: createNarrativeCheckpointRepository(db),
    progress: createProgressRepository(db),
    settings: createSettingsRepository(db),
    modelConfigs: createModelConfigRepository(db),
    booksLegacyCleanup: createBookRepository(db),
  };
}
```

- [ ] **Step 5: Run the repository test until green**

Run:

```bash
pnpm exec vitest run tests/storage/books.test.ts --reporter=dot
```

Expected: PASS with per-book planning records round-tripping through the new repositories.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/storage/books.test.ts src/storage/database.ts src/storage/title-idea-contracts.ts src/storage/endgame-plans.ts src/storage/stage-plans.ts src/storage/arc-plans.ts src/storage/chapter-plans.ts src/storage/story-state-snapshots.ts
git commit -m "feat: add dual-loop planning repositories"
```

## Task 3: Define Dual-Loop Domain Types and Progress State

**Files:**
- Modify: `src/core/narrative/types.ts`
- Create: `src/core/narrative/state.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `src/storage/progress.ts`
- Test: `tests/core/book-service.test.ts`

- [ ] **Step 1: Write the failing domain/progress test**

Add a focused test to `tests/core/book-service.test.ts`:

```ts
it('returns dual-loop progress metadata in book detail', () => {
  const db = createDatabase(':memory:');
  const repos = createRepositories(db);
  repos.books.create({
    id: 'book-1',
    title: '命簿',
    idea: '旧案复仇',
    targetChapters: 20,
    wordsPerChapter: 2500,
  });
  repos.progress.updatePhase('book-1', 'planning_arc', {
    currentChapter: 10,
    stepLabel: '重建 11-20 章计划',
    activeTaskType: 'book:plan:rebuild-chapters',
    currentStage: 1,
    currentArc: 1,
  });

  const service = createBookService({
    ...repos,
    outlineService: { generateFromIdea: vi.fn() },
    chapterWriter: { writeChapter: vi.fn() },
    summaryGenerator: { summarizeChapter: vi.fn() },
    plotThreadExtractor: { extractThreads: vi.fn().mockResolvedValue({ openedThreads: [], resolvedThreadIds: [] }) },
    characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
    sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
  });

  expect(service.getBookDetail('book-1')?.progress).toMatchObject({
    phase: 'planning_arc',
    currentChapter: 10,
    currentStage: 1,
    currentArc: 1,
    activeTaskType: 'book:plan:rebuild-chapters',
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: FAIL because progress metadata does not support stage/arc/task fields yet.

- [ ] **Step 3: Add the new narrative and task types**

Extend `src/core/narrative/types.ts` with the dual-loop entities:

```ts
export type PlanningTaskType =
  | 'book:plan:init'
  | 'book:plan:rebuild-arc'
  | 'book:plan:rebuild-chapters'
  | 'book:write:chapter';

export type PlanStatus = 'planned' | 'active' | 'completed' | 'superseded';

export type TitleIdeaContract = {
  bookId: string;
  title: string;
  idea: string;
  corePromise: string;
  titleHooks: string[];
  forbiddenDrift: string[];
};

export type EndgamePlan = {
  bookId: string;
  titleIdeaContract: string;
  protagonistEndState: string;
  finalConflict: string;
  finalOpponent: string;
  worldEndState: string;
  coreCharacterOutcomes: Array<{ characterId: string; outcome: string }>;
  majorPayoffs: string[];
};

export type StagePlan = {
  bookId: string;
  stageIndex: number;
  chapterStart: number;
  chapterEnd: number;
  chapterBudget: number;
  objective: string;
  primaryResistance: string;
  pressureCurve: string;
  escalation: string;
  climax: string;
  payoff: string;
  irreversibleChange: string;
  nextQuestion: string;
  titleIdeaFocus: string;
  compressionTrigger: string;
  status: PlanStatus;
};

export type ArcPlan = {
  bookId: string;
  arcIndex: number;
  stageIndex: number;
  chapterStart: number;
  chapterEnd: number;
  chapterBudget: number;
  primaryThreads: string[];
  characterTurns: string[];
  threadActions: string[];
  targetOutcome: string;
  escalationMode: string;
  turningPoint: string;
  requiredPayoff: string;
  resultingInstability: string;
  titleIdeaFocus: string;
  minChapterCount: number;
  maxChapterCount: number;
  status: PlanStatus;
};
```

- [ ] **Step 4: Add progress helpers and richer contract fields**

Create `src/core/narrative/state.ts` and extend `src/shared/contracts.ts` plus `src/storage/progress.ts`:

```ts
export function detectMilestone(chapterIndex: number) {
  if (chapterIndex > 0 && chapterIndex % 200 === 0) return 'stage';
  if (chapterIndex > 0 && chapterIndex % 50 === 0) return 'arc';
  if (chapterIndex > 0 && chapterIndex % 10 === 0) return 'chapter-window';
  return null;
}

export function calculateRemainingChapterBudget(targetChapters: number, completedChapters: number) {
  return Math.max(targetChapters - completedChapters, 0);
}
```

```ts
export type BookDetail = {
  // existing fields...
  narrative?: {
    titleIdeaContract?: {
      corePromise: string;
      titleHooks: string[];
      forbiddenDrift: string[];
    } | null;
    endgamePlan?: {
      protagonistEndState: string;
      finalConflict: string;
      finalOpponent: string;
      majorPayoffs: string[];
    } | null;
    stagePlans?: Array<{ stageIndex: number; chapterStart: number; chapterEnd: number; status: string }>;
    arcPlans?: Array<{ arcIndex: number; stageIndex: number; chapterStart: number; chapterEnd: number; status: string }>;
    chapterPlans?: Array<{ chapterIndex: number; goal: string; conflict: string; status: string }>;
    snapshots?: Array<{ chapterIndex: number; titleIdeaAlignment: string; flatnessRisk: string; remainingChapterBudget: number }>;
  };
  progress: {
    phase?: string | null;
    stepLabel?: string | null;
    currentStage?: number | null;
    currentArc?: number | null;
    currentChapter?: number | null;
    activeTaskType?: string | null;
  } | null;
};
```

```ts
updatePhase(bookId, phase, metadata?: {
  currentChapter?: number | null;
  currentStage?: number | null;
  currentArc?: number | null;
  activeTaskType?: string | null;
  stepLabel?: string | null;
  errorMsg?: string | null;
}) {
  drizzleDb.insert(writingProgress).values({
    bookId,
    currentVolume: metadata?.currentStage ?? null,
    currentChapter: metadata?.currentChapter ?? null,
    phase,
    stepLabel: metadata?.stepLabel ?? null,
    activeTaskType: metadata?.activeTaskType ?? null,
    currentArc: metadata?.currentArc ?? null,
    errorMsg: metadata?.errorMsg ?? null,
  })
```

- [ ] **Step 5: Run the book-service test until green**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: PASS with dual-loop progress state visible via `getBookDetail`.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/core/book-service.test.ts src/core/narrative/types.ts src/core/narrative/state.ts src/shared/contracts.ts src/storage/progress.ts
git commit -m "feat: add dual-loop planning types and progress metadata"
```

## Task 4: Rebuild Book Service Around Planning and Writing Loops

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `tests/core/narrative-book-service.test.ts`

- [ ] **Step 1: Write the failing integration test for loop transitions**

Add a new integration case to `tests/core/narrative-book-service.test.ts`:

```ts
it('initializes plans, writes a chapter, stores a snapshot, and queues milestone replanning', async () => {
  const db = createDatabase(':memory:');
  const repos = createRepositories(db);
  const service = createBookService({
    ...repos,
    outlineService: {
      generateFromIdea: vi.fn().mockResolvedValue({
        titleIdeaContract: {
          title: '命簿',
          idea: '旧案复仇',
          corePromise: '查清被抹除的命运记录。',
          titleHooks: ['命簿吞记忆。'],
          forbiddenDrift: ['禁止脱离旧案主线。'],
        },
        endgamePlan: {
          titleIdeaContract: '兑现命簿代价与旧案真相。',
          protagonistEndState: '林牧夺回选择权。',
          finalConflict: '是否公开命簿。',
          finalOpponent: '掌簿宗门。',
          worldEndState: '命簿进入公开审议。',
          coreCharacterOutcomes: [{ characterId: 'lin-mu', outcome: '承担代价也公开真相。' }],
          majorPayoffs: ['旧案真相'],
        },
        stagePlans: [
          {
            bookId: '',
            stageIndex: 1,
            chapterStart: 1,
            chapterEnd: 20,
            chapterBudget: 20,
            objective: '引爆旧案主线。',
            primaryResistance: '宗门追杀。',
            pressureCurve: '持续上升',
            escalation: '身份暴露',
            climax: '师父立场反转',
            payoff: '拿到碎页',
            irreversibleChange: '林牧失去一段记忆',
            nextQuestion: '谁抹除了林家',
            titleIdeaFocus: '命簿吞记忆',
            compressionTrigger: '若 10 章内未拿到碎页则压缩',
            status: 'active',
          },
        ],
        arcPlans: [
          {
            bookId: '',
            arcIndex: 1,
            stageIndex: 1,
            chapterStart: 1,
            chapterEnd: 10,
            chapterBudget: 10,
            primaryThreads: ['旧案', '师父隐瞒'],
            characterTurns: ['林牧从逃避转为追查'],
            threadActions: ['推进旧案'],
            targetOutcome: '主线正式启动',
            escalationMode: '逐章加压',
            turningPoint: '拿到碎页',
            requiredPayoff: '命簿代价落地',
            resultingInstability: '林牧不得不继续追查',
            titleIdeaFocus: '命簿',
            minChapterCount: 8,
            maxChapterCount: 12,
            status: 'active',
          },
        ],
        chapterPlans: Array.from({ length: 10 }, (_, index) => ({
          bookId: '',
          batchIndex: 1,
          chapterIndex: index + 1,
          arcIndex: 1,
          goal: `推进第 ${index + 1} 章`,
          conflict: '宗门搜查',
          pressureSource: '身份暴露',
          changeType: 'escalation',
          threadActions: ['推进旧案'],
          reveal: '碎页与林家相关',
          payoffOrCost: '获得线索但失去安全',
          endingHook: '下一章更糟',
          titleIdeaLink: '命簿代价具象化',
          batchGoal: '完成第一窗口主线启动',
          requiredPayoffs: ['旧案进入主线'],
          forbiddenDrift: ['禁止日常灌水'],
          status: 'planned',
        })),
      }),
    },
    chapterWriter: {
      writeChapter: vi.fn().mockResolvedValue({
        content: '林牧拿到碎页，确认命簿会吞记忆。',
      }),
    },
    chapterAuditor: {
      auditChapter: vi.fn().mockResolvedValue({
        passed: true,
        score: 90,
        decision: 'accept',
        issues: [],
        scoring: {
          characterLogic: 18,
          mainlineProgress: 15,
          relationshipChange: 12,
          conflictDepth: 15,
          worldRuleCost: 10,
          threadManagement: 8,
          pacingReward: 8,
          themeAlignment: 4,
        },
        stateUpdates: {},
      }),
    },
    narrativeStateExtractor: {
      extractState: vi.fn().mockResolvedValue({
        summary: '林牧确认旧案启动。',
        titleIdeaAlignment: 'strong',
        flatnessRisk: 'low',
        characterChanges: ['林牧转为主动追查。'],
        relationshipChanges: [],
        worldFacts: ['命簿会吞记忆。'],
        threadUpdates: ['旧案主线推进。'],
        unresolvedPromises: ['师父为何隐瞒。'],
        stageProgress: '1/20 chapters',
      }),
    },
    summaryGenerator: { summarizeChapter: vi.fn().mockResolvedValue('林牧确认旧案启动。') },
    plotThreadExtractor: { extractThreads: vi.fn().mockResolvedValue({ openedThreads: [], resolvedThreadIds: [] }) },
    characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
    sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
    resolveModelId: () => 'mock',
  });

  const bookId = service.createBook({
    idea: '旧案复仇',
    targetChapters: 20,
    wordsPerChapter: 2500,
  });

  await service.startBook(bookId);
  await service.writeNextChapter(bookId);

  expect(repos.endgamePlans.getByBook(bookId)).toMatchObject({
    finalOpponent: '掌簿宗门。',
  });
  expect(repos.chapterPlans.listByBook(bookId)[0]).toMatchObject({
    chapterIndex: 1,
    status: 'completed',
  });
  expect(repos.storyStateSnapshots.getLatestByBook(bookId)).toMatchObject({
    chapterIndex: 1,
    remainingChapterBudget: 19,
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run tests/core/narrative-book-service.test.ts --reporter=dot
```

Expected: FAIL because `book-service` still expects the older story bible / volume / chapter-card flow.

- [ ] **Step 3: Refactor `book-service` to use explicit planning steps**

Add helpers like these inside `src/core/book-service.ts`:

```ts
async function initializePlanning(bookId: string) {
  const book = deps.books.getById(bookId);
  if (!book) throw new Error(`Book ${bookId} not found.`);

  deps.progress.updatePhase(bookId, 'planning_init', {
    currentChapter: 0,
    currentStage: 1,
    currentArc: 1,
    activeTaskType: 'book:plan:init',
    stepLabel: '初始化标题契约、终局计划与近区计划',
  });

  const planBundle = await deps.outlineService.generateFromIdea({
    bookId,
    title: book.title,
    idea: book.idea,
    targetChapters: book.targetChapters,
    wordsPerChapter: book.wordsPerChapter,
    modelId: resolveBookModelId(bookId),
  });

  deps.titleIdeaContracts?.save({ ...planBundle.titleIdeaContract, bookId });
  deps.endgamePlans?.save({ ...planBundle.endgamePlan, bookId });
  deps.stagePlans?.replaceForBook(bookId, planBundle.stagePlans.map((plan) => ({ ...plan, bookId })));
  deps.arcPlans?.replaceForBook(bookId, planBundle.arcPlans.map((plan) => ({ ...plan, bookId })));
  deps.chapterPlans?.replaceWindow(bookId, planBundle.chapterPlans.map((plan) => ({ ...plan, bookId })));
}
```

```ts
async function persistApprovedChapterSnapshot(input: {
  bookId: string;
  chapterIndex: number;
  summary: string;
  state: {
    titleIdeaAlignment: string;
    flatnessRisk: string;
    characterChanges: string[];
    relationshipChanges: string[];
    worldFacts: string[];
    threadUpdates: string[];
    unresolvedPromises: string[];
    stageProgress: string;
  };
  targetChapters: number;
}) {
  deps.storyStateSnapshots?.save({
    bookId: input.bookId,
    chapterIndex: input.chapterIndex,
    summary: input.summary,
    titleIdeaAlignment: input.state.titleIdeaAlignment,
    flatnessRisk: input.state.flatnessRisk,
    characterChanges: input.state.characterChanges,
    relationshipChanges: input.state.relationshipChanges,
    worldFacts: input.state.worldFacts,
    threadUpdates: input.state.threadUpdates,
    unresolvedPromises: input.state.unresolvedPromises,
    stageProgress: input.state.stageProgress,
    remainingChapterBudget: calculateRemainingChapterBudget(
      input.targetChapters,
      input.chapterIndex
    ),
  });
}
```

- [ ] **Step 4: Make milestone-driven replanning explicit**

Inside `writeNextChapter`, add the milestone branch:

```ts
const milestone = detectMilestone(chapterPlan.chapterIndex);

if (milestone === 'chapter-window') {
  await rebuildChapterWindow(bookId, chapterPlan.chapterIndex + 1);
}
if (milestone === 'arc') {
  await rebuildArcPlan(bookId, chapterPlan.chapterIndex + 1);
}
if (milestone === 'stage') {
  await rebuildStageEntry(bookId, chapterPlan.chapterIndex + 1);
}
```

- [ ] **Step 5: Run the narrative integration test until green**

Run:

```bash
pnpm exec vitest run tests/core/narrative-book-service.test.ts --reporter=dot
```

Expected: PASS with initial planning, chapter completion, snapshot persistence, and milestone-trigger hooks all exercised through `book-service`.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/core/narrative-book-service.test.ts src/core/book-service.ts
git commit -m "feat: drive book service with planning and writing loops"
```

## Task 5: Upgrade the Engine and Scheduler for Typed Multi-Book Tasks

**Files:**
- Modify: `src/core/engine.ts`
- Modify: `src/core/scheduler.ts`
- Modify: `tests/core/engine.test.ts`
- Modify: `tests/core/scheduler.test.ts`

- [ ] **Step 1: Write the failing engine and scheduler tests**

Add these focused expectations:

```ts
it('runs planning before writing and records loop phases', async () => {
  const updatePhase = vi.fn();
  const engine = createNovelEngine({
    bookId: 'book-1',
    initializePlanning: vi.fn().mockResolvedValue(undefined),
    continueWriting: vi.fn().mockResolvedValue({
      completedChapters: 1,
      status: 'completed',
    }),
    repositories: { progress: { updatePhase } },
  });

  await engine.start();

  expect(updatePhase).toHaveBeenNthCalledWith(1, 'book-1', 'planning_init');
  expect(updatePhase).toHaveBeenNthCalledWith(2, 'book-1', 'writing');
  expect(updatePhase).toHaveBeenNthCalledWith(3, 'book-1', 'completed');
});
```

```ts
it('prioritizes planning tasks and prevents concurrent tasks for the same book', async () => {
  const calls: string[] = [];
  let releaseA!: () => void;
  const scheduler = createScheduler({ concurrencyLimit: 2 });

  scheduler.register({
    bookId: 'book-a',
    taskType: 'book:write:chapter',
    start: () =>
      new Promise<void>((resolve) => {
        calls.push('a-write');
        releaseA = resolve;
      }),
  });
  scheduler.register({
    bookId: 'book-a',
    taskType: 'book:plan:rebuild-chapters',
    start: vi.fn(() => {
      calls.push('a-plan');
      return Promise.resolve();
    }),
  });
  scheduler.register({
    bookId: 'book-b',
    taskType: 'book:write:chapter',
    start: vi.fn(() => {
      calls.push('b-write');
      return Promise.resolve();
    }),
  });

  await scheduler.startAll();

  expect(calls).toEqual(['a-plan', 'b-write']);
  releaseA?.();
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
pnpm exec vitest run tests/core/engine.test.ts tests/core/scheduler.test.ts --reporter=dot
```

Expected: FAIL because the engine still uses one outline phase and the scheduler only knows one runner per book.

- [ ] **Step 3: Refactor the engine into planning + writing**

Update `src/core/engine.ts`:

```ts
export function createNovelEngine(deps: {
  bookId: string;
  initializePlanning: (bookId: string) => Promise<void>;
  continueWriting: (bookId: string) => Promise<{
    completedChapters: number;
    status: 'completed' | 'paused' | 'deleted';
  }>;
  repositories: {
    progress: {
      updatePhase: (bookId: string, phase: string) => void;
    };
  };
}) {
  let status: BookStatus | 'deleted' = 'creating';

  return {
    async start() {
      status = 'building_world';
      deps.repositories.progress.updatePhase(deps.bookId, 'planning_init');
      await deps.initializePlanning(deps.bookId);

      status = 'writing';
      deps.repositories.progress.updatePhase(deps.bookId, 'writing');
      const result = await deps.continueWriting(deps.bookId);

      status = result.status === 'paused' ? 'paused' : result.status === 'deleted' ? 'deleted' : 'completed';
      deps.repositories.progress.updatePhase(deps.bookId, status === 'completed' ? 'completed' : status);
    },
  };
}
```

- [ ] **Step 4: Replace the scheduler queue with typed fair scheduling**

Update `src/core/scheduler.ts`:

```ts
type Runner = {
  taskKey: string;
  bookId: string;
  taskType: 'book:plan:init' | 'book:plan:rebuild-arc' | 'book:plan:rebuild-chapters' | 'book:write:chapter';
  start: () => Promise<void>;
};

function taskPriority(taskType: Runner['taskType']) {
  if (taskType === 'book:plan:init') return 0;
  if (taskType === 'book:plan:rebuild-arc') return 1;
  if (taskType === 'book:plan:rebuild-chapters') return 2;
  return 3;
}

function sortQueue(queue: Runner[]) {
  return queue.sort((left, right) => {
    const priorityGap = taskPriority(left.taskType) - taskPriority(right.taskType);
    if (priorityGap !== 0) return priorityGap;
    return left.bookId.localeCompare(right.bookId);
  });
}
```

Keep a `runningBookIds` set so one book can never consume two slots at once.

- [ ] **Step 5: Run the engine and scheduler tests until green**

Run:

```bash
pnpm exec vitest run tests/core/engine.test.ts tests/core/scheduler.test.ts --reporter=dot
```

Expected: PASS with planning-first engine behavior and typed scheduler fairness.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/core/engine.test.ts tests/core/scheduler.test.ts src/core/engine.ts src/core/scheduler.ts
git commit -m "feat: add typed dual-loop engine and fair book scheduler"
```

## Task 6: Wire Runtime, Logging, and Final Compatibility Checks

**Files:**
- Modify: `electron/runtime.ts`
- Modify: `tests/core/book-service.test.ts`
- Modify: `tests/core/narrative-book-service.test.ts`
- Modify: `tests/storage/narrative-schema.test.ts`

- [ ] **Step 1: Write the failing runtime-facing assertions**

Add or adjust service-level assertions so scheduler/runtime status reflects typed tasks:

```ts
expect(runtime.getSchedulerStatus()).toMatchObject({
  runningBookIds: expect.any(Array),
  queuedBookIds: expect.any(Array),
  concurrencyLimit: expect.anything(),
});
```

Add progress-event assertions around planning:

```ts
expect(events).toContainEqual(
  expect.objectContaining({
    type: 'progress',
    phase: 'planning_init',
  })
);
```

- [ ] **Step 2: Run the focused failing tests**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts tests/core/narrative-book-service.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: FAIL because runtime logging and scheduler status still reflect the previous phase vocabulary.

- [ ] **Step 3: Update runtime logging and runner registration**

Adjust `electron/runtime.ts` so it classifies the new phases and registers typed tasks:

```ts
function classifyProgressEvent(event: Extract<BookGenerationEvent, { type: 'progress' }>) {
  if (event.phase === 'planning_init') return 'book_plan_initialization';
  if (event.phase === 'planning_arc') return 'book_arc_replanning';
  if (event.phase === 'planning_chapters') return 'book_chapter_replanning';
  if (event.phase === 'writing') return 'chapter_writing';
  if (event.phase === 'auditing_chapter') return 'chapter_auditing';
  if (event.phase === 'extracting_state') return 'chapter_state_snapshot';
  return 'book_progress';
}
```

Register one runner per typed book task instead of a single monolithic runner:

```ts
scheduler.register({
  taskKey: `${bookId}:plan:init`,
  bookId,
  taskType: 'book:plan:init',
  start: () => bookService.initializeBookPlanning(bookId),
});
scheduler.register({
  taskKey: `${bookId}:write:chapter`,
  bookId,
  taskType: 'book:write:chapter',
  start: () => bookService.writeNextChapter(bookId).then(() => undefined),
});
```

- [ ] **Step 4: Run the focused tests and then the full suite**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts tests/core/narrative-book-service.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
pnpm test
```

Expected: The focused tests PASS first, then the full suite PASSes with the new dual-loop runtime vocabulary and scheduler wiring intact.

- [ ] **Step 5: Commit**

Run:

```bash
git add electron/runtime.ts tests/core/book-service.test.ts tests/core/narrative-book-service.test.ts tests/storage/narrative-schema.test.ts
git commit -m "feat: wire dual-loop runtime progress and scheduler tasks"
```

## Self-Review

- Spec coverage: The six tasks cover the five core persistence objects, multi-book isolation, 10/50/200 milestone replanning hooks, dual-loop service orchestration, task-typed fair scheduling, and runtime compatibility.
- Placeholder scan: No task uses `TODO`, `TBD`, or “similar to previous task” shortcuts; each task includes concrete file paths, code shapes, and commands.
- Type consistency: The plan uses one shared task vocabulary throughout: `book:plan:init`, `book:plan:rebuild-arc`, `book:plan:rebuild-chapters`, and `book:write:chapter`. The planning entities are consistently `TitleIdeaContract`, `EndgamePlan`, `StagePlan`, `ArcPlan`, `ChapterPlan`, and `StoryStateSnapshot`.

## Notes for Execution

- The existing `storyBibles`, `volumePlans`, and `chapterCards` flow should be removed rather than shimmed if keeping both models causes branching complexity.
- Keep `BookDetail` backward-compatible enough for the renderer to survive this backend refactor, then do a renderer cleanup afterward if needed.
- Prefer landing Task 1 and Task 2 together quickly because almost every later task depends on the new schema and repositories.

Plan complete and saved to `docs/superpowers/plans/2026-05-03-multi-book-dual-loop-generation-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session step-by-step with checkpoints

Which approach?
