# Drizzle Migration Only — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all inline DDL and runtime schema mutations, consolidate into Drizzle Kit generated migrations.

**Architecture:** Delete `migrations.ts`, strip `ensureXxx` functions from `database.ts`, remove `ensureProgressColumns` from `progress.ts`. Generate a single initial migration from `schema.ts` via `drizzle-kit generate`. Add `db:generate` npm script. Update tests.

**Tech Stack:** Drizzle ORM, drizzle-kit, better-sqlite3, vitest

---

### Task 1: Add `db:generate` npm script

**Files:**
- Modify: `package.json:16`

- [ ] **Step 1: Add the script**

In `package.json`, add a `db:generate` entry to the `scripts` object, after the existing `package` script:

```json
"package": "pnpm run build && electron-builder",
"db:generate": "drizzle-kit generate"
```

- [ ] **Step 2: Verify drizzle-kit is available**

Run: `pnpm exec drizzle-kit --version`
Expected: prints a version number (e.g. `0.31.x`)

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add db:generate npm script"
```

---

### Task 2: Generate initial Drizzle migration from schema.ts

**Files:**
- Delete: `drizzle/0000_runtime_migration_baseline.sql`
- Delete: `drizzle/meta/_journal.json`
- Create: `drizzle/0000_initial_*.sql` (generated)
- Create: `drizzle/meta/_journal.json` (generated)

- [ ] **Step 1: Remove the old placeholder migration**

```bash
rm drizzle/0000_runtime_migration_baseline.sql drizzle/meta/_journal.json
```

- [ ] **Step 2: Generate migration from schema.ts**

Run: `pnpm run db:generate`
Expected: `drizzle-kit` reads `packages/backend/src/storage/schema.ts` and generates SQL files into `drizzle/`.

- [ ] **Step 3: Verify the generated migration covers all 22 tables**

Run: `grep -c 'CREATE TABLE' drizzle/*.sql`
Expected: 22 (one per table defined in `schema.ts`)

Run: `grep -c 'CREATE INDEX' drizzle/*.sql`
Expected: 4 (`idx_books_status`, `idx_chapters_book_id`, `idx_api_logs_book_id_created_at`, `idx_writing_progress_book_id`)

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "chore: replace placeholder baseline with generated Drizzle migration"
```

---

### Task 3: Delete migrations.ts

**Files:**
- Delete: `packages/backend/src/storage/migrations.ts`

- [ ] **Step 1: Delete the file**

```bash
rm packages/backend/src/storage/migrations.ts
```

- [ ] **Step 2: Verify no other file imports it**

Run: `grep -rn "from.*migrations" packages/ tests/ --include="*.ts"`
Expected: no results (the only import was in `database.ts`, which we clean up in Task 4)

- [ ] **Step 3: Commit**

```bash
git add -u packages/backend/src/storage/migrations.ts
git commit -m "refactor: delete inline SQL migrations.ts"
```

---

### Task 4: Simplify database.ts — remove ensureXxx functions and inline migration loop

**Files:**
- Modify: `packages/backend/src/storage/database.ts`

- [ ] **Step 1: Replace database.ts with the simplified version**

The entire `runMigrations` function and the 5 `ensureXxx` + 2 helper functions become dead code. The simplified file:

1. Removes the import of `./migrations.js`
2. Removes `ensureBookViralStrategyColumn`, `ensureStoryBibleViralProtocolColumn`, `ensureChapterNarrativeColumns`, `ensurePlotThreadsScopedPrimaryKey`, `ensureNarrativeGraphScopedPrimaryKeys`
3. Removes helper functions `hasBookScopedIdPrimaryKey` and `recreateScopedIdTable`
4. Simplifies `runMigrations` to: backup (file DBs only) → `migrateDatabase()`

Replace `packages/backend/src/storage/database.ts` with:

```typescript
import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import path from 'node:path';
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

export function runMigrations(
  db: SqliteDatabase,
  options?: { databaseFile?: string }
) {
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
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/storage/database.ts
git commit -m "refactor: simplify database.ts to Drizzle-only migration"
```

---

### Task 5: Remove ALTER TABLE from progress.ts

**Files:**
- Modify: `packages/backend/src/storage/progress.ts`

- [ ] **Step 1: Remove ensureProgressColumns and its call**

Delete the `ensureProgressColumns` function (lines 3–11) and its call on line 14. The `createProgressRepository` function should start directly with `return {`.

Replace `packages/backend/src/storage/progress.ts` with:

```typescript
import type { Database as SqliteDatabase } from 'better-sqlite3';

export function createProgressRepository(db: SqliteDatabase) {
  return {
    updatePhase(
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) {
      db.prepare(
        `
          INSERT INTO writing_progress (
            book_id,
            current_volume,
            current_chapter,
            phase,
            step_label,
            error_msg
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(book_id) DO UPDATE SET
            current_volume = excluded.current_volume,
            current_chapter = excluded.current_chapter,
            phase = excluded.phase,
            step_label = excluded.step_label,
            error_msg = excluded.error_msg
        `
      ).run(
        bookId,
        metadata?.currentVolume ?? null,
        metadata?.currentChapter ?? null,
        phase,
        metadata?.stepLabel ?? null,
        metadata?.errorMsg ?? null
      );
    },

    getByBookId(bookId: string) {
      return db
        .prepare(
          `
            SELECT
              book_id AS bookId,
              current_volume AS currentVolume,
              current_chapter AS currentChapter,
              phase,
              step_label AS stepLabel,
              retry_count AS retryCount,
              error_msg AS errorMsg
            FROM writing_progress
            WHERE book_id = ?
          `
        )
        .get(bookId) as
        | {
            bookId: string;
            currentVolume: number | null;
            currentChapter: number | null;
            phase: string | null;
            stepLabel: string | null;
            retryCount: number;
            errorMsg: string | null;
          }
        | undefined;
    },

    reset(bookId: string, phase: string) {
      db.prepare(
        `
          INSERT INTO writing_progress (
            book_id,
            current_volume,
            current_chapter,
            phase,
            step_label,
            retry_count,
            error_msg
          )
          VALUES (?, NULL, NULL, ?, NULL, 0, NULL)
          ON CONFLICT(book_id) DO UPDATE SET
            current_volume = NULL,
            current_chapter = NULL,
            phase = excluded.phase,
            step_label = NULL,
            retry_count = 0,
            error_msg = NULL
        `
      ).run(bookId, phase);
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM writing_progress WHERE book_id = ?').run(bookId);
    },
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/storage/progress.ts
git commit -m "refactor: remove runtime ALTER TABLE from progress.ts"
```

---

### Task 6: Update tests

**Files:**
- Modify: `tests/storage/database.test.ts`
- Modify: `tests/storage/migrate.test.ts`

- [ ] **Step 1: Update database.test.ts**

The test "creates the expected tables on first boot" is still valid — it just tests `createDatabase` creates the right tables. No change needed to its logic, but the legacy test ("does not drop existing chapter content when opening a legacy story schema") is no longer relevant since we dropped backward compatibility. Remove that test entirely.

Replace `tests/storage/database.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '@story-weaver/backend/storage/database';

describe('createDatabase', () => {
  it('creates the expected tables on first boot', () => {
    const db = createDatabase(':memory:');
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((row) => row.name);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('writing_progress');
    expect(tableNames).not.toContain('execution_logs');
    expect(tableNames).toContain('model_configs');
    expect(tableNames).toContain('__drizzle_migrations');

    db.close();
  });

  it('preserves existing data when re-opened', () => {
    const db = createDatabase(':memory:');

    db.exec(`
      INSERT INTO books (
        id, title, idea, status, model_id, target_chapters,
        words_per_chapter, created_at, updated_at
      ) VALUES (
        'book-1', 'Test Book', 'An idea.', 'creating', 'test:model', 1, 1200,
        '2026-05-02T00:00:00.000Z', '2026-05-02T00:00:00.000Z'
      );
    `);

    const row = db
      .prepare('SELECT title FROM books WHERE id = ?')
      .get('book-1') as { title: string } | undefined;

    db.close();

    expect(row?.title).toBe('Test Book');
  });
});
```

- [ ] **Step 2: Run database tests**

Run: `pnpm exec vitest run tests/storage/database.test.ts`
Expected: all tests pass

- [ ] **Step 3: Run migrate tests (no changes needed to migrate.test.ts)**

Run: `pnpm exec vitest run tests/storage/migrate.test.ts`
Expected: all tests pass (these test `migrate.ts` utilities which we didn't change)

- [ ] **Step 4: Commit**

```bash
git add tests/storage/database.test.ts
git commit -m "test: update database.test.ts for Drizzle-only migration"
```

---

### Task 7: Final validation

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: all tests pass

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`
Expected: no errors

- [ ] **Step 3: Verify no DDL remains in application code**

Run: `grep -rn "ALTER TABLE\|CREATE TABLE" packages/backend/src/ --include="*.ts"`
Expected: no results (all DDL is now in `drizzle/*.sql` only)

Run: `grep -rn "PRAGMA table_info" packages/backend/src/ --include="*.ts"`
Expected: no results

- [ ] **Step 4: Verify app boots with clean DB**

Run: `rm -f ~/.story-weaver/data.db && pnpm run dev:web` (or use a temp dir as per CLAUDE.md)
Expected: server starts, `/api/health` returns OK, tables exist
