# DDD Aggregate Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the monolithic `book-service.ts` (1837 lines) into 6 focused aggregates + 1 orchestrator following the DDD design spec.

**Architecture:** Incremental extraction — each task extracts one aggregate from `book-service.ts`, delegating from the original service to the new module. Existing tests pass after every task. The final task replaces `book-service.ts` with a thin orchestrator.

**Tech Stack:** TypeScript, Vitest, better-sqlite3 (in-memory for tests), pnpm workspace

---

## File Structure

Files created or modified across all tasks:

### Created files:
- `packages/backend/src/core/aggregates/book/book-aggregate.ts` — Book lifecycle commands (create, pause, resume, delete, restart)
- `packages/backend/src/core/aggregates/book/book-state.ts` — State machine helpers (isBookPaused, deriveTitleFromIdea)
- `packages/backend/src/core/aggregates/book/index.ts` — Re-export
- `packages/backend/src/core/aggregates/outline/outline-aggregate.ts` — World-building + outline generation
- `packages/backend/src/core/aggregates/outline/index.ts` — Re-export
- `packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts` — Single chapter writing pipeline
- `packages/backend/src/core/aggregates/chapter/index.ts` — Re-export
- `packages/backend/src/core/aggregates/narrative-world/narrative-world-aggregate.ts` — Story bible, character arcs, relationships, world rules
- `packages/backend/src/core/aggregates/narrative-world/index.ts` — Re-export
- `packages/backend/src/core/aggregates/story-plan/story-plan-aggregate.ts` — Volume plans, chapter cards, tension budgets
- `packages/backend/src/core/aggregates/story-plan/index.ts` — Re-export
- `packages/backend/src/core/aggregates/continuity/continuity-aggregate.ts` — Post-chapter state extraction + tracking
- `packages/backend/src/core/aggregates/continuity/index.ts` — Re-export
- `packages/backend/src/core/orchestrator.ts` — Thin coordinator replacing book-service.ts
- `packages/backend/src/core/aggregates/index.ts` — Barrel re-export for all aggregates
- `tests/core/aggregates/book-aggregate.test.ts` — Tests for Book aggregate
- `tests/core/aggregates/outline-aggregate.test.ts` — Tests for Outline aggregate
- `tests/core/aggregates/chapter-aggregate.test.ts` — Tests for Chapter aggregate
- `tests/core/aggregates/narrative-world-aggregate.test.ts` — Tests for NarrativeWorld aggregate
- `tests/core/aggregates/story-plan-aggregate.test.ts` — Tests for StoryPlan aggregate
- `tests/core/aggregates/continuity-aggregate.test.ts` — Tests for Continuity aggregate
- `tests/core/orchestrator.test.ts` — Integration tests for the orchestrator

### Modified files:
- `packages/backend/src/core/book-service.ts` — Gradually thinned; delegates to aggregates; replaced in Task 7
- `packages/backend/src/runtime/create-runtime-services.ts` — Updated to wire aggregates
- `tests/core/book-service.test.ts` — Tests updated as methods move to aggregates (kept green throughout)

---

## Task 1: Create Directory Structure and Book Aggregate

**Goal:** Extract Book lifecycle operations (create, pause, resume, delete, restart, listBooks, getBookDetail queries) into a focused aggregate.

**Files:**
- Create: `packages/backend/src/core/aggregates/book/book-aggregate.ts`
- Create: `packages/backend/src/core/aggregates/book/book-state.ts`
- Create: `packages/backend/src/core/aggregates/book/index.ts`
- Create: `packages/backend/src/core/aggregates/index.ts`
- Create: `tests/core/aggregates/book-aggregate.test.ts`
- Modify: `packages/backend/src/core/book-service.ts` — delegate to book aggregate

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/backend/src/core/aggregates/book
mkdir -p tests/core/aggregates
```

- [ ] **Step 2: Write failing test for Book aggregate — createBook**

Create `tests/core/aggregates/book-aggregate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createBookAggregate } from '@story-weaver/backend/core/aggregates/book';

describe('createBookAggregate', () => {
  it('creates a book and lists it with progress', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const progress = createProgressRepository(db);

    const aggregate = createBookAggregate({ books, chapters, progress });
    const bookId = aggregate.createBook({
      idea: 'A city remembers every promise.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });

    const listed = aggregate.listBooks();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: bookId,
      title: '新作品',
      idea: 'A city remembers every promise.',
      targetChapters: 500,
      wordsPerChapter: 2500,
      status: 'creating',
      progress: 0,
      completedChapters: 0,
      totalChapters: 0,
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/aggregates/book-aggregate.test.ts`
Expected: FAIL — module `@story-weaver/backend/core/aggregates/book` does not exist.

- [ ] **Step 4: Create book-state.ts**

Create `packages/backend/src/core/aggregates/book/book-state.ts`:

```typescript
const INITIAL_BOOK_TITLE = '新作品';

export { INITIAL_BOOK_TITLE };

export function deriveTitleFromIdea(idea: string) {
  const cleaned = idea.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return 'Untitled Story';
  }
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}...` : cleaned;
}

export function isBookPaused(
  books: { getById: (bookId: string) => { status: string } | undefined },
  bookId: string
) {
  return books.getById(bookId)?.status === 'paused';
}
```

- [ ] **Step 5: Create book-aggregate.ts with createBook and listBooks**

Create `packages/backend/src/core/aggregates/book/book-aggregate.ts`. Extract the `createBook` and `listBooks` methods from `book-service.ts` (lines 774–832). The aggregate takes typed dependencies:

```typescript
import { randomUUID } from 'node:crypto';
import type { BookRecord, BookStatus } from '@story-weaver/shared/contracts';
import { assertPositiveIntegerLimit } from '../../story-constraints.js';
import { INITIAL_BOOK_TITLE } from './book-state.js';

export function createBookAggregate(deps: {
  books: {
    create: (input: {
      id: string;
      title: string;
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
    }) => void;
    list: () => Array<{
      id: string;
      title: string;
      idea: string;
      status: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
      createdAt: string;
      updatedAt: string;
    }>;
    getById: (bookId: string) =>
      | {
          id: string;
          title: string;
          idea: string;
          status: string;
          targetChapters: number;
          wordsPerChapter: number;
          viralStrategy?: BookRecord['viralStrategy'];
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
    updateTitle: (bookId: string, title: string) => void;
    delete: (bookId: string) => void;
    saveContext: (input: {
      bookId: string;
      worldSetting: string;
      outline: string;
      styleGuide?: string | null;
    }) => void;
    getContext: (bookId: string) =>
      | { bookId: string; worldSetting: string; outline: string; styleGuide: string | null }
      | undefined;
    clearGeneratedState?: (bookId: string) => void;
  };
  chapters: {
    listByBook: (bookId: string) => Array<{
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string | null;
      outline: string | null;
      content: string | null;
      summary: string | null;
      wordCount: number;
    }>;
    listProgressByBookIds?: (
      bookIds: string[]
    ) => Map<string, { completedChapters: number; totalChapters: number }>;
    clearGeneratedContent: (bookId: string) => void;
    deleteByBook: (bookId: string) => void;
  };
  progress: {
    updatePhase: (
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) => void;
    getByBookId: (bookId: string) =>
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
    reset: (bookId: string, phase: string) => void;
    deleteByBook: (bookId: string) => void;
  };
}) {
  return {
    createBook(input: {
      idea: string;
      targetChapters: number;
      wordsPerChapter: number;
      viralStrategy?: BookRecord['viralStrategy'];
    }) {
      assertPositiveIntegerLimit(input.targetChapters, 'Target chapters must be a positive integer');
      assertPositiveIntegerLimit(input.wordsPerChapter, 'Words per chapter must be a positive integer');
      const id = randomUUID();
      deps.books.create({
        id,
        title: INITIAL_BOOK_TITLE,
        idea: input.idea,
        targetChapters: input.targetChapters,
        wordsPerChapter: input.wordsPerChapter,
        viralStrategy: input.viralStrategy ?? null,
      });
      deps.progress.updatePhase(id, 'creating');
      return id;
    },

    listBooks() {
      const books = deps.books.list();
      const batchedProgress = deps.chapters.listProgressByBookIds?.(books.map((b) => b.id));
      return books.map((book) => {
        const chapterProgress = batchedProgress?.get(book.id);
        const chapters = chapterProgress ? null : deps.chapters.listByBook(book.id);
        const totalChapters = chapterProgress?.totalChapters ?? chapters?.length ?? 0;
        const completedChapters =
          chapterProgress?.completedChapters ?? chapters?.filter((c) => Boolean(c.content)).length ?? 0;
        return {
          ...book,
          progress: totalChapters ? Math.round((completedChapters / totalChapters) * 100) : 0,
          completedChapters,
          totalChapters,
        };
      });
    },
  };
}
```

- [ ] **Step 6: Create index.ts barrel**

Create `packages/backend/src/core/aggregates/book/index.ts`:

```typescript
export { createBookAggregate } from './book-aggregate.js';
export { deriveTitleFromIdea, isBookPaused, INITIAL_BOOK_TITLE } from './book-state.js';
```

Create `packages/backend/src/core/aggregates/index.ts`:

```typescript
export { createBookAggregate } from './book/index.js';
```

- [ ] **Step 7: Update TypeScript path aliases**

Check if `vitest.config.ts` and `tsconfig.json` resolve `@story-weaver/backend/core/aggregates/*`. If not, the in-memory test import path should use a relative or existing alias. Run the test:

Run: `pnpm exec vitest run tests/core/aggregates/book-aggregate.test.ts`
Expected: PASS

- [ ] **Step 8: Wire book-service.ts to delegate to book aggregate**

In `packages/backend/src/core/book-service.ts`, import `createBookAggregate` and delegate `createBook()` and `listBooks()` to it. The `deps` object is shared — the aggregate receives the same repository references. Verify existing tests still pass:

Run: `pnpm exec vitest run tests/core/book-service.test.ts`
Expected: All existing tests PASS

- [ ] **Step 9: Add more Book aggregate tests**

Add tests to `tests/core/aggregates/book-aggregate.test.ts` covering:
- `pauseBook` — transitions status to 'paused'
- `deleteBook` — removes book and cascades
- Validation rejects invalid chapter/word counts

Extract `pauseBook` and `deleteBook` from `book-service.ts` into the aggregate, then delegate from book-service.

- [ ] **Step 10: Commit**

```bash
git add packages/backend/src/core/aggregates/ tests/core/aggregates/ packages/backend/src/core/book-service.ts
git commit -m "refactor: extract Book aggregate from book-service"
```

---

## Task 2: Extract Outline Aggregate

**Goal:** Extract world-building + outline generation (`startBook` logic) into an Outline aggregate.

**Files:**
- Create: `packages/backend/src/core/aggregates/outline/outline-aggregate.ts`
- Create: `packages/backend/src/core/aggregates/outline/index.ts`
- Create: `tests/core/aggregates/outline-aggregate.test.ts`
- Modify: `packages/backend/src/core/aggregates/index.ts`
- Modify: `packages/backend/src/core/book-service.ts`

- [ ] **Step 1: Write failing test for Outline aggregate**

Create `tests/core/aggregates/outline-aggregate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createOutlineAggregate } from '@story-weaver/backend/core/aggregates/outline';

function createTestDeps() {
  const db = createDatabase(':memory:');
  const books = createBookRepository(db);
  const chapters = createChapterRepository(db);
  const progress = createProgressRepository(db);
  return { db, books, chapters, progress };
}

describe('createOutlineAggregate', () => {
  it('generates world-building and outline from an idea', async () => {
    const { books, chapters, progress } = createTestDeps();
    const bookId = books.create({
      id: 'test-book',
      title: 'Test',
      idea: 'A hero rises',
      targetChapters: 10,
      wordsPerChapter: 2500,
    });
    progress.updatePhase(bookId, 'creating');

    const onBookUpdated = vi.fn();
    const onGenerationEvent = vi.fn();

    const outlineBundle = {
      worldSetting: 'A fantasy world',
      masterOutline: 'The hero saves the world',
      chapterOutlines: [
        { volumeIndex: 1, chapterIndex: 1, title: 'Ch1', outline: 'Beginning' },
      ],
    };

    const aggregate = createOutlineAggregate({
      books,
      chapters,
      progress,
      outlineService: {
        generateFromIdea: vi.fn().mockResolvedValue(outlineBundle),
      },
      onBookUpdated,
      onGenerationEvent,
      resolveModelId: () => 'test:model',
    });

    await aggregate.generateFromIdea(bookId);

    expect(books.getById(bookId)?.status).toBe('building_outline');
    const context = books.getContext(bookId);
    expect(context?.worldSetting).toBe('A fantasy world');
    expect(context?.outline).toBe('The hero saves the world');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/aggregates/outline-aggregate.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create outline-aggregate.ts**

Extract the core of `startBook()` from `book-service.ts` (lines 965–1138). The aggregate handles:
- Title generation (optional `generateTitleFromIdea`)
- World-building + outline generation with streaming callbacks
- Saving context, narrative bibles, volume plans, chapter cards, tension budgets, thread actions
- Progress tracking during generation

Create `packages/backend/src/core/aggregates/outline/outline-aggregate.ts` with a `createOutlineAggregate(deps)` function. Move `saveChapterOutlines` helper (book-service.ts lines 189–218) into this module. The method signatures:

```typescript
export function createOutlineAggregate(deps: {
  books: /* same shape as book-service deps.books */;
  chapters: { upsertOutline: (...) => void; listByBook: (...) => Array<...>; clearGeneratedContent: (bookId: string) => void };
  progress: { updatePhase: (...) => void; reset: (...) => void };
  outlineService: { generateTitleFromIdea?: (...) => Promise<string>; generateFromIdea: (...) => Promise<OutlineBundle> };
  storyBibles?: { saveGraph: (...) => void };
  volumePlans?: { upsertMany: (...) => void };
  chapterCards?: { upsertMany: (...) => void; upsertThreadActions?: (...) => void; upsertCharacterPressures?: (...) => void; upsertRelationshipActions?: (...) => void };
  chapterTensionBudgets?: { upsertMany: (...) => void };
  resolveModelId: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
}) {
  return {
    async generateFromIdea(bookId: string) { /* extracted from startBook, minus status/book-exists checks that belong to Book aggregate */ },
  };
}
```

Copy the exact implementation from `book-service.ts::startBook()` lines 971–1138, adapting:
- Remove the `book = deps.books.getById()` check at the top (orchestrator validates)
- Remove `deps.books.updateStatus(bookId, 'building_world')` at line 971 (orchestrator handles status)
- Keep all progress tracking, AI calls, context saving, and narrative bible saving

- [ ] **Step 4: Create outline/index.ts and update aggregates/index.ts**

Create `packages/backend/src/core/aggregates/outline/index.ts`:

```typescript
export { createOutlineAggregate } from './outline-aggregate.js';
```

Update `packages/backend/src/core/aggregates/index.ts`:

```typescript
export { createBookAggregate } from './book/index.js';
export { createOutlineAggregate } from './outline/index.js';
```

- [ ] **Step 5: Run outline aggregate test**

Run: `pnpm exec vitest run tests/core/aggregates/outline-aggregate.test.ts`
Expected: PASS

- [ ] **Step 6: Delegate startBook() in book-service.ts to outline aggregate**

In `book-service.ts`, replace the body of `startBook()` with a call to the outline aggregate:

```typescript
async startBook(bookId: string) {
  const book = deps.books.getById(bookId);
  if (!book) throw new Error(`Book not found: ${bookId}`);
  deps.books.updateStatus(bookId, 'building_world');
  await deps.outlineAggregate.generateFromIdea(bookId);
}
```

Run: `pnpm exec vitest run tests/core/book-service.test.ts`
Expected: All existing tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/core/aggregates/outline/ tests/core/aggregates/outline-aggregate.test.ts packages/backend/src/core/book-service.ts packages/backend/src/core/aggregates/index.ts
git commit -m "refactor: extract Outline aggregate from book-service"
```

---

## Task 3: Extract Chapter Aggregate

**Goal:** Extract the chapter writing pipeline (`writeNextChapter` core logic) into a Chapter aggregate. This is the most complex extraction (~400 lines).

**Files:**
- Create: `packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts`
- Create: `packages/backend/src/core/aggregates/chapter/index.ts`
- Create: `tests/core/aggregates/chapter-aggregate.test.ts`
- Modify: `packages/backend/src/core/aggregates/index.ts`
- Modify: `packages/backend/src/core/book-service.ts`

- [ ] **Step 1: Write failing test for Chapter aggregate**

Create `tests/core/aggregates/chapter-aggregate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createChapterCardRepository } from '@story-weaver/backend/storage/chapter-cards';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createChapterAggregate } from '@story-weaver/backend/core/aggregates/chapter';

describe('createChapterAggregate', () => {
  it('writes the next outlined chapter and persists content', async () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const progress = createProgressRepository(db);

    const bookId = 'book-1';
    books.create({ id: bookId, title: 'Test', idea: 'test', targetChapters: 10, wordsPerChapter: 2500 });
    chapters.upsertOutline({ bookId, volumeIndex: 1, chapterIndex: 1, title: 'Chapter 1', outline: 'A beginning' });

    const writtenContent = 'Once upon a time in a distant land...';
    const aggregate = createChapterAggregate({
      books,
      chapters,
      progress,
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({ content: writtenContent, usage: { inputTokens: 100, outputTokens: 200 } }),
      },
      summaryGenerator: { summarizeChapter: vi.fn().mockResolvedValue('A summary') },
      plotThreadExtractor: { extractThreads: vi.fn().mockResolvedValue({ openedThreads: [], resolvedThreadIds: [] }) },
      characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
      sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
      resolveModelId: () => 'test:model',
      onBookUpdated: vi.fn(),
      onGenerationEvent: vi.fn(),
    });

    const result = await aggregate.writeNext(bookId);
    expect(result.content).toBe(writtenContent);

    const saved = chapters.listByBook(bookId);
    expect(saved[0].content).toBe(writtenContent);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create chapter-aggregate.ts**

Extract the core of `writeNextChapter()` from `book-service.ts` (lines 1162–1722). This is the most complex extraction. The aggregate encapsulates:

1. **Preparation**: Find next chapter, build context (from consistency.ts, narrative modules)
2. **Writing**: Call AI chapter writer with streaming
3. **Short chapter rewrite**: Optional rewrite check
4. **Auditing**: Quality audit + revision loop
5. **Post-processing**: Extract summary, threads, characters, scenes; save all

Move these helper functions from `book-service.ts` into the chapter aggregate:
- `buildShortChapterRewritePrompt` (lines 158–173)
- `buildOutlineFromChapterCard` (lines 175–187)
- `hasUsableChapterUpdate` (lines 121–123)
- `calculateFlatnessScore` (lines 125–139)
- `calculateViralScore` (lines 141–156)
- `extractChapterUpdate` (lines 231–285)
- `FLATNESS_ISSUE_TYPES` and `VIRAL_ISSUE_TYPES` constants (lines 46–63)

The aggregate exports:

```typescript
export function createChapterAggregate(deps: {
  books: { /* getById, getContext */ };
  chapters: { /* listByBook, saveContent */ };
  progress: { /* updatePhase */ };
  sceneRecords: { /* save */ };
  characters: { /* saveState */ };
  plotThreads: { /* upsertThread, resolveThread */ };
  chapterWriter: { /* writeChapter */ };
  chapterAuditor?: { /* auditChapter */ };
  chapterRevision?: { /* reviseChapter */ };
  summaryGenerator: { /* summarizeChapter */ };
  plotThreadExtractor: { /* extractThreads */ };
  characterStateExtractor: { /* extractStates */ };
  sceneRecordExtractor: { /* extractScene */ };
  chapterUpdateExtractor?: { /* extractChapterUpdate */ };
  chapterCards?: { /* listByBook, getNextUnwritten, listThreadActions, listCharacterPressures, listRelationshipActions */ };
  chapterTensionBudgets?: { /* getByChapter */ };
  chapterAudits?: { /* save, listLatestByBook */ };
  storyBibles?: { /* getByBook */ };
  worldRules?: { /* listByBook */ };
  characterArcs?: { /* listByBook, saveState */ };
  relationshipEdges?: { /* listByBook */ };
  relationshipStates?: { /* save */ };
  narrativeThreads?: { /* listByBook, upsertThread, resolveThread */ };
  narrativeStateExtractor?: { /* extractState */ };
  narrativeCheckpoint?: { /* reviewCheckpoint */ };
  narrativeCheckpoints?: { /* save */ };
  shouldRewriteShortChapter?: (input: { content: string; wordsPerChapter: number }) => boolean;
  resolveModelId: () => string;
  onBookUpdated?: (bookId: string) => void;
  onGenerationEvent?: (event: BookGenerationEvent) => void;
}) {
  return {
    async writeNext(bookId: string) { /* full writeNextChapter logic */ },
  };
}
```

Copy the implementation from `book-service.ts::writeNextChapter()` lines 1162–1722 verbatim, keeping all the same imports (`buildStoredChapterContext`, `buildChapterDraftPrompt`, `buildNarrativeDraftPrompt`, `routeStoryTask`, etc.).

- [ ] **Step 4: Create chapter/index.ts and update aggregates/index.ts**

Create `packages/backend/src/core/aggregates/chapter/index.ts`:

```typescript
export { createChapterAggregate } from './chapter-aggregate.js';
```

Update `packages/backend/src/core/aggregates/index.ts` to add the chapter export.

- [ ] **Step 5: Run chapter aggregate test**

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: PASS

- [ ] **Step 6: Delegate writeNextChapter() in book-service.ts**

Replace the body of `writeNextChapter()` in `book-service.ts` with delegation:

```typescript
async writeNextChapter(bookId: string) {
  return deps.chapterAggregate.writeNext(bookId);
}
```

Run: `pnpm exec vitest run tests/core/book-service.test.ts`
Expected: All existing tests PASS

- [ ] **Step 7: Add more Chapter aggregate tests**

Add tests for:
- Chapter auditing and revision
- Short chapter rewrite
- Post-chapter state extraction (threads, characters, scenes)
- Streaming events emission

Copy relevant test cases from `book-service.test.ts` that test chapter writing specifically (lines covering writeNextChapter behavior).

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/core/aggregates/chapter/ tests/core/aggregates/chapter-aggregate.test.ts packages/backend/src/core/book-service.ts packages/backend/src/core/aggregates/index.ts
git commit -m "refactor: extract Chapter aggregate from book-service"
```

---

## Task 4: Extract NarrativeWorld Aggregate

**Goal:** Extract story bible, character arcs, relationship edges, world rules management into a NarrativeWorld aggregate. This is primarily read/write data management — straightforward extraction.

**Files:**
- Create: `packages/backend/src/core/aggregates/narrative-world/narrative-world-aggregate.ts`
- Create: `packages/backend/src/core/aggregates/narrative-world/index.ts`
- Create: `tests/core/aggregates/narrative-world-aggregate.test.ts`
- Modify: `packages/backend/src/core/aggregates/index.ts`
- Modify: `packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts` (consume narrative-world for reads)

- [ ] **Step 1: Write failing test for NarrativeWorld aggregate**

Create `tests/core/aggregates/narrative-world-aggregate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createNarrativeWorldAggregate } from '@story-weaver/backend/core/aggregates/narrative-world';

describe('createNarrativeWorldAggregate', () => {
  it('saves and retrieves a narrative bible', () => {
    const db = createDatabase(':memory:');
    // Use the narrative repositories created in storage layer
    const aggregate = createNarrativeWorldAggregate({
      storyBibles: { saveGraph: vi.fn(), getByBook: vi.fn().mockReturnValue(null) },
      characterArcs: { listByBook: vi.fn().mockReturnValue([]) },
      relationshipEdges: { listByBook: vi.fn().mockReturnValue([]) },
      worldRules: { listByBook: vi.fn().mockReturnValue([]) },
      narrativeThreads: { listByBook: vi.fn().mockReturnValue([]) },
    });

    const bible = {
      premise: 'A hero rises',
      themeQuestion: 'What makes a hero?',
      themeAnswerDirection: 'Sacrifice',
      characterArcs: [],
      relationshipEdges: [],
      worldRules: [],
      narrativeThreads: [],
    };

    aggregate.loadBible('book-1', bible);
    expect(aggregate.storyBibles.saveGraph).toHaveBeenCalledWith('book-1', bible);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/aggregates/narrative-world-aggregate.test.ts`
Expected: FAIL

- [ ] **Step 3: Create narrative-world-aggregate.ts**

The aggregate wraps read/write operations for narrative entities. Methods:
- `loadBible(bookId, bible)` — saves narrative bible from outline generation
- `getBible(bookId)` — retrieves bible for chapter context
- `listCharacterArcs(bookId)` / `listRelationshipEdges(bookId)` / `listWorldRules(bookId)` / `listNarrativeThreads(bookId)` — read queries
- `saveCharacterState(input)` / `saveRelationshipState(input)` / `upsertNarrativeThread(...)` / `resolveNarrativeThread(...)` — post-chapter updates

This is a thin facade over the existing repositories, grouping related data access.

```typescript
export function createNarrativeWorldAggregate(deps: {
  storyBibles?: { saveGraph: (bookId: string, bible: any) => void; getByBook?: (bookId: string) => any | null };
  characterArcs?: { listByBook: (bookId: string) => any[]; saveState?: (input: any) => void };
  relationshipEdges?: { listByBook: (bookId: string) => any[] };
  relationshipStates?: { save: (input: any) => void };
  worldRules?: { listByBook: (bookId: string) => any[] };
  narrativeThreads?: { listByBook: (bookId: string) => any[]; upsertThread?: (bookId: string, thread: any) => void; resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void };
}) {
  return {
    loadBible(bookId: string, bible: any) { deps.storyBibles?.saveGraph(bookId, bible); },
    getBible(bookId: string) { return deps.storyBibles?.getByBook?.(bookId) ?? null; },
    listCharacterArcs(bookId: string) { return deps.characterArcs?.listByBook(bookId) ?? []; },
    listRelationshipEdges(bookId: string) { return deps.relationshipEdges?.listByBook(bookId) ?? []; },
    listWorldRules(bookId: string) { return deps.worldRules?.listByBook(bookId) ?? []; },
    listNarrativeThreads(bookId: string) { return deps.narrativeThreads?.listByBook(bookId) ?? []; },
    saveCharacterState(input: any) { deps.characterArcs?.saveState?.(input); },
    saveRelationshipState(input: any) { deps.relationshipStates?.save(input); },
    upsertNarrativeThread(bookId: string, thread: any) { deps.narrativeThreads?.upsertThread?.(bookId, thread); },
    resolveNarrativeThread(bookId: string, threadId: string, resolvedAt: number) { deps.narrativeThreads?.resolveThread?.(bookId, threadId, resolvedAt); },
  };
}
```

- [ ] **Step 4: Create index.ts, update aggregates/index.ts**

Create `packages/backend/src/core/aggregates/narrative-world/index.ts`:

```typescript
export { createNarrativeWorldAggregate } from './narrative-world-aggregate.js';
```

Update `packages/backend/src/core/aggregates/index.ts`.

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run tests/core/aggregates/narrative-world-aggregate.test.ts`
Expected: PASS

Run: `pnpm exec vitest run tests/core/book-service.test.ts`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/core/aggregates/narrative-world/ tests/core/aggregates/narrative-world-aggregate.test.ts packages/backend/src/core/aggregates/index.ts
git commit -m "refactor: extract NarrativeWorld aggregate"
```

---

## Task 5: Extract StoryPlan Aggregate

**Goal:** Extract volume plans, chapter cards, tension budgets management into a StoryPlan aggregate.

**Files:**
- Create: `packages/backend/src/core/aggregates/story-plan/story-plan-aggregate.ts`
- Create: `packages/backend/src/core/aggregates/story-plan/index.ts`
- Create: `tests/core/aggregates/story-plan-aggregate.test.ts`
- Modify: `packages/backend/src/core/aggregates/index.ts`

- [ ] **Step 1: Write failing test for StoryPlan aggregate**

Create `tests/core/aggregates/story-plan-aggregate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createStoryPlanAggregate } from '@story-weaver/backend/core/aggregates/story-plan';

describe('createStoryPlanAggregate', () => {
  it('saves volume plans and chapter cards from an outline bundle', () => {
    const volumePlans = { upsertMany: vi.fn() };
    const chapterCards = { upsertMany: vi.fn() };
    const chapterTensionBudgets = { upsertMany: vi.fn() };

    const aggregate = createStoryPlanAggregate({ volumePlans, chapterCards, chapterTensionBudgets });

    const bundle = {
      volumePlans: [{ volumeIndex: 1, title: 'Vol 1', chapterStart: 1, chapterEnd: 10, promisedPayoff: 'climax' }],
      chapterCards: [{ bookId: 'b1', volumeIndex: 1, chapterIndex: 1, plotFunction: 'setup', mustChange: 'change', externalConflict: 'ext', internalConflict: 'int', relationshipChange: 'rel', endingHook: 'hook', readerReward: 'reward' }],
      chapterTensionBudgets: [{ bookId: 'b1', volumeIndex: 1, chapterIndex: 1, tensionLevel: 5, tensionType: 'rising' }],
    };

    aggregate.createFromBundle('b1', bundle);

    expect(volumePlans.upsertMany).toHaveBeenCalledWith('b1', bundle.volumePlans);
    expect(chapterCards.upsertMany).toHaveBeenCalledWith(bundle.chapterCards);
    expect(chapterTensionBudgets.upsertMany).toHaveBeenCalledWith(bundle.chapterTensionBudgets);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/aggregates/story-plan-aggregate.test.ts`
Expected: FAIL

- [ ] **Step 3: Create story-plan-aggregate.ts**

Extract the post-outline-saving logic from `startBook()` (lines 1075–1125 in book-service.ts). Methods:
- `createFromBundle(bookId, outlineBundle)` — saves volume plans, chapter cards, tension budgets, thread actions, character pressures, relationship actions
- `listChapterCards(bookId)` / `getNextUnwritten(bookId)` — read queries
- `listTensionBudgets(bookId)` / `getTensionBudgetByChapter(...)` — read queries
- `listThreadActions(...)` / `listCharacterPressures(...)` / `listRelationshipActions(...)` — read queries

```typescript
export function createStoryPlanAggregate(deps: {
  volumePlans?: { upsertMany: (bookId: string, plans: any[]) => void; listByBook?: (bookId: string) => any[] };
  chapterCards?: {
    upsertMany: (cards: any[]) => void;
    getNextUnwritten?: (bookId: string) => any | null;
    listByBook?: (bookId: string) => any[];
    upsertThreadActions?: (bookId: string, v: number, c: number, actions: any[]) => void;
    listThreadActions?: (bookId: string, v: number, c: number) => any[];
    upsertCharacterPressures?: (bookId: string, v: number, c: number, pressures: any[]) => void;
    listCharacterPressures?: (bookId: string, v: number, c: number) => any[];
    upsertRelationshipActions?: (bookId: string, v: number, c: number, actions: any[]) => void;
    listRelationshipActions?: (bookId: string, v: number, c: number) => any[];
  };
  chapterTensionBudgets?: {
    upsertMany: (budgets: any[]) => void;
    getByChapter?: (bookId: string, v: number, c: number) => any | null;
    listByBook?: (bookId: string) => any[];
  };
}) {
  return {
    createFromBundle(bookId: string, bundle: { volumePlans?: any[]; chapterCards?: any[]; chapterTensionBudgets?: any[]; chapterThreadActions?: any[]; chapterCharacterPressures?: any[]; chapterRelationshipActions?: any[] }) {
      if (bundle.volumePlans) deps.volumePlans?.upsertMany(bookId, bundle.volumePlans);
      if (bundle.chapterCards) {
        deps.chapterCards?.upsertMany(bundle.chapterCards);
        for (const card of bundle.chapterCards) {
          const threadActions = (bundle.chapterThreadActions ?? []).filter(
            (a) => a.volumeIndex === card.volumeIndex && a.chapterIndex === card.chapterIndex
          );
          const characterPressures = (bundle.chapterCharacterPressures ?? []).filter(
            (p) => p.volumeIndex === card.volumeIndex && p.chapterIndex === card.chapterIndex
          );
          const relationshipActions = (bundle.chapterRelationshipActions ?? []).filter(
            (a) => a.volumeIndex === card.volumeIndex && a.chapterIndex === card.chapterIndex
          );
          deps.chapterCards?.upsertThreadActions?.(bookId, card.volumeIndex, card.chapterIndex, threadActions);
          deps.chapterCards?.upsertCharacterPressures?.(bookId, card.volumeIndex, card.chapterIndex, characterPressures);
          deps.chapterCards?.upsertRelationshipActions?.(bookId, card.volumeIndex, card.chapterIndex, relationshipActions);
        }
      }
      if (bundle.chapterTensionBudgets?.length) deps.chapterTensionBudgets?.upsertMany(bundle.chapterTensionBudgets);
    },
    listChapterCards(bookId: string) { return deps.chapterCards?.listByBook?.(bookId) ?? []; },
    getNextUnwritten(bookId: string) { return deps.chapterCards?.getNextUnwritten?.(bookId) ?? null; },
    listTensionBudgets(bookId: string) { return deps.chapterTensionBudgets?.listByBook?.(bookId) ?? []; },
    getTensionBudgetByChapter(bookId: string, v: number, c: number) { return deps.chapterTensionBudgets?.getByChapter?.(bookId, v, c) ?? null; },
    listThreadActions(bookId: string, v: number, c: number) { return deps.chapterCards?.listThreadActions?.(bookId, v, c) ?? []; },
    listCharacterPressures(bookId: string, v: number, c: number) { return deps.chapterCards?.listCharacterPressures?.(bookId, v, c) ?? []; },
    listRelationshipActions(bookId: string, v: number, c: number) { return deps.chapterCards?.listRelationshipActions?.(bookId, v, c) ?? []; },
  };
}
```

- [ ] **Step 4: Create index.ts, update barrel**

Create `packages/backend/src/core/aggregates/story-plan/index.ts` and update `packages/backend/src/core/aggregates/index.ts`.

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run tests/core/aggregates/story-plan-aggregate.test.ts`
Expected: PASS

Run: `pnpm exec vitest run tests/core/book-service.test.ts`
Expected: All existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/core/aggregates/story-plan/ tests/core/aggregates/story-plan-aggregate.test.ts packages/backend/src/core/aggregates/index.ts
git commit -m "refactor: extract StoryPlan aggregate"
```

---

## Task 6: Extract Continuity Aggregate

**Goal:** Extract post-chapter state tracking (plot threads, scene records, character states, relationship states, checkpoints) into a Continuity aggregate.

**Files:**
- Create: `packages/backend/src/core/aggregates/continuity/continuity-aggregate.ts`
- Create: `packages/backend/src/core/aggregates/continuity/index.ts`
- Create: `tests/core/aggregates/continuity-aggregate.test.ts`
- Modify: `packages/backend/src/core/aggregates/index.ts`

- [ ] **Step 1: Write failing test for Continuity aggregate**

Create `tests/core/aggregates/continuity-aggregate.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createContinuityAggregate } from '@story-weaver/backend/core/aggregates/continuity';

describe('createContinuityAggregate', () => {
  it('updates plot threads, character states, and scene records from a chapter update', () => {
    const plotThreads = { upsertThread: vi.fn(), resolveThread: vi.fn() };
    const characters = { saveState: vi.fn() };
    const sceneRecords = { save: vi.fn() };

    const aggregate = createContinuityAggregate({ plotThreads, characters, sceneRecords });

    aggregate.updateFromChapter('book-1', 1, 1, {
      summary: 'A hero appears',
      openedThreads: [{ id: 't1', description: 'mystery', plantedAt: 1 }],
      resolvedThreadIds: [],
      characterStates: [{ characterId: 'c1', characterName: 'Hero', location: 'castle' }],
      scene: { location: 'castle', timeInStory: 'dawn', charactersPresent: ['Hero'] },
    });

    expect(plotThreads.upsertThread).toHaveBeenCalled();
    expect(characters.saveState).toHaveBeenCalled();
    expect(sceneRecords.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/aggregates/continuity-aggregate.test.ts`
Expected: FAIL

- [ ] **Step 3: Create continuity-aggregate.ts**

Extract post-chapter saving logic from `writeNextChapter()` (book-service.ts lines ~1527–1550). Methods:
- `updateFromChapter(bookId, volumeIndex, chapterIndex, update)` — saves threads, characters, scenes
- `buildContext(bookId, chapter)` — builds continuity context using `buildStoredChapterContext`
- `clearByBook(bookId)` — clears all continuity data for a book restart

```typescript
import { buildStoredChapterContext } from '../../consistency.js';

export function createContinuityAggregate(deps: {
  plotThreads: { upsertThread: (input: any) => void; resolveThread: (bookId: string, id: string, resolvedAt: number) => void; listByBook: (bookId: string) => any[]; clearByBook: (bookId: string) => void };
  sceneRecords: { save: (input: any) => void; getLatestByBook: (bookId: string) => any | null; clearByBook: (bookId: string) => void };
  characters: { saveState: (input: any) => void; listLatestStatesByBook: (bookId: string) => any[]; clearStatesByBook: (bookId: string) => void; deleteByBook: (bookId: string) => void };
  characterArcs?: { saveState?: (input: any) => void };
  relationshipStates?: { save: (input: any) => void };
  narrativeThreads?: { upsertThread?: (bookId: string, thread: any) => void; resolveThread?: (bookId: string, threadId: string, resolvedAt: number) => void };
  narrativeCheckpoint?: { reviewCheckpoint: (input: any) => Promise<any> };
  narrativeCheckpoints?: { save: (input: any) => void };
  narrativeStateExtractor?: { extractState: (input: any) => Promise<any> };
  worldRules?: { listByBook: (bookId: string) => any[] };
  relationshipEdges?: { listByBook: (bookId: string) => any[] };
}) {
  return {
    updateFromChapter(bookId: string, volumeIndex: number, chapterIndex: number, update: {
      openedThreads: Array<{ id: string; description: string; plantedAt: number; expectedPayoff?: number | null; importance?: string | null }>;
      resolvedThreadIds: string[];
      characterStates: Array<{ characterId: string; characterName: string; location?: string | null; status?: string | null; knowledge?: string | null; emotion?: string | null; powerLevel?: string | null }>;
      scene: { location: string; timeInStory: string; charactersPresent: string[]; events?: string | null } | null;
    }) {
      for (const thread of update.openedThreads) {
        deps.plotThreads.upsertThread({ id: thread.id, bookId, description: thread.description, plantedAt: thread.plantedAt, expectedPayoff: thread.expectedPayoff ?? null, importance: thread.importance ?? null });
      }
      for (const id of update.resolvedThreadIds) {
        deps.plotThreads.resolveThread(bookId, id, chapterIndex);
      }
      for (const state of update.characterStates) {
        deps.characters.saveState({ bookId, characterId: state.characterId, characterName: state.characterName, volumeIndex, chapterIndex, location: state.location ?? null, status: state.status ?? null, knowledge: state.knowledge ?? null, emotion: state.emotion ?? null, powerLevel: state.powerLevel ?? null });
      }
      if (update.scene) {
        deps.sceneRecords.save({ bookId, volumeIndex, chapterIndex, location: update.scene.location, timeInStory: update.scene.timeInStory, charactersPresent: update.scene.charactersPresent, events: update.scene.events ?? null });
      }
    },
    clearByBook(bookId: string) {
      deps.plotThreads.clearByBook(bookId);
      deps.sceneRecords.clearByBook(bookId);
      deps.characters.clearStatesByBook(bookId);
    },
  };
}
```

- [ ] **Step 4: Create index.ts, update barrel**

Create `packages/backend/src/core/aggregates/continuity/index.ts` and update `packages/backend/src/core/aggregates/index.ts`.

- [ ] **Step 5: Run tests**

Run: `pnpm exec vitest run tests/core/aggregates/continuity-aggregate.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/core/aggregates/continuity/ tests/core/aggregates/continuity-aggregate.test.ts packages/backend/src/core/aggregates/index.ts
git commit -m "refactor: extract Continuity aggregate"
```

---

## Task 7: Create Orchestrator and Final Wiring

**Goal:** Replace the thinning `book-service.ts` with a `BookOrchestrator` that coordinates all aggregates. Update `create-runtime-services.ts` to wire aggregates.

**Files:**
- Create: `packages/backend/src/core/orchestrator.ts`
- Create: `tests/core/orchestrator.test.ts`
- Modify: `packages/backend/src/runtime/create-runtime-services.ts`
- Modify: `packages/backend/src/core/book-service.ts` (final thinning — re-exports from orchestrator or becomes a thin wrapper)

- [ ] **Step 1: Write failing test for Orchestrator**

Create `tests/core/orchestrator.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createProgressRepository } from '@story-weaver/backend/storage/progress';
import { createBookOrchestrator } from '@story-weaver/backend/core/orchestrator';

describe('createBookOrchestrator', () => {
  it('creates a book via the book aggregate', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);
    const progress = createProgressRepository(db);

    const orchestrator = createBookOrchestrator({
      bookAggregate: { createBook: vi.fn().mockReturnValue('book-1'), listBooks: vi.fn().mockReturnValue([]) },
      // other aggregates are stubs for this test
      outlineAggregate: { generateFromIdea: vi.fn() },
      chapterAggregate: { writeNext: vi.fn() },
      continuityAggregate: { updateFromChapter: vi.fn(), clearByBook: vi.fn() },
      storyPlanAggregate: { createFromBundle: vi.fn() },
      narrativeWorldAggregate: { loadBible: vi.fn() },
    });

    // The orchestrator delegates to aggregates
    const bookId = orchestrator.createBook({ idea: 'test', targetChapters: 10, wordsPerChapter: 2500 });
    expect(bookId).toBe('book-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/core/orchestrator.test.ts`
Expected: FAIL

- [ ] **Step 3: Create orchestrator.ts**

The orchestrator is a thin coordinator. It delegates to aggregates and handles cross-aggregate workflows:

```typescript
import type { BookRecord } from '@story-weaver/shared/contracts';

export function createBookOrchestrator(deps: {
  bookAggregate: {
    createBook: (input: { idea: string; targetChapters: number; wordsPerChapter: number; viralStrategy?: BookRecord['viralStrategy'] }) => string;
    listBooks: () => any[];
    getBookDetail: (bookId: string) => any;
    pauseBook: (bookId: string) => void;
    deleteBook: (bookId: string) => void;
    restartBook: (bookId: string) => Promise<{ completedChapters: number; status: string }>;
  };
  outlineAggregate: {
    generateFromIdea: (bookId: string) => Promise<void>;
  };
  chapterAggregate: {
    writeNext: (bookId: string) => Promise<{ content: string; usage?: any } | { deleted: true } | { paused: true }>;
  };
  continuityAggregate: {
    clearByBook: (bookId: string) => void;
  };
  storyPlanAggregate: {
    createFromBundle: (bookId: string, bundle: any) => void;
  };
  narrativeWorldAggregate: {
    loadBible: (bookId: string, bible: any) => void;
  };
}) {
  return {
    createBook: deps.bookAggregate.createBook,
    listBooks: deps.bookAggregate.listBooks,
    getBookDetail: deps.bookAggregate.getBookDetail,
    pauseBook: deps.bookAggregate.pauseBook,
    deleteBook: deps.bookAggregate.deleteBook,
    restartBook: deps.bookAggregate.restartBook,

    async startBook(bookId: string) {
      await deps.outlineAggregate.generateFromIdea(bookId);
    },

    async writeNextChapter(bookId: string) {
      return deps.chapterAggregate.writeNext(bookId);
    },

    async writeRemainingChapters(bookId: string) {
      // Loop: keep writing until done, paused, or deleted
      let completedChapters = 0;
      let status: string = 'writing';
      while (true) {
        const result = await deps.chapterAggregate.writeNext(bookId);
        if ('deleted' in result) return { completedChapters, status: 'deleted' as const };
        if ('paused' in result) return { completedChapters, status: 'paused' as const };
        completedChapters++;
      }
    },

    async resumeBook(bookId: string) {
      return this.writeRemainingChapters(bookId);
    },
  };
}
```

- [ ] **Step 4: Run orchestrator test**

Run: `pnpm exec vitest run tests/core/orchestrator.test.ts`
Expected: PASS

- [ ] **Step 5: Update create-runtime-services.ts**

In `packages/backend/src/runtime/create-runtime-services.ts`:
1. Import all aggregate factory functions
2. Create each aggregate with the appropriate repository slices
3. Create the orchestrator with the aggregates
4. Expose the orchestrator as `bookService` (or alongside it during transition)

The wiring replaces the current `createBookService(deps)` call with:

```typescript
const bookAggregate = createBookAggregate({ books, chapters, progress });
const narrativeWorldAggregate = createNarrativeWorldAggregate({ storyBibles, characterArcs, relationshipEdges, worldRules, narrativeThreads, relationshipStates });
const storyPlanAggregate = createStoryPlanAggregate({ volumePlans, chapterCards, chapterTensionBudgets });
const continuityAggregate = createContinuityAggregate({ plotThreads, sceneRecords, characters, characterArcs, relationshipStates, narrativeThreads, ... });
const outlineAggregate = createOutlineAggregate({ books, chapters, progress, outlineService, storyBibles, volumePlans, chapterCards, chapterTensionBudgets, resolveModelId: aiServices.resolveModelId, onBookUpdated, onGenerationEvent });
const chapterAggregate = createChapterAggregate({ books, chapters, progress, sceneRecords, characters, plotThreads, chapterWriter, chapterAuditor, chapterRevision, summaryGenerator, ... });
const bookService = createBookOrchestrator({ bookAggregate, outlineAggregate, chapterAggregate, continuityAggregate, storyPlanAggregate, narrativeWorldAggregate });
```

- [ ] **Step 6: Run full test suite**

Run: `pnpm exec vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/core/orchestrator.ts packages/backend/src/core/aggregates/ packages/backend/src/runtime/create-runtime-services.ts tests/core/orchestrator.test.ts
git commit -m "refactor: create BookOrchestrator wiring all aggregates"
```

---

## Task 8: Final Cleanup and Documentation

**Goal:** Remove dead code from `book-service.ts`, update architecture docs, verify everything works.

**Files:**
- Modify: `packages/backend/src/core/book-service.ts` — remove or mark as deprecated
- Modify: `docs/superpowers/specs/2026-05-01-ddd-domain-model-design.md` — mark status as Implemented
- Verify: All tests pass, typecheck succeeds

- [ ] **Step 1: Verify book-service.ts is fully delegated**

If all methods now delegate to the orchestrator, `book-service.ts` can be replaced with a re-export:

```typescript
// book-service.ts — thin re-export for backward compatibility
export { createBookOrchestrator as createBookService } from './orchestrator.js';
```

Or remove it entirely and update the single import in `create-runtime-services.ts`.

- [ ] **Step 2: Run full test suite**

Run: `pnpm exec vitest run`
Expected: All tests PASS

- [ ] **Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 4: Update spec status**

In `docs/superpowers/specs/2026-05-01-ddd-domain-model-design.md`, change `Status: Draft` to `Status: Implemented`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: complete DDD aggregate extraction — book-service fully decomposed"
```
