# Drizzle SQLite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded SQLite startup migration path with Drizzle-managed schema and migrations while preserving existing storage behavior, service contracts, and UI-visible functionality.

**Architecture:** Keep `better-sqlite3` as the only SQLite driver owned by the Electron main process. Introduce Drizzle schema modules and versioned migration files, then migrate `src/storage` repositories incrementally so the rest of the app continues to depend on repository interfaces instead of direct ORM calls.

**Tech Stack:** TypeScript, Electron, better-sqlite3, drizzle-orm, drizzle-kit, Vitest.

---

### Task 1: Add Drizzle Tooling And Baseline Schema

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `drizzle.config.ts`
- Create: `src/db/schema/books.ts`
- Create: `src/db/schema/narrative.ts`
- Create: `src/db/schema/ops.ts`
- Create: `src/db/schema/index.ts`
- Test: `tests/storage/database.test.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [ ] **Step 1: Add a failing schema test that asserts Drizzle-created databases still expose the expected tables**

```ts
// tests/storage/database.test.ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';

describe('createDatabase', () => {
  it('creates the expected tables on first boot', () => {
    const db = createDatabase(':memory:');
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((row) => row.name);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('story_bibles');
    expect(tableNames).toContain('chapter_cards');
    expect(tableNames).toContain('writing_progress');
    expect(tableNames).toContain('model_configs');
  });
});
```

- [ ] **Step 2: Run the focused storage tests before adding Drizzle**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: PASS on the current branch. This gives the baseline behavior that the Drizzle migration path must preserve.

- [ ] **Step 3: Add Drizzle dependencies and scripts**

Update `package.json` with the new dependencies and scripts:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.0",
    "tsx": "^4.19.0"
  }
}
```

Run:

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit tsx
```

- [ ] **Step 4: Add Drizzle config and baseline schema modules**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.tmp/story-weaver-plan.sqlite',
  },
  strict: true,
  verbose: true,
});
```

Create `src/db/schema/books.ts`:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  idea: text('idea').notNull(),
  status: text('status').notNull().default('creating'),
  modelId: text('model_id').notNull(),
  targetChapters: integer('target_chapters').notNull(),
  wordsPerChapter: integer('words_per_chapter').notNull(),
  viralStrategyJson: text('viral_strategy_json'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bookContext = sqliteTable('book_context', {
  bookId: text('book_id').primaryKey().notNull(),
  worldSetting: text('world_setting'),
  outline: text('outline'),
  styleGuide: text('style_guide'),
});
```

Create `src/db/schema/ops.ts`:

```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const writingProgress = sqliteTable('writing_progress', {
  bookId: text('book_id').primaryKey().notNull(),
  currentChapter: integer('current_chapter').notNull().default(0),
  totalChapters: integer('total_chapters').notNull().default(0),
  statusText: text('status_text'),
  stepLabel: text('step_label'),
  updatedAt: text('updated_at').notNull(),
});

export const apiLogs = sqliteTable('api_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookId: text('book_id').notNull(),
  phase: text('phase').notNull(),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  createdAt: text('created_at').notNull(),
});

export const modelConfigs = sqliteTable('model_configs', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  modelName: text('model_name').notNull(),
  apiKey: text('api_key').notNull(),
  baseUrl: text('base_url').notNull(),
  isActive: integer('is_active').notNull().default(1),
  configJson: text('config_json').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

Create `src/db/schema/narrative.ts` and include the current narrative tables with existing names and columns from `src/storage/migrations.ts`, keeping JSON columns as `text(...)` fields and composite primary keys where they already exist. Export everything from `src/db/schema/index.ts`:

```ts
export * from './books';
export * from './narrative';
export * from './ops';
```

- [ ] **Step 5: Generate the baseline migration and verify the schema tests stay green**

Run:

```bash
pnpm run db:generate
pnpm exec vitest run tests/storage/database.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: Drizzle writes a baseline migration under `drizzle/`, and the tests still PASS after the next task wires migration execution.

- [ ] **Step 6: Commit the tooling and baseline schema**

```bash
git add package.json pnpm-lock.yaml drizzle.config.ts drizzle src/db/schema tests/storage/database.test.ts tests/storage/narrative-schema.test.ts
git commit -m "feat: add drizzle schema baseline"
```

### Task 2: Replace Startup SQL Execution With Drizzle Migrations

**Files:**
- Create: `src/db/client.ts`
- Create: `src/db/migrate.ts`
- Modify: `src/storage/database.ts`
- Modify: `tests/storage/database.test.ts`
- Test: `tests/storage/database.test.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [ ] **Step 1: Add a focused database boot test for migration-backed startup**

Append in `tests/storage/database.test.ts`:

```ts
it('applies migrations before repositories are created', () => {
  const db = createDatabase(':memory:');
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'chapter_generation_audits'")
    .get() as { name: string } | undefined;

  expect(row?.name).toBe('chapter_generation_audits');
});
```

- [ ] **Step 2: Run the database tests and confirm the new expectation is currently satisfied by the legacy path**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
```

Expected: PASS before the bootstrap refactor.

- [ ] **Step 3: Create the Drizzle client and migration runner**

Create `src/db/client.ts`:

```ts
import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function createSqliteConnection(filename: string) {
  const sqlite = new Database(filename);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

export function createDrizzleDb(sqlite: SqliteDatabase) {
  return drizzle(sqlite, { schema });
}
```

Create `src/db/migrate.ts`:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Database as SqliteDatabase } from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createSqliteConnection } from './client';

export function runDrizzleMigrations(
  sqlite: SqliteDatabase,
  migrationsFolder = path.resolve(process.cwd(), 'drizzle')
) {
  migrate(sqlite, { migrationsFolder });
}

const entryPath = fileURLToPath(import.meta.url);

if (process.argv[1] === entryPath) {
  const filename = process.argv[2] ?? path.resolve(process.cwd(), '.tmp/story-weaver-plan.sqlite');
  const sqlite = createSqliteConnection(filename);
  runDrizzleMigrations(sqlite);
  sqlite.close();
}
```

- [ ] **Step 4: Refactor `src/storage/database.ts` to use the migration runner instead of `db.exec(migrations)`**

Replace the startup logic with:

```ts
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb, createSqliteConnection } from '../db/client.js';
import { runDrizzleMigrations } from '../db/migrate.js';

export function createDatabase(filename: string) {
  const sqlite = createSqliteConnection(filename);
  runDrizzleMigrations(sqlite);
  return sqlite;
}

export function createRepositories(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);
  // pass drizzleDb into repositories as they migrate
  // keep the existing repository object shape intact
}
```

Keep repository exports stable. Do not remove `createRepositories`.

- [ ] **Step 5: Re-run storage tests and typecheck**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS. If `:memory:` migration lookup fails, switch tests to temporary-file databases in this task before moving on.

- [ ] **Step 6: Commit the bootstrap migration switch**

```bash
git add src/db/client.ts src/db/migrate.ts src/storage/database.ts tests/storage/database.test.ts
git commit -m "feat: run sqlite schema through drizzle migrations"
```

### Task 3: Migrate Settings, Model Configs, And Books Repositories

**Files:**
- Modify: `src/storage/settings.ts`
- Modify: `src/storage/model-configs.ts`
- Modify: `src/storage/books.ts`
- Modify: `tests/storage/settings.test.ts`
- Modify: `tests/storage/model-configs.test.ts`
- Modify: `tests/storage/books.test.ts`
- Test: `tests/storage/settings.test.ts`
- Test: `tests/storage/model-configs.test.ts`
- Test: `tests/storage/books.test.ts`

- [ ] **Step 1: Add explicit low-risk repository tests before refactoring the implementation**

Append to `tests/storage/settings.test.ts`:

```ts
it('lists settings as a key-value object ordered by key', () => {
  const db = createDatabase(':memory:');
  const repo = createSettingsRepository(db);

  repo.set('b.key', '2');
  repo.set('a.key', '1');

  expect(repo.list()).toEqual({
    'a.key': '1',
    'b.key': '2',
  });
});
```

Append to `tests/storage/model-configs.test.ts`:

```ts
it('returns null when the requested model config does not exist', () => {
  const db = createDatabase(':memory:');
  const repo = createModelConfigRepository(db);

  expect(repo.getById('missing')).toBeNull();
});
```

- [ ] **Step 2: Run the focused repository tests before implementation**

Run:

```bash
pnpm exec vitest run tests/storage/settings.test.ts tests/storage/model-configs.test.ts tests/storage/books.test.ts --reporter=dot
```

Expected: PASS on the legacy repository code.

- [ ] **Step 3: Rewrite `settings` and `model-configs` to use Drizzle queries**

Update `src/storage/settings.ts` to use `createDrizzleDb(db)` and the `settings` schema:

```ts
import { asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { settings } from '../db/schema/index.js';

export function createSettingsRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    list() {
      const rows = drizzleDb.select().from(settings).orderBy(asc(settings.key)).all();
      return Object.fromEntries(rows.map((row) => [row.key, row.value]));
    },
    get(key: string) {
      const row = drizzleDb.select().from(settings).where(eq(settings.key, key)).get();
      return row?.value ?? null;
    },
    set(key: string, value: string) {
      drizzleDb
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
    },
  };
}
```

Update `src/storage/model-configs.ts` with Drizzle `delete`, `insert`, `select`, and JSON serialization identical to the current repository behavior.

- [ ] **Step 4: Rewrite `books` to use Drizzle while keeping the same repository API**

Keep these behaviors exactly:

```ts
// src/storage/books.ts
// preserve create(), list(), getById(), updateStatus(), updateTitle(),
// saveContext(), getContext(), clearGeneratedState(), delete()
// preserve JSON serialization for viralStrategy
// preserve ORDER BY created_at DESC in list()
// preserve deleteBookPlanningData(db, bookId) until Task 5 migrates the narrative repositories
```

Use Drizzle `insert`, `update`, and `select` against `books` and `bookContext`, but keep `deleteBookPlanningData` on the raw `better-sqlite3` connection for now so the service layer remains unchanged.

- [ ] **Step 5: Re-run focused repository tests and typecheck**

Run:

```bash
pnpm exec vitest run tests/storage/settings.test.ts tests/storage/model-configs.test.ts tests/storage/books.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS with no changes to the test assertions other than the new coverage added in Step 1.

- [ ] **Step 6: Commit the low-risk repository migration**

```bash
git add src/storage/settings.ts src/storage/model-configs.ts src/storage/books.ts tests/storage/settings.test.ts tests/storage/model-configs.test.ts tests/storage/books.test.ts
git commit -m "refactor: migrate base storage repositories to drizzle"
```

### Task 4: Migrate Chapters, Progress, Logs, And Export-Adjacent Storage

**Files:**
- Modify: `src/storage/chapters.ts`
- Modify: `src/storage/progress.ts`
- Modify: `src/storage/logs.ts`
- Modify: `src/storage/export.ts`
- Modify: `tests/storage/books.test.ts`
- Modify: `tests/storage/logs.test.ts`
- Modify: `tests/storage/export.test.ts`
- Test: `tests/storage/books.test.ts`
- Test: `tests/storage/logs.test.ts`
- Test: `tests/storage/export.test.ts`

- [ ] **Step 1: Add a chapter repository regression test that locks in current progress aggregation**

Append to `tests/storage/books.test.ts`:

```ts
it('returns an empty progress map when no book ids are provided', () => {
  const db = createDatabase(':memory:');
  const chapters = createChapterRepository(db);

  expect(chapters.listProgressByBookIds([])).toEqual(new Map());
});
```

- [ ] **Step 2: Run the focused chapter/log/export tests before repository changes**

Run:

```bash
pnpm exec vitest run tests/storage/books.test.ts tests/storage/logs.test.ts tests/storage/export.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 3: Move `chapters` and `progress` to Drizzle queries**

Preserve the current API surface and semantics:

```ts
// src/storage/chapters.ts
// preserve upsertOutline(), upsertPlanned(), listByBook(),
// listProgressByBookIds(), saveContent(), clearGeneratedContent(), deleteByBook()
// keep chapter_cards.plot_function as the source of outline text
// keep the progress aggregation SQL semantics identical
```

Use Drizzle for:

```ts
drizzleDb
  .insert(chapters)
  .values(...)
  .onConflictDoUpdate({ target: [chapters.bookId, chapters.volumeIndex, chapters.chapterIndex], set: ... })
  .run();
```

and keep a raw SQL helper only if the progress aggregation is simpler to express as one grouped query.

- [ ] **Step 4: Migrate `progress`, `logs`, and `export` storage helpers**

Keep these behaviors unchanged:

```ts
// src/storage/progress.ts
// preserve existing writing_progress row shape and any step_label compatibility

// src/storage/logs.ts
// preserve append/list order and field mapping

// src/storage/export.ts
// preserve export payload shape consumed by current core/export code
```

If `export.ts` only reads assembled book data, leave it on repository composition rather than forcing direct table access changes that widen the blast radius.

- [ ] **Step 5: Re-run storage tests and fix any row-shape drift immediately**

Run:

```bash
pnpm exec vitest run tests/storage/books.test.ts tests/storage/logs.test.ts tests/storage/export.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the operational repository migration**

```bash
git add src/storage/chapters.ts src/storage/progress.ts src/storage/logs.ts src/storage/export.ts tests/storage/books.test.ts tests/storage/logs.test.ts tests/storage/export.test.ts
git commit -m "refactor: migrate chapter and ops storage to drizzle"
```

### Task 5: Migrate Narrative Repositories And Book Graph Cleanup

**Files:**
- Modify: `src/storage/story-bibles.ts`
- Modify: `src/storage/character-arcs.ts`
- Modify: `src/storage/characters.ts`
- Modify: `src/storage/relationship-edges.ts`
- Modify: `src/storage/relationship-states.ts`
- Modify: `src/storage/world-rules.ts`
- Modify: `src/storage/narrative-threads.ts`
- Modify: `src/storage/volume-plans.ts`
- Modify: `src/storage/chapter-cards.ts`
- Modify: `src/storage/chapter-audits.ts`
- Modify: `src/storage/chapter-tension-budgets.ts`
- Modify: `src/storage/narrative-checkpoints.ts`
- Modify: `src/storage/scene-records.ts`
- Modify: `src/storage/book-graph.ts`
- Modify: `tests/storage/narrative-schema.test.ts`
- Modify: `tests/core/narrative-book-service.test.ts`
- Test: `tests/storage/narrative-schema.test.ts`
- Test: `tests/core/narrative-book-service.test.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`

- [ ] **Step 1: Add a failing deletion test that locks in book-graph cleanup**

Append to `tests/core/narrative-book-service.test.ts`:

```ts
it('removes narrative planning records when deleting a book', async () => {
  const db = createDatabase(':memory:');
  const repositories = createRepositories(db);

  repositories.books.create({
    id: 'book-delete',
    title: 'Delete Me',
    idea: 'Cleanup test',
    targetChapters: 2,
    wordsPerChapter: 1200,
  });

  repositories.storyBibles.save({
    bookId: 'book-delete',
    premise: 'Premise',
    genreContract: 'Contract',
    targetReaderExperience: 'Tension',
    themeQuestion: 'Question',
    themeAnswerDirection: 'Answer',
    centralDramaticQuestion: 'Will it hold?',
    endingState: { finalImage: 'Resolved' },
    voiceGuide: 'Voice',
    viralProtocol: null,
  });

  repositories.books.delete('book-delete');

  expect(repositories.storyBibles.getByBookId('book-delete')).toBeNull();
});
```

- [ ] **Step 2: Run the narrative storage and service tests before migrating the implementations**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts tests/core/narrative-book-service.test.ts tests/core/narrative-audit-state-checkpoint.test.ts --reporter=dot
```

Expected: PASS on the current branch.

- [ ] **Step 3: Convert each narrative repository to Drizzle without changing its public contract**

Use the current repository boundaries as the migration units:

```ts
// story-bibles.ts: keep save(), getByBookId()
// character-arcs.ts: keep replaceByBookId(), listByBookId()
// relationship-edges.ts: keep replaceByBookId(), listByBookId()
// world-rules.ts: keep replaceByBookId(), listByBookId()
// narrative-threads.ts: keep replaceByBookId(), listByBookId()
// volume-plans.ts / chapter-cards.ts / chapter-audits.ts / chapter-tension-budgets.ts
// narrative-checkpoints.ts / scene-records.ts / relationship-states.ts / characters.ts
```

For every JSON-backed field, preserve current serialization exactly:

```ts
const payload = JSON.stringify(value ?? []);
const parsed = row.forbiddenMovesJson ? JSON.parse(row.forbiddenMovesJson) : [];
```

Do not rename repository methods in this task.

- [ ] **Step 4: Replace `book-graph.ts` cleanup helpers with Drizzle-backed deletes**

Keep the helper contract stable:

```ts
// src/storage/book-graph.ts
export function deleteBookPlanningData(db: SqliteDatabase, bookId: string) {
  // delete from narrative_checkpoints, chapter_generation_audits,
  // chapter_relationship_actions, chapter_tension_budgets,
  // chapter_character_pressures, chapter_thread_actions,
  // chapter_cards, chapters, volume_plans, relationship_states,
  // relationship_edges, narrative_threads, world_rules,
  // character_states, character_arcs, story_bibles, characters,
  // plot_threads, world_settings
}
```

It is fine to keep this helper using the raw SQLite connection if that keeps the delete ordering obvious, but all repository reads and writes should already be on Drizzle by the end of the task.

- [ ] **Step 5: Re-run narrative tests and any storage suites that drift**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts tests/core/narrative-book-service.test.ts tests/core/narrative-audit-state-checkpoint.test.ts tests/storage/books.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit the narrative repository migration**

```bash
git add src/storage/story-bibles.ts src/storage/character-arcs.ts src/storage/characters.ts src/storage/relationship-edges.ts src/storage/relationship-states.ts src/storage/world-rules.ts src/storage/narrative-threads.ts src/storage/volume-plans.ts src/storage/chapter-cards.ts src/storage/chapter-audits.ts src/storage/chapter-tension-budgets.ts src/storage/narrative-checkpoints.ts src/storage/scene-records.ts src/storage/book-graph.ts tests/storage/narrative-schema.test.ts tests/core/narrative-book-service.test.ts
git commit -m "refactor: migrate narrative storage to drizzle"
```

### Task 6: Remove The Legacy Migration Array And Finalize Verification

**Files:**
- Delete: `src/storage/migrations.ts`
- Modify: `src/storage/database.ts`
- Modify: `electron/runtime.ts`
- Modify: `tests/storage/database.test.ts`
- Test: `tests/storage/database.test.ts`
- Test: `tests/storage/books.test.ts`
- Test: `tests/storage/settings.test.ts`
- Test: `tests/storage/model-configs.test.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [ ] **Step 1: Add a regression test that guards against the old migration module being required**

Append to `tests/storage/database.test.ts`:

```ts
it('boots without relying on the legacy migrations array module', async () => {
  const db = createDatabase(':memory:');
  const row = db
    .prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table'")
    .get() as { count: number };

  expect(row.count).toBeGreaterThan(5);
});
```

- [ ] **Step 2: Run the focused database tests before deleting the legacy file**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 3: Delete `src/storage/migrations.ts` and any startup helper code that exists only to patch legacy schema at runtime**

Remove:

```ts
// src/storage/database.ts
// remove imports from ./migrations.js
// remove shouldResetDevelopmentStorySchema()
// remove ensureBookViralStrategyColumn()
// remove ensureStoryBibleViralProtocolColumn()
// remove resetDevelopmentStorySchema()
// keep only connection setup, migration execution, and repository wiring
```

Keep `electron/runtime.ts` unchanged unless it imports storage internals that now moved under `src/db`.

- [ ] **Step 4: Re-run the full storage suite and typecheck**

Run:

```bash
pnpm exec vitest run tests/storage/database.test.ts tests/storage/books.test.ts tests/storage/settings.test.ts tests/storage/model-configs.test.ts tests/storage/narrative-schema.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Run the full project test suite**

Run:

```bash
pnpm test
```

Expected: PASS. If unrelated renderer/runtime work in the branch causes failures, document those separately and keep the database migration changes isolated.

- [ ] **Step 6: Commit the final cleanup**

```bash
git add src/storage/database.ts src/db electron/runtime.ts tests/storage/database.test.ts
git rm src/storage/migrations.ts
git commit -m "refactor: remove legacy sqlite migration path"
```

## Self-Review

- Spec coverage: the plan covers Drizzle adoption, formal migration files, startup migration execution, low-risk repository migration, narrative repository migration, legacy migration cleanup, and verification against current tests.
- Placeholder scan: each task names exact files, concrete commands, and the behavior that must remain stable.
- Type consistency: the plan preserves existing repository factories such as `createBookRepository`, `createSettingsRepository`, `createModelConfigRepository`, and `createRepositories` while migrating their internals.
