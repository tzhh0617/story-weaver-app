# Ultra-Longform Autopilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Story Weaver from a dual-loop longform generator into a multi-book ultra-longform autopilot with book contracts, run-scored scheduling, structured story ledgers, integrity-based drift handling, and checkpoint-backed recovery.

**Architecture:** Build on the existing dual-loop planning/storage layer instead of replacing it wholesale. First add the new runtime contract types and persistence for contracts, ledgers, events, checkpoints, and run state; then refit the book service and scheduler so chapter generation becomes `assemble -> draft -> extract -> audit -> patch -> commit`, with drift levels deciding whether to continue, rebuild the chapter window, or recover from a checkpoint.

**Tech Stack:** TypeScript, Drizzle ORM, better-sqlite3, Vitest, Electron IPC, existing Vercel AI SDK model adapters, existing narrative planning repositories.

---

## Scope Note

This plan implements [2026-05-03-ultra-longform-autopilot-design.md](/Users/admin/Works/story-weaver-app/docs/superpowers/specs/2026-05-03-ultra-longform-autopilot-design.md) on top of the already-landed dual-loop work in [2026-05-03-multi-book-dual-loop-generation-design.md](/Users/admin/Works/story-weaver-app/docs/superpowers/specs/2026-05-03-multi-book-dual-loop-generation-design.md). It intentionally keeps the initial rollout incremental:

- Phase 1 introduces the new control-plane data and state machine.
- Phase 2 makes chapter generation integrity-gated.
- Phase 3 upgrades multi-book scheduling and observability.
- Phase 4 adds template-specific rubric support and recovery polish.

## File Structure

- Modify `src/db/schema/narrative.ts`: add `book_contracts`, `story_ledgers`, `story_events`, and `story_checkpoints` tables, plus richer fields on planning state where needed.
- Modify `src/db/schema/ops.ts`: extend `writing_progress` to store run-state fields such as drift level, cooldown, and starvation score.
- Modify `src/db/schema/index.ts`: export the new schema tables.
- Create `src/storage/book-contracts.ts`: persist and read the highest-level anti-drift contract.
- Create `src/storage/story-ledgers.ts`: persist per-chapter runtime ledger snapshots.
- Create `src/storage/story-events.ts`: persist compact per-chapter event logs.
- Create `src/storage/story-checkpoints.ts`: persist light and heavy checkpoints for recovery.
- Modify `src/storage/story-state-snapshots.ts`: keep compatibility with existing snapshot reads while delegating new runtime decisions to `story_ledgers`.
- Modify `src/storage/progress.ts`: expose run-state updates and reads instead of only coarse phase strings.
- Modify `src/storage/book-graph.ts`: include the new runtime-control tables in reset/delete cleanup.
- Modify `src/storage/database.ts`: instantiate and export the new repositories.
- Modify `src/core/narrative/types.ts`: define `BookContract`, `StoryLedger`, `StoryEvent`, `Checkpoint`, `IntegrityReport`, `DriftLevel`, template ids, and run-score types.
- Modify `src/core/narrative/state.ts`: add helpers for drift thresholds, checkpoint cadence, starvation updates, and active-context assembly.
- Create `src/core/narrative/integrity.ts`: turn chapter audit output plus ledger/plan context into an `IntegrityReport`.
- Create `src/core/narrative/ledger.ts`: build/update ledgers and event logs from extracted chapter outcomes.
- Create `src/core/narrative/checkpoints.ts`: create light/heavy checkpoints and select recovery points.
- Create `src/core/narrative/templates.ts`: define first-pass template rubric presets for `progression`, `romance_growth`, and `mystery_serial`.
- Modify `src/shared/contracts.ts`: add API-safe contract, ledger, checkpoint, run-state, template, and scheduler status payloads.
- Modify `src/core/book-service.ts`: drive the new `assemble -> draft -> extract -> audit -> patch -> commit` chapter loop and expose explicit replan/recover steps.
- Modify `src/core/engine.ts`: choose the next work item from run state instead of only linear progress.
- Modify `src/core/scheduler.ts`: compute run scores, split write/repair/deep-replan queues, and preserve per-book exclusivity.
- Modify `tests/storage/narrative-schema.test.ts`, `tests/storage/database.test.ts`, `tests/core/book-service.test.ts`, `tests/core/engine.test.ts`, `tests/core/scheduler.test.ts`, `tests/core/narrative-audit-state-checkpoint.test.ts`, and add focused tests under `tests/storage/` and `tests/core/narrative/`.

## Task 1: Add the Autopilot Control-Plane Schema

**Files:**
- Modify: `src/db/schema/narrative.ts`
- Modify: `src/db/schema/ops.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/storage/book-graph.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [x] **Step 1: Write the failing schema test**

Replace `tests/storage/narrative-schema.test.ts` with assertions for the new control-plane tables and progress columns:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';

describe('narrative schema', () => {
  it('creates ultra-longform autopilot tables', () => {
    const db = createDatabase(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'book_contracts',
        'story_ledgers',
        'story_events',
        'story_checkpoints',
      ])
    );
  });

  it('stores run-state control fields on writing_progress', () => {
    const db = createDatabase(':memory:');
    const columns = db
      .prepare('PRAGMA table_info(writing_progress)')
      .all()
      .map((row) => (row as { name: string }).name);

    expect(columns).toEqual(
      expect.arrayContaining([
        'drift_level',
        'last_healthy_checkpoint_chapter',
        'cooldown_until',
        'starvation_score',
      ])
    );
  });
});
```

- [x] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: FAIL because the new tables and columns are not defined yet.

- [x] **Step 3: Add the new narrative control-plane tables**

Extend `src/db/schema/narrative.ts` with the new runtime tables:

```ts
export const bookContracts = sqliteTable('book_contracts', {
  bookId: text('book_id')
    .primaryKey()
    .references(() => books.id),
  titlePromise: text('title_promise').notNull(),
  corePremise: text('core_premise').notNull(),
  mainlinePromise: text('mainline_promise').notNull(),
  protagonistCoreDesire: text('protagonist_core_desire').notNull(),
  protagonistNoDriftRulesJson: text('protagonist_no_drift_rules_json').notNull(),
  keyCharacterBoundariesJson: text('key_character_boundaries_json').notNull(),
  mandatoryPayoffsJson: text('mandatory_payoffs_json').notNull(),
  antiDriftRulesJson: text('anti_drift_rules_json').notNull(),
  activeTemplate: text('active_template').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const storyLedgers = sqliteTable(
  'story_ledgers',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    chapterIndex: integer('chapter_index').notNull(),
    mainlineProgress: text('mainline_progress').notNull(),
    activeSubplotsJson: text('active_subplots_json').notNull(),
    openPromisesJson: text('open_promises_json').notNull(),
    characterTruthsJson: text('character_truths_json').notNull(),
    relationshipDeltasJson: text('relationship_deltas_json').notNull(),
    worldFactsJson: text('world_facts_json').notNull(),
    rhythmPosition: text('rhythm_position').notNull(),
    riskFlagsJson: text('risk_flags_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.chapterIndex] }),
  })
);

export const storyEvents = sqliteTable(
  'story_events',
  {
    id: text('id').primaryKey(),
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    chapterIndex: integer('chapter_index').notNull(),
    eventType: text('event_type').notNull(),
    summary: text('summary').notNull(),
    affectedIdsJson: text('affected_ids_json').notNull(),
    irreversible: integer('irreversible', { mode: 'boolean' }).notNull(),
    createdAt: text('created_at').notNull(),
  }
);

export const storyCheckpoints = sqliteTable(
  'story_checkpoints',
  {
    bookId: text('book_id')
      .notNull()
      .references(() => books.id),
    chapterIndex: integer('chapter_index').notNull(),
    checkpointType: text('checkpoint_type').notNull(),
    contractDigest: text('contract_digest').notNull(),
    planDigest: text('plan_digest').notNull(),
    ledgerDigestJson: text('ledger_digest_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.bookId, table.chapterIndex, table.checkpointType] }),
  })
);
```

- [x] **Step 4: Extend writing progress schema for run-state fields**

Update `src/db/schema/ops.ts` so `writing_progress` can persist the runtime control state:

```ts
driftLevel: text('drift_level').notNull().default('none'),
lastHealthyCheckpointChapter: integer('last_healthy_checkpoint_chapter'),
cooldownUntil: text('cooldown_until'),
starvationScore: integer('starvation_score').notNull().default(0),
```

- [x] **Step 5: Export and clean up the new tables**

Make sure `src/db/schema/index.ts` exports the new symbols and `src/storage/book-graph.ts` deletes rows from:

```ts
bookContracts,
storyLedgers,
storyEvents,
storyCheckpoints,
```

before removing a book.

- [x] **Step 6: Run the schema test again**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: PASS with both schema assertions green.

- [x] **Step 7: Commit the schema task**

Run:

```bash
git add src/db/schema/narrative.ts src/db/schema/ops.ts src/db/schema/index.ts src/storage/book-graph.ts tests/storage/narrative-schema.test.ts
git commit -m "feat: add autopilot control plane schema"
```

## Task 2: Add Repositories for Contracts, Ledgers, Events, and Checkpoints

**Files:**
- Create: `src/storage/book-contracts.ts`
- Create: `src/storage/story-ledgers.ts`
- Create: `src/storage/story-events.ts`
- Create: `src/storage/story-checkpoints.ts`
- Modify: `src/storage/database.ts`
- Modify: `tests/storage/database.test.ts`
- Test: `tests/storage/database.test.ts`

- [x] **Step 1: Write the failing repository wiring test**

Add a repository smoke test to `tests/storage/database.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabase, createRepositories } from '../../src/storage/database';

describe('createRepositories', () => {
  it('exposes autopilot repositories', () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);

    expect(repos.bookContracts).toBeTruthy();
    expect(repos.storyLedgers).toBeTruthy();
    expect(repos.storyEvents).toBeTruthy();
    expect(repos.storyCheckpoints).toBeTruthy();
  });
});
```

- [x] **Step 2: Run the repository test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts --reporter=dot
```

Expected: FAIL because `createRepositories` does not expose the new repositories yet.

- [x] **Step 3: Implement the book contract repository**

Create `src/storage/book-contracts.ts`:

```ts
import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { bookContracts } from '../db/schema/index.js';
import type { BookContract } from '../core/narrative/types.js';

export function createBookContractRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: BookContract) {
      const now = new Date().toISOString();
      drizzleDb
        .insert(bookContracts)
        .values({
          bookId: input.bookId,
          titlePromise: input.titlePromise,
          corePremise: input.corePremise,
          mainlinePromise: input.mainlinePromise,
          protagonistCoreDesire: input.protagonistCoreDesire,
          protagonistNoDriftRulesJson: JSON.stringify(input.protagonistNoDriftRules),
          keyCharacterBoundariesJson: JSON.stringify(input.keyCharacterBoundaries),
          mandatoryPayoffsJson: JSON.stringify(input.mandatoryPayoffs),
          antiDriftRulesJson: JSON.stringify(input.antiDriftRules),
          activeTemplate: input.activeTemplate,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: bookContracts.bookId,
          set: {
            titlePromise: input.titlePromise,
            corePremise: input.corePremise,
            mainlinePromise: input.mainlinePromise,
            protagonistCoreDesire: input.protagonistCoreDesire,
            protagonistNoDriftRulesJson: JSON.stringify(input.protagonistNoDriftRules),
            keyCharacterBoundariesJson: JSON.stringify(input.keyCharacterBoundaries),
            mandatoryPayoffsJson: JSON.stringify(input.mandatoryPayoffs),
            antiDriftRulesJson: JSON.stringify(input.antiDriftRules),
            activeTemplate: input.activeTemplate,
            updatedAt: now,
          },
        })
        .run();
    },

    getByBook(bookId: string): BookContract | null {
      const row = drizzleDb
        .select()
        .from(bookContracts)
        .where(eq(bookContracts.bookId, bookId))
        .get();

      if (!row) return null;

      return {
        bookId: row.bookId,
        titlePromise: row.titlePromise,
        corePremise: row.corePremise,
        mainlinePromise: row.mainlinePromise,
        protagonistCoreDesire: row.protagonistCoreDesire,
        protagonistNoDriftRules: JSON.parse(row.protagonistNoDriftRulesJson) as string[],
        keyCharacterBoundaries: JSON.parse(row.keyCharacterBoundariesJson) as BookContract['keyCharacterBoundaries'],
        mandatoryPayoffs: JSON.parse(row.mandatoryPayoffsJson) as string[],
        antiDriftRules: JSON.parse(row.antiDriftRulesJson) as string[],
        activeTemplate: row.activeTemplate as BookContract['activeTemplate'],
      };
    },
  };
}
```

- [x] **Step 4: Implement the ledger, event, and checkpoint repositories**

Create lean JSON-backed repositories similar to the existing storage style:

```ts
// src/storage/story-ledgers.ts
export function createStoryLedgerRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: StoryLedger) {
      drizzleDb.insert(storyLedgers).values({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
        mainlineProgress: input.mainlineProgress,
        activeSubplotsJson: JSON.stringify(input.activeSubplots),
        openPromisesJson: JSON.stringify(input.openPromises),
        characterTruthsJson: JSON.stringify(input.characterTruths),
        relationshipDeltasJson: JSON.stringify(input.relationshipDeltas),
        worldFactsJson: JSON.stringify(input.worldFacts),
        rhythmPosition: input.rhythmPosition,
        riskFlagsJson: JSON.stringify(input.riskFlags),
        createdAt: new Date().toISOString(),
      }).onConflictDoUpdate({
        target: [storyLedgers.bookId, storyLedgers.chapterIndex],
        set: {
          mainlineProgress: input.mainlineProgress,
          activeSubplotsJson: JSON.stringify(input.activeSubplots),
          openPromisesJson: JSON.stringify(input.openPromises),
          characterTruthsJson: JSON.stringify(input.characterTruths),
          relationshipDeltasJson: JSON.stringify(input.relationshipDeltas),
          worldFactsJson: JSON.stringify(input.worldFacts),
          rhythmPosition: input.rhythmPosition,
          riskFlagsJson: JSON.stringify(input.riskFlags),
          createdAt: new Date().toISOString(),
        },
      }).run();
    },
  };
}
```

```ts
// src/storage/story-events.ts
export function createStoryEventRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    appendMany(events: StoryEvent[]) {
      for (const event of events) {
        drizzleDb.insert(storyEvents).values({
          id: event.id,
          bookId: event.bookId,
          chapterIndex: event.chapterIndex,
          eventType: event.eventType,
          summary: event.summary,
          affectedIdsJson: JSON.stringify(event.affectedIds),
          irreversible: event.irreversible,
          createdAt: new Date().toISOString(),
        }).run();
      }
    },
  };
}
```

```ts
// src/storage/story-checkpoints.ts
export function createStoryCheckpointRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    save(input: Checkpoint) {
      drizzleDb.insert(storyCheckpoints).values({
        bookId: input.bookId,
        chapterIndex: input.chapterIndex,
        checkpointType: input.checkpointType,
        contractDigest: input.contractDigest,
        planDigest: input.planDigest,
        ledgerDigestJson: JSON.stringify(input.ledgerDigest),
        createdAt: input.createdAt,
      }).run();
    },
  };
}
```

- [x] **Step 5: Wire the repositories into `createRepositories`**

Update `src/storage/database.ts`:

```ts
import { createBookContractRepository } from './book-contracts.js';
import { createStoryLedgerRepository } from './story-ledgers.js';
import { createStoryEventRepository } from './story-events.js';
import { createStoryCheckpointRepository } from './story-checkpoints.js';

// ...

return {
  // existing repos...
  bookContracts: createBookContractRepository(db),
  storyLedgers: createStoryLedgerRepository(db),
  storyEvents: createStoryEventRepository(db),
  storyCheckpoints: createStoryCheckpointRepository(db),
};
```

- [x] **Step 6: Run the repository wiring test again**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts --reporter=dot
```

Expected: PASS with the new repository exposures available.

- [x] **Step 7: Commit the repository task**

Run:

```bash
git add src/storage/book-contracts.ts src/storage/story-ledgers.ts src/storage/story-events.ts src/storage/story-checkpoints.ts src/storage/database.ts tests/storage/database.test.ts
git commit -m "feat: add autopilot runtime repositories"
```

## Task 3: Define the New Runtime Types and Template Presets

**Files:**
- Modify: `src/core/narrative/types.ts`
- Create: `src/core/narrative/templates.ts`
- Modify: `src/shared/contracts.ts`
- Test: `tests/core/ipc-contracts.test.ts`

- [x] **Step 1: Write the failing contract-shape test**

Add a serialization-focused test to `tests/core/ipc-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { BookDetail } from '../../src/shared/contracts';

describe('BookDetail narrative payload', () => {
  it('supports autopilot runtime objects', () => {
    const detail: BookDetail = {
      book: {} as BookDetail['book'],
      context: null,
      narrative: {
        bookContract: {
          bookId: 'book-1',
          titlePromise: 'A city remembers every promise',
          corePremise: 'The city tracks vows as debt.',
          mainlinePromise: 'The protagonist must repay a public oath.',
          protagonistCoreDesire: 'Protect her brother',
          protagonistNoDriftRules: ['Never abandon family for power'],
          keyCharacterBoundaries: [],
          mandatoryPayoffs: ['Reveal the first broken civic oath'],
          antiDriftRules: ['Do not let slice-of-life outrun civic debt plot'],
          activeTemplate: 'progression',
        },
        latestLedger: null,
        latestCheckpoint: null,
      },
      latestScene: null,
      characterStates: [],
      plotThreads: [],
      chapters: [],
    };

    expect(detail.narrative?.bookContract?.activeTemplate).toBe('progression');
  });
});
```

- [x] **Step 2: Run the contract test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts --reporter=dot
```

Expected: FAIL because the new contract fields are not yet part of the shared types.

- [x] **Step 3: Add the runtime types to `src/core/narrative/types.ts`**

Append the new types without removing the existing narrative types yet:

```ts
export type StoryTemplateId = 'progression' | 'romance_growth' | 'mystery_serial';

export type DriftLevel = 'none' | 'light' | 'medium' | 'heavy';

export type BookContract = {
  bookId: string;
  titlePromise: string;
  corePremise: string;
  mainlinePromise: string;
  protagonistCoreDesire: string;
  protagonistNoDriftRules: string[];
  keyCharacterBoundaries: Array<{
    characterId: string;
    publicPersona: string;
    hiddenDrive: string;
    lineWillNotCross: string;
    lineMayEventuallyCross: string;
  }>;
  mandatoryPayoffs: string[];
  antiDriftRules: string[];
  activeTemplate: StoryTemplateId;
};

export type IntegrityReport = {
  mainlineAlignmentScore: number;
  characterStabilityScore: number;
  subplotControlScore: number;
  payoffProgressScore: number;
  rhythmFitScore: number;
  driftLevel: DriftLevel;
  repairAction:
    | 'continue'
    | 'patch_current_draft'
    | 'rewrite_current_chapter'
    | 'rebuild_chapter_window'
    | 'rollback_to_checkpoint';
  findings: string[];
};
```

- [x] **Step 4: Create the first-pass template preset module**

Create `src/core/narrative/templates.ts`:

```ts
import type { StoryTemplateId } from './types.js';

export type StoryTemplatePreset = {
  id: StoryTemplateId;
  displayName: string;
  subplotLimit: number;
  minorPayoffMaxGap: number;
  majorPayoffMaxGap: number;
  defaultRhythmPattern: string[];
  driftWarnings: string[];
};

export const STORY_TEMPLATE_PRESETS: Record<StoryTemplateId, StoryTemplatePreset> = {
  progression: {
    id: 'progression',
    displayName: 'Progression',
    subplotLimit: 4,
    minorPayoffMaxGap: 3,
    majorPayoffMaxGap: 10,
    defaultRhythmPattern: ['setup', 'escalation', 'payoff', 'cost'],
    driftWarnings: ['do_not_let_slice_of_life_replace_power_goal'],
  },
  romance_growth: {
    id: 'romance_growth',
    displayName: 'Romance Growth',
    subplotLimit: 3,
    minorPayoffMaxGap: 2,
    majorPayoffMaxGap: 8,
    defaultRhythmPattern: ['setup', 'tension', 'reveal', 'aftershock'],
    driftWarnings: ['do_not_skip_relationship_consequence'],
  },
  mystery_serial: {
    id: 'mystery_serial',
    displayName: 'Mystery Serial',
    subplotLimit: 5,
    minorPayoffMaxGap: 2,
    majorPayoffMaxGap: 6,
    defaultRhythmPattern: ['clue', 'misdirect', 'pressure', 'reveal'],
    driftWarnings: ['do_not_reveal_information_without_cost'],
  },
};
```

- [x] **Step 5: Expose the new API-safe shapes in `src/shared/contracts.ts`**

Extend `BookDetail['narrative']` and related payload types with:

```ts
bookContract?: BookContract | null;
latestLedger?: StoryLedger | null;
latestCheckpoint?: {
  bookId: string;
  chapterIndex: number;
  checkpointType: 'light' | 'heavy';
  createdAt: string;
} | null;
runState?: {
  phase: string;
  driftLevel: DriftLevel;
  starvationScore: number;
  lastHealthyCheckpointChapter: number | null;
} | null;
```

- [x] **Step 6: Run the contract test again**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts --reporter=dot
```

Expected: PASS with the new payload shape accepted by TypeScript.

- [x] **Step 7: Commit the types task**

Run:

```bash
git add src/core/narrative/types.ts src/core/narrative/templates.ts src/shared/contracts.ts tests/core/ipc-contracts.test.ts
git commit -m "feat: add autopilot runtime types"
```

## Task 4: Extend Progress Storage into Run State

**Files:**
- Modify: `src/storage/progress.ts`
- Modify: `tests/core/book-service.test.ts`
- Test: `tests/core/book-service.test.ts`

- [x] **Step 1: Write the failing run-state persistence test**

Add this focused assertion to `tests/core/book-service.test.ts` near the progress-related coverage:

```ts
it('persists autopilot drift and checkpoint progress state', () => {
  const db = createDatabase(':memory:');
  const progress = createProgressRepository(db);

  progress.updatePhase('book-1', 'writing', {
    currentChapter: 12,
    activeTaskType: 'book:write:chapter',
    driftLevel: 'light',
    lastHealthyCheckpointChapter: 10,
    cooldownUntil: '2026-05-03T12:00:00.000Z',
    starvationScore: 3,
  });

  expect(progress.getByBookId('book-1')).toMatchObject({
    phase: 'writing',
    currentChapter: 12,
    driftLevel: 'light',
    lastHealthyCheckpointChapter: 10,
    cooldownUntil: '2026-05-03T12:00:00.000Z',
    starvationScore: 3,
  });
});
```

- [x] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: FAIL because `createProgressRepository` does not accept or return the new fields yet.

- [x] **Step 3: Extend `updatePhase` metadata and read models**

Update `src/storage/progress.ts` so `updatePhase` accepts and persists:

```ts
driftLevel?: 'none' | 'light' | 'medium' | 'heavy';
lastHealthyCheckpointChapter?: number | null;
cooldownUntil?: string | null;
starvationScore?: number | null;
```

and returns those values in `getByBookId`.

- [x] **Step 4: Preserve sensible defaults in `reset`**

Update the `reset` branch so it writes:

```ts
driftLevel: 'none',
lastHealthyCheckpointChapter: null,
cooldownUntil: null,
starvationScore: 0,
```

instead of leaving these fields unset.

- [x] **Step 5: Run the progress persistence test again**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: PASS for the new progress-state assertion.

- [x] **Step 6: Commit the run-state storage task**

Run:

```bash
git add src/storage/progress.ts tests/core/book-service.test.ts
git commit -m "feat: persist autopilot run state"
```

## Task 5: Build Ledger, Event, and Checkpoint Domain Helpers

**Files:**
- Create: `src/core/narrative/ledger.ts`
- Create: `src/core/narrative/integrity.ts`
- Create: `src/core/narrative/checkpoints.ts`
- Modify: `src/core/narrative/state.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`

- [x] **Step 1: Write the failing narrative helper tests**

Add these focused tests to `tests/core/narrative-audit-state-checkpoint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildIntegrityReport } from '../../src/core/narrative/integrity';
import { shouldCreateCheckpoint } from '../../src/core/narrative/checkpoints';

describe('integrity report', () => {
  it('marks medium drift when mainline and payoff scores both sag', () => {
    const report = buildIntegrityReport({
      audit: {
        decision: 'revise',
        issues: [
          { type: 'mainline_stall', severity: 'major', message: 'Mainline did not move.' },
          { type: 'missing_payoff', severity: 'major', message: 'Promise debt grew.' },
        ],
        scoring: {},
      } as never,
      expectedRhythmPosition: 'payoff',
      activeSubplotDebt: 2,
    });

    expect(report.driftLevel).toBe('medium');
    expect(report.repairAction).toBe('rebuild_chapter_window');
  });
});

describe('checkpoint cadence', () => {
  it('creates light checkpoints every 10 chapters and heavy checkpoints every 50', () => {
    expect(shouldCreateCheckpoint(9)).toBe(null);
    expect(shouldCreateCheckpoint(10)).toBe('light');
    expect(shouldCreateCheckpoint(50)).toBe('heavy');
  });
});
```

- [x] **Step 2: Run the helper tests to confirm they fail**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts --reporter=dot
```

Expected: FAIL because the helper modules and functions do not exist yet.

- [x] **Step 3: Implement checkpoint cadence helpers**

Create `src/core/narrative/checkpoints.ts`:

```ts
import type { Checkpoint } from './types.js';

export function shouldCreateCheckpoint(chapterIndex: number): Checkpoint['checkpointType'] | null {
  if (chapterIndex > 0 && chapterIndex % 50 === 0) {
    return 'heavy';
  }
  if (chapterIndex > 0 && chapterIndex % 10 === 0) {
    return 'light';
  }
  return null;
}

export function pickRecoveryCheckpoint<T extends { chapterIndex: number; checkpointType: 'light' | 'heavy' }>(
  checkpoints: T[]
) {
  return [...checkpoints]
    .filter((checkpoint) => checkpoint.checkpointType === 'heavy')
    .sort((left, right) => right.chapterIndex - left.chapterIndex)[0] ?? null;
}
```

- [x] **Step 4: Implement the first-pass integrity report builder**

Create `src/core/narrative/integrity.ts`:

```ts
import type { IntegrityReport, NarrativeAudit } from './types.js';

export function buildIntegrityReport(input: {
  audit: NarrativeAudit;
  expectedRhythmPosition: string;
  activeSubplotDebt: number;
}): IntegrityReport {
  const issueTypes = new Set(input.audit.issues.map((issue) => issue.type));
  const hasMainlineStall = issueTypes.has('mainline_stall');
  const hasCharacterLogic = issueTypes.has('character_logic');
  const hasMissingPayoff = issueTypes.has('missing_payoff');
  const hasPacingProblem = issueTypes.has('pacing_problem') || issueTypes.has('flat_chapter');

  const driftLevel: IntegrityReport['driftLevel'] =
    hasCharacterLogic && hasMainlineStall
      ? 'heavy'
      : hasMainlineStall || hasMissingPayoff || input.activeSubplotDebt >= 2
      ? 'medium'
      : hasPacingProblem
      ? 'light'
      : 'none';

  return {
    mainlineAlignmentScore: hasMainlineStall ? 35 : 80,
    characterStabilityScore: hasCharacterLogic ? 40 : 85,
    subplotControlScore: input.activeSubplotDebt >= 2 ? 45 : 80,
    payoffProgressScore: hasMissingPayoff ? 35 : 82,
    rhythmFitScore: hasPacingProblem ? 50 : 84,
    driftLevel,
    repairAction:
      driftLevel === 'heavy'
        ? 'rollback_to_checkpoint'
        : driftLevel === 'medium'
        ? 'rebuild_chapter_window'
        : driftLevel === 'light'
        ? 'patch_current_draft'
        : 'continue',
    findings: input.audit.issues.map((issue) => issue.message),
  };
}
```

- [x] **Step 5: Implement ledger normalization helpers**

Create `src/core/narrative/ledger.ts` and extend `src/core/narrative/state.ts`:

```ts
// src/core/narrative/ledger.ts
import type { StoryEvent, StoryLedger } from './types.js';

export function buildStoryLedger(input: StoryLedger): StoryLedger {
  return {
    ...input,
    riskFlags: [...new Set(input.riskFlags)],
  };
}

export function buildStoryEvents(events: StoryEvent[]) {
  return events.map((event) => ({
    ...event,
    affectedIds: [...new Set(event.affectedIds)],
  }));
}
```

```ts
// src/core/narrative/state.ts
export function bumpStarvationScore(current: number, wasScheduled: boolean) {
  return wasScheduled ? 0 : current + 1;
}
```

- [x] **Step 6: Run the helper tests again**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts --reporter=dot
```

Expected: PASS for the new integrity and checkpoint tests.

- [x] **Step 7: Commit the helper task**

Run:

```bash
git add src/core/narrative/ledger.ts src/core/narrative/integrity.ts src/core/narrative/checkpoints.ts src/core/narrative/state.ts tests/core/narrative-audit-state-checkpoint.test.ts
git commit -m "feat: add autopilot integrity and checkpoint helpers"
```

## Task 6: Make Chapter Generation Integrity-Gated

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `tests/core/book-service.test.ts`
- Test: `tests/core/book-service.test.ts`

- [x] **Step 1: Write the failing chapter-loop test**

Add a focused behavior test to `tests/core/book-service.test.ts`:

```ts
it('rebuilds the chapter window instead of committing when drift becomes medium', async () => {
  const db = createDatabase(':memory:');
  const service = createBookService({
    // use the real repositories from createRepositories(db)
    // and stub chapter writer + audit-producing dependencies
  });

  const result = await service.runAutopilotChapterStep('book-1');

  expect(result).toMatchObject({
    action: 'rebuild_chapter_window',
    committed: false,
  });
});
```

Use the existing service factory style already present in this test file; the stubbed writer should return a draft that the audit path marks with `mainline_stall` and `missing_payoff`.

- [x] **Step 2: Run the test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: FAIL because `runAutopilotChapterStep` and integrity-gated branching do not exist.

- [x] **Step 3: Add an explicit autopilot chapter runner**

In `src/core/book-service.ts`, add a new method that follows the fixed loop:

```ts
async function runAutopilotChapterStep(bookId: string) {
  const chapterContext = await assembleAutopilotChapterContext(bookId);
  const draft = await deps.chapterWriter.writeChapter(chapterContext.prompt);
  const extracted = await extractChapterOutcome(bookId, draft, chapterContext);
  const integrity = buildIntegrityReport({
    audit: extracted.audit,
    expectedRhythmPosition: chapterContext.expectedRhythmPosition,
    activeSubplotDebt: chapterContext.activeSubplotDebt,
  });

  if (integrity.repairAction === 'rebuild_chapter_window') {
    deps.progress.updatePhase(bookId, 'replanning', {
      currentChapter: chapterContext.chapterIndex,
      activeTaskType: 'book:plan:rebuild-chapters',
      driftLevel: integrity.driftLevel,
    });
    return { action: 'rebuild_chapter_window', committed: false as const };
  }

  // continue with patch or commit in later steps
}
```

- [x] **Step 4: Only commit chapters after integrity acceptance**

Refactor the existing save path so all `chapters.saveContent`, `plotThreads.upsertThread`, `characters.saveState`, `sceneRecords.save`, and `storyStateSnapshots.save` calls sit behind one commit gate:

```ts
if (integrity.repairAction === 'continue' || integrity.repairAction === 'patch_current_draft') {
  commitAcceptedChapter({
    bookId,
    chapterIndex: chapterContext.chapterIndex,
    draft,
    extracted,
    integrity,
  });
}
```

Do not persist a draft when the action is `rebuild_chapter_window` or `rollback_to_checkpoint`.

- [x] **Step 5: Persist ledger, event, checkpoint, and run-state side effects on commit**

Inside the new commit helper, call the new repositories:

```ts
deps.storyLedgers.save(nextLedger);
deps.storyEvents.appendMany(nextEvents);

const checkpointType = shouldCreateCheckpoint(chapterContext.chapterIndex);
if (checkpointType) {
  deps.storyCheckpoints.save(buildCheckpointPayload(checkpointType, nextLedger, contract, planStack));
}

deps.progress.updatePhase(bookId, 'writing', {
  currentChapter: chapterContext.chapterIndex,
  activeTaskType: 'book:write:chapter',
  driftLevel: integrity.driftLevel,
  lastHealthyCheckpointChapter: checkpointType ? chapterContext.chapterIndex : progress.lastHealthyCheckpointChapter,
  starvationScore: 0,
});
```

- [x] **Step 6: Run the chapter-loop tests again**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: PASS, including the new behavior that medium drift does not commit a chapter.

- [x] **Step 7: Commit the chapter-loop task**

Run:

```bash
git add src/core/book-service.ts tests/core/book-service.test.ts
git commit -m "feat: gate chapter commits behind integrity checks"
```

## Task 7: Feed the New Runtime Data Through the Engine

**Files:**
- Modify: `src/core/engine.ts`
- Modify: `tests/core/engine.test.ts`
- Test: `tests/core/engine.test.ts`

- [x] **Step 1: Write the failing engine routing test**

Add a test to `tests/core/engine.test.ts`:

```ts
it('routes medium-drift books into replanning work instead of another write pass', async () => {
  const bookService = {
    listRunnableBooks: vi.fn(() => ['book-1']),
    getRunState: vi.fn(() => ({
      phase: 'writing',
      driftLevel: 'medium',
      currentChapter: 12,
    })),
    runAutopilotChapterStep: vi.fn(),
    rebuildChapterWindowPlan: vi.fn().mockResolvedValue(undefined),
  };

  const engine = createEngine({ bookService } as never);
  await engine.runBookStep('book-1');

  expect(bookService.rebuildChapterWindowPlan).toHaveBeenCalledWith('book-1');
  expect(bookService.runAutopilotChapterStep).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the engine test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/engine.test.ts --reporter=dot
```

Expected: FAIL because the engine only knows the older linear step progression.

- [x] **Step 3: Branch engine execution on run state**

Update `src/core/engine.ts` with a dispatcher like:

```ts
async function runBookStep(bookId: string) {
  const runState = deps.bookService.getRunState(bookId);

  if (!runState) return;

  if (runState.driftLevel === 'heavy') {
    await deps.bookService.recoverFromCheckpoint(bookId);
    return;
  }

  if (runState.driftLevel === 'medium') {
    await deps.bookService.rebuildChapterWindowPlan(bookId);
    return;
  }

  await deps.bookService.runAutopilotChapterStep(bookId);
}
```

- [x] **Step 4: Preserve the bootstrapping and planning-first flow**

Before the drift branches, keep the existing initialization ordering explicit:

```ts
if (runState.phase === 'bootstrapping') {
  await deps.bookService.initializeAutopilotBook(bookId);
  return;
}

if (runState.phase === 'planning_ready') {
  await deps.bookService.ensureChapterWindowPlan(bookId);
  return;
}
```

- [x] **Step 5: Run the engine tests again**

Run:

```bash
pnpm exec vitest run tests/core/engine.test.ts --reporter=dot
```

Expected: PASS, including the new medium-drift routing case.

- [x] **Step 6: Commit the engine task**

Run:

```bash
git add src/core/engine.ts tests/core/engine.test.ts
git commit -m "feat: route engine work by autopilot run state"
```

## Task 8: Upgrade the Scheduler to Run-Score Scheduling

**Files:**
- Modify: `src/core/scheduler.ts`
- Modify: `tests/core/scheduler.test.ts`
- Test: `tests/core/scheduler.test.ts`

- [x] **Step 1: Write the failing scheduler-priority test**

Add this test to `tests/core/scheduler.test.ts`:

```ts
it('prioritizes repair work ahead of normal writes while still preventing starvation', async () => {
  const events: string[] = [];
  const scheduler = createScheduler({ concurrencyLimit: 1 });

  scheduler.register({
    taskKey: 'repair-book:repair',
    bookId: 'repair-book',
    taskType: 'book:plan:rebuild-chapters',
    priority: { urgency: 8, health: 3, driftRisk: 9, starvationBoost: 0, cooldownPenalty: 0, noveltyBalance: 0 },
    start: vi.fn().mockImplementation(async () => {
      events.push('repair');
    }),
  });

  scheduler.register({
    taskKey: 'write-book:write',
    bookId: 'write-book',
    taskType: 'book:write:chapter',
    priority: { urgency: 7, health: 8, driftRisk: 1, starvationBoost: 4, cooldownPenalty: 0, noveltyBalance: 0 },
    start: vi.fn().mockImplementation(async () => {
      events.push('write');
    }),
  });

  await scheduler.startAll();
  expect(events[0]).toBe('repair');
});
```

- [x] **Step 2: Run the scheduler tests to confirm they fail**

Run:

```bash
pnpm exec vitest run tests/core/scheduler.test.ts --reporter=dot
```

Expected: FAIL because the current scheduler only knows planning-vs-writing sort order.

- [x] **Step 3: Extend runner metadata with an explicit run-score payload**

Update the runner type in `src/core/scheduler.ts`:

```ts
type Runner = {
  taskKey: string;
  bookId: string;
  taskType: SchedulerTaskType;
  priority?: {
    urgency: number;
    health: number;
    driftRisk: number;
    starvationBoost: number;
    cooldownPenalty: number;
    noveltyBalance: number;
  };
  start: () => Promise<void>;
};
```

- [x] **Step 4: Replace the queue sorter with a total-score comparator**

Swap the existing planning-first sorter with:

```ts
function totalPriorityScore(runner: Runner) {
  const priority = runner.priority ?? {
    urgency: 0,
    health: 0,
    driftRisk: 0,
    starvationBoost: 0,
    cooldownPenalty: 0,
    noveltyBalance: 0,
  };

  const repairBias = isPlanningTask(runner.taskType) ? 5 : 0;
  return (
    priority.urgency +
    priority.health +
    priority.driftRisk +
    priority.starvationBoost +
    priority.noveltyBalance +
    repairBias -
    priority.cooldownPenalty
  );
}

function sortQueue() {
  queue.sort((leftTaskKey, rightTaskKey) => {
    const leftRunner = runners.get(leftTaskKey);
    const rightRunner = runners.get(rightTaskKey);
    if (!leftRunner || !rightRunner) return 0;
    return totalPriorityScore(rightRunner) - totalPriorityScore(leftRunner);
  });
}
```

- [x] **Step 5: Preserve per-book exclusivity and add starvation-friendly status output**

Keep the existing `isBookRunning` guard, and extend `getStatus()` to expose queue order:

```ts
queuedTasks: queue.map((taskKey) => {
  const runner = runners.get(taskKey);
  return {
    taskKey,
    bookId: runner?.bookId ?? '',
    taskType: runner?.taskType ?? 'book:write:chapter',
  };
}),
```

This gives the UI a better debugging surface for fairness issues.

- [x] **Step 6: Run the scheduler tests again**

Run:

```bash
pnpm exec vitest run tests/core/scheduler.test.ts --reporter=dot
```

Expected: PASS, including the new repair-first priority assertion.

- [x] **Step 7: Commit the scheduler task**

Run:

```bash
git add src/core/scheduler.ts tests/core/scheduler.test.ts
git commit -m "feat: schedule books by autopilot run score"
```

## Task 9: Surface Contracts, Ledgers, and Run State in Book Detail

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `tests/core/book-service.test.ts`
- Test: `tests/core/book-service.test.ts`

- [x] **Step 1: Write the failing detail-shape test**

Add this test to `tests/core/book-service.test.ts`:

```ts
it('returns autopilot contract, ledger, and run state in book detail', () => {
  const db = createDatabase(':memory:');
  const repos = createRepositories(db);
  repos.books.create({
    id: 'book-1',
    title: 'City Oath',
    idea: 'A city remembers every promise.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });
  repos.bookContracts.save({
    bookId: 'book-1',
    titlePromise: 'Every promise becomes debt',
    corePremise: 'The city tracks vows as law.',
    mainlinePromise: 'Repay a fatal oath',
    protagonistCoreDesire: 'Save her brother',
    protagonistNoDriftRules: ['Do not choose status over kin'],
    keyCharacterBoundaries: [],
    mandatoryPayoffs: ['Expose the oath ledger'],
    antiDriftRules: ['No filler slice-of-life detours'],
    activeTemplate: 'progression',
  });

  const service = makeBookServiceFromRepositories(repos);
  expect(service.getBookDetail('book-1')?.narrative?.bookContract?.mainlinePromise).toBe(
    'Repay a fatal oath'
  );
});
```

Use the test helper pattern already present in the file for constructing the service from repositories.

- [x] **Step 2: Run the detail test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: FAIL because `getBookDetail` does not yet include the new repositories.

- [x] **Step 3: Thread the new repositories through `createBookService`**

Extend the service dependencies to accept:

```ts
bookContracts,
storyLedgers,
storyCheckpoints,
storyEvents,
```

and keep these dependencies optional only if existing tests require a staged migration path.

- [x] **Step 4: Extend `getBookDetail` to include runtime-control data**

Inside `getBookDetail`, add:

```ts
const bookContract = deps.bookContracts?.getByBook(bookId) ?? null;
const latestLedger = deps.storyLedgers?.getLatestByBook(bookId) ?? null;
const latestCheckpoint = deps.storyCheckpoints?.getLatestByBook(bookId) ?? null;
const runState = deps.progress.getByBookId(bookId) ?? null;
```

and return them under `detail.narrative`.

- [x] **Step 5: Run the detail tests again**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts --reporter=dot
```

Expected: PASS, including the new detail payload assertion.

- [x] **Step 6: Commit the detail-surface task**

Run:

```bash
git add src/core/book-service.ts src/shared/contracts.ts tests/core/book-service.test.ts
git commit -m "feat: expose autopilot runtime detail payloads"
```

## Task 10: Add Template-Aware Prompt Context and Recovery Hooks

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `src/core/prompt-builder.ts`
- Modify: `tests/core/narrative-context.test.ts`
- Test: `tests/core/narrative-context.test.ts`

- [x] **Step 1: Write the failing prompt-context test**

Add a template-aware context test to `tests/core/narrative-context.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildNarrativeDraftPrompt } from '../../src/core/prompt-builder';

describe('buildNarrativeDraftPrompt', () => {
  it('injects template-specific anti-drift guidance', () => {
    const prompt = buildNarrativeDraftPrompt({
      title: 'City Oath',
      idea: 'A city remembers every promise.',
      chapterOutline: 'The protagonist must publicly choose debt over safety.',
      extraContext: [
        'Template: progression',
        'Anti-drift: do_not_let_slice_of_life_replace_power_goal',
      ],
    } as never);

    expect(prompt).toContain('Template: progression');
    expect(prompt).toContain('Anti-drift: do_not_let_slice_of_life_replace_power_goal');
  });
});
```

- [x] **Step 2: Run the prompt-context test to confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/narrative-context.test.ts --reporter=dot
```

Expected: FAIL if the prompt builder currently drops the additional autopilot context lines.

- [x] **Step 3: Thread template rubric lines into chapter assembly**

In `src/core/book-service.ts`, when assembling the chapter prompt context, append template preset guidance:

```ts
const templatePreset = STORY_TEMPLATE_PRESETS[bookContract.activeTemplate];

const extraContext = [
  `Template: ${templatePreset.id}`,
  ...templatePreset.driftWarnings.map((warning) => `Anti-drift: ${warning}`),
  `Minor payoff max gap: ${templatePreset.minorPayoffMaxGap}`,
  `Major payoff max gap: ${templatePreset.majorPayoffMaxGap}`,
];
```

- [x] **Step 4: Preserve these lines in `buildNarrativeDraftPrompt`**

In `src/core/prompt-builder.ts`, ensure any `extraContext` input is rendered into the final prompt, for example:

```ts
if (input.extraContext?.length) {
  sections.push('Autopilot context:\n' + input.extraContext.join('\n'));
}
```

- [x] **Step 5: Run the context test again**

Run:

```bash
pnpm exec vitest run tests/core/narrative-context.test.ts --reporter=dot
```

Expected: PASS with the template-specific lines retained in the draft prompt.

- [x] **Step 6: Commit the template-context task**

Run:

```bash
git add src/core/book-service.ts src/core/prompt-builder.ts tests/core/narrative-context.test.ts
git commit -m "feat: inject template-aware autopilot prompt context"
```

## Task 11: Run Focused Regression Tests and Typecheck

**Files:**
- Modify: `docs/superpowers/plans/2026-05-03-ultra-longform-autopilot-implementation-plan.md`
- Test: `tests/storage/narrative-schema.test.ts`
- Test: `tests/storage/database.test.ts`
- Test: `tests/core/book-service.test.ts`
- Test: `tests/core/engine.test.ts`
- Test: `tests/core/scheduler.test.ts`
- Test: `tests/core/ipc-contracts.test.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`

- [x] **Step 1: Run the focused storage and runtime tests**

Run:

```bash
pnpm exec vitest run \
  tests/storage/narrative-schema.test.ts \
  tests/storage/database.test.ts \
  tests/core/book-service.test.ts \
  tests/core/engine.test.ts \
  tests/core/scheduler.test.ts \
  tests/core/ipc-contracts.test.ts \
  tests/core/narrative-audit-state-checkpoint.test.ts \
  --reporter=dot
```

Expected: PASS across all targeted autopilot tests.

- [x] **Step 2: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: PASS for the existing Vitest suite with no regressions.

- [x] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS for both renderer and Electron TypeScript projects.

- [x] **Step 4: Update the plan doc checkboxes as work completes**

When implementing, mark finished steps directly in this file:

```md
- [x] **Step N: ...**
```

This keeps the execution state local to the plan and visible to future workers.

- [x] **Step 5: Commit the verification pass**

Run:

```bash
git add docs/superpowers/plans/2026-05-03-ultra-longform-autopilot-implementation-plan.md
git commit -m "docs: track autopilot implementation progress"
```

## Self-Review

Spec coverage check:

- `Book Contract`, `Story Ledger`, `Story Event`, `Checkpoint`, `Run State` are implemented by Tasks 1-4 and surfaced in Task 9.
- `Integrity Check`, `Drift Levels`, `repair / rebuild / rollback` are implemented by Tasks 5-7.
- `Multi-book run score scheduling` is implemented by Task 8.
- `2-3 template presets` and prompt-layer application are implemented by Task 10.
- `Testing, recovery cadence, and observability` are covered by Tasks 5, 8, 9, and 11.

Placeholder scan:

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each code-changing step includes concrete file paths and example code to anchor the edit.
- Each verification step includes the exact command to run and the expected result.

Type consistency check:

- `BookContract`, `StoryLedger`, `IntegrityReport`, `Checkpoint`, and `DriftLevel` are introduced in Task 3 before later tasks rely on them.
- Repository names are consistent between Tasks 2, 6, and 9: `bookContracts`, `storyLedgers`, `storyEvents`, `storyCheckpoints`.
- Scheduler `priority` shape introduced in Task 8 matches the `run score` notion used elsewhere in the spec.
