# DDD Deep Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 3 remaining DDD hotspots: the Chapter aggregate's 560-line god method, the narrative subsystem's lack of sub-domain structure, and the 658-line runtime services factory.

**Architecture:** Three independent steps — each produces a deployable increment with all tests passing. Step 1 extracts named sub-functions from writeNext. Step 2 adds barrel index.ts files to narrative/. Step 3 extracts logging and book-runner from create-runtime-services.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, pnpm workspace

---

## Task 1: Decompose `writeNext` into Named Sub-Functions

**Goal:** Extract 7 named functions from the 560-line `writeNext` method. The public API stays identical.

**Files:**
- Modify: `packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts`

- [ ] **Step 1: Extract `findNextChapter` function**

Read `chapter-aggregate.ts` lines 545-582. Extract the chapter selection logic (lines 545-582) into a module-level async function:

```typescript
function findNextChapter(bookId: string) {
  const book = deps.books.getById(bookId);
  if (!book) throw new Error(`Book not found: ${bookId}`);
  const context = deps.books.getContext(bookId);
  const chapters = deps.chapters.listByBook(bookId);
  const chapterCards = deps.chapterCards?.listByBook?.(bookId) ?? [];
  const nextChapter = chapters.find(
    (ch) => !ch.content && (Boolean(ch.outline?.trim()) || chapterCards.some((c) => c.volumeIndex === ch.volumeIndex && c.chapterIndex === ch.chapterIndex))
  );
  if (!nextChapter) throw new Error('No outlined chapter available to write');
  const chapterCard = chapterCards.find((c) => c.volumeIndex === nextChapter.volumeIndex && c.chapterIndex === nextChapter.chapterIndex) ?? null;
  const outline = nextChapter.outline?.trim() || (chapterCard ? buildOutlineFromChapterCard(chapterCard) : '');
  const title = nextChapter.title ?? chapterCard?.title;
  if (!outline || !title) throw new Error('No outlined chapter available to write');
  return { book, context, chapters, nextChapter, chapterCard, outline, title };
}
```

Replace lines 546-582 in `writeNext` with:
```typescript
const { book, context, chapters, nextChapter, chapterCard, outline: nextChapterOutline, title: nextChapterTitle } = findNextChapter(bookId);
```

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts tests/core/book-service.test.ts`
Expected: All tests PASS.

- [ ] **Step 2: Extract `buildWriteContext` function**

Extract lines 584-713 (context building) into:

```typescript
function buildWriteContext(input: {
  bookId: string;
  book: { idea: string; wordsPerChapter: number; targetChapters: number };
  context: { worldSetting: string | null; outline: string | null } | undefined;
  chapters: ReturnType<typeof deps.chapters.listByBook>;
  nextChapter: { volumeIndex: number; chapterIndex: number; chapterIndex: number };
  chapterCard: ChapterCard | null;
  outline: string;
  title: string;
}) {
  const modelId = deps.resolveModelId();
  const storyBible = deps.storyBibles?.getByBook?.(input.bookId) ?? null;
  const effectiveChapterCard = input.chapterCard
    ? { ...input.chapterCard, title: input.title, plotFunction: input.chapterCard.plotFunction.trim() || input.outline }
    : null;
  const tensionBudget = effectiveChapterCard && deps.chapterTensionBudgets?.getByChapter
    ? deps.chapterTensionBudgets.getByChapter(input.bookId, input.nextChapter.volumeIndex, input.nextChapter.chapterIndex) : null;
  const legacyContinuityContext = buildStoredChapterContext({
    worldSetting: input.context?.worldSetting ?? null,
    characterStates: deps.characters.listLatestStatesByBook(input.bookId),
    plotThreads: deps.plotThreads.listByBook(input.bookId),
    latestScene: deps.sceneRecords.getLatestByBook(input.bookId),
    chapters: input.chapters,
    currentChapter: { volumeIndex: input.nextChapter.volumeIndex, chapterIndex: input.nextChapter.chapterIndex, outline: input.outline },
    maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
  });
  const commandContext = effectiveChapterCard ? buildNarrativeCommandContext({
    bible: { themeQuestion: storyBible?.themeQuestion ?? '', themeAnswerDirection: storyBible?.themeAnswerDirection ?? '', voiceGuide: storyBible?.voiceGuide ?? '', viralStoryProtocol: storyBible?.viralStoryProtocol ?? null },
    chapterCard: effectiveChapterCard, tensionBudget,
    hardContinuity: legacyContinuityContext.split('\n').slice(0, 20),
    characterPressures: deps.chapterCards?.listCharacterPressures?.(input.bookId, input.nextChapter.volumeIndex, input.nextChapter.chapterIndex).map((p) => `${p.characterId}: ${p.desirePressure}; ${p.fearPressure}; ${p.flawTrigger}; expected=${p.expectedChoice}`) ?? [],
    relationshipActions: deps.chapterCards?.listRelationshipActions?.(input.bookId, input.nextChapter.volumeIndex, input.nextChapter.chapterIndex).map((a) => `${a.relationshipId} ${a.action}: ${a.requiredChange}`) ?? [],
    threadActions: deps.chapterCards?.listThreadActions?.(input.bookId, input.nextChapter.volumeIndex, input.nextChapter.chapterIndex).map((a) => `${a.threadId} ${a.action}: ${a.requiredEffect}`) ?? [],
    worldRules: deps.worldRules?.listByBook(input.bookId).map((r) => `${r.id}: ${r.ruleText}; cost=${r.cost}`) ?? [],
    recentSummaries: input.chapters.filter((ch) => ch.summary).slice(-2).map((ch) => `Chapter ${ch.chapterIndex}: ${ch.summary}`),
    previousChapterEnding: null,
    maxCharacters: CHAPTER_CONTEXT_MAX_CHARACTERS,
  }) : null;
  const storyRoutePlan = routeStoryTask({ taskType: 'write_chapter', context: { hasNarrativeBible: Boolean(storyBible), hasChapterCard: Boolean(effectiveChapterCard), hasTensionBudget: Boolean(tensionBudget) } });
  const openingRetentionLines = buildOpeningRetentionContextLines(input.nextChapter.chapterIndex);
  const routePlanText = formatStoryRoutePlanForPrompt({
    ...storyRoutePlan, openingRetentionLines,
    viralProtocolLines: storyBible?.viralStoryProtocol ? [formatViralProtocolForPrompt(storyBible.viralStoryProtocol, { chapterIndex: input.nextChapter.chapterIndex })] : [],
  });
  const prompt = effectiveChapterCard
    ? buildNarrativeDraftPrompt({ idea: input.book.idea, wordsPerChapter: input.book.wordsPerChapter, commandContext: commandContext ?? legacyContinuityContext, routePlanText, viralStoryProtocol: storyBible?.viralStoryProtocol ?? null, chapterIndex: input.nextChapter.chapterIndex })
    : buildChapterDraftPrompt({ idea: input.book.idea, worldSetting: input.context?.worldSetting ?? null, masterOutline: input.context?.outline ?? null, continuityContext: legacyContinuityContext, chapterTitle: input.title, chapterOutline: input.outline, targetChapters: input.book.targetChapters, wordsPerChapter: input.book.wordsPerChapter, routePlanText });
  return { modelId, storyBible, effectiveChapterCard, commandContext, routePlanText, prompt };
}
```

Replace lines 584-713 in writeNext with:
```typescript
const { modelId, storyBible, effectiveChapterCard, commandContext, routePlanText, prompt } = buildWriteContext({ bookId, book, context, chapters, nextChapter, chapterCard, outline: nextChapterOutline, title: nextChapterTitle });
```

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: All tests PASS.

- [ ] **Step 3: Extract `writeDraft` function**

Extract lines 714-806 (draft writing + short chapter rewrite) into:

```typescript
async function writeDraft(input: {
  bookId: string; modelId: string; prompt: string; book: { wordsPerChapter: number };
  nextChapter: { volumeIndex: number; chapterIndex: number }; title: string;
}): Promise<{ result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } }; deleted: boolean; paused: boolean }> {
  // Progress + stream events (lines 714-745)
  // Short chapter rewrite (lines 761-806)
  // Pause/delete checks (lines 747-820)
  // Copy the exact logic from these lines verbatim
}
```

This function returns `{ result, deleted, paused }` — the caller checks these to decide whether to continue.

Replace lines 714-820 in writeNext with the function call and checks.

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: All tests PASS.

- [ ] **Step 4: Extract `auditAndRevise` function**

Extract lines 822-898 (audit + revision loop) into:

```typescript
async function auditAndRevise(input: {
  bookId: string; modelId: string; content: string; prompt: string;
  routePlanText: string; storyBible: { viralStoryProtocol: ViralStoryProtocol | null } | null;
  nextChapter: { volumeIndex: number; chapterIndex: number };
  effectiveChapterCard: ChapterCard | null; commandContext: string | null; legacyContinuityContext: string;
}): Promise<{ content: string; auditScore: number | null; draftAttempts: number }>
```

Replace lines 822-898 in writeNext with the function call.

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Extract `extractAndSaveContinuity` function**

Extract lines 900-973 (continuity extraction + persistence) into:

```typescript
async function extractAndSaveContinuity(input: {
  bookId: string; modelId: string; content: string;
  nextChapter: { volumeIndex: number; chapterIndex: number };
  auditScore: number | null; draftAttempts: number;
}): Promise<{ deleted: boolean }>
```

Returns `{ deleted: true }` if book was deleted during extraction. The caller checks this.

Replace lines 900-973 in writeNext with the function call + delete check.

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Extract `extractNarrativeState` function**

Extract lines 975-1024 (narrative state extraction) into:

```typescript
async function extractNarrativeState(input: {
  bookId: string; modelId: string; content: string;
  nextChapter: { volumeIndex: number; chapterIndex: number };
}): Promise<void>
```

Replace lines 975-1024 in writeNext with the function call.

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts`
Expected: All tests PASS.

- [ ] **Step 7: Extract `runCheckpoint` function**

Extract lines 1026-1075 (checkpoint review) into:

```typescript
async function runCheckpoint(input: {
  bookId: string; nextChapter: { volumeIndex: number; chapterIndex: number };
}): Promise<void>
```

Replace lines 1026-1075 in writeNext with the function call.

Run: `pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts tests/core/book-service.test.ts`
Expected: All tests PASS.

- [ ] **Step 8: Verify `writeNext` is now a thin coordinator**

After all extractions, `writeNext` should be ~50-60 lines: find chapter → build context → write draft → audit → extract continuity → extract state → checkpoint → completion. Each step is a single function call.

Run: `pnpm exec vitest run` (full suite)
Expected: All 543 tests PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts
git commit -m "refactor: decompose writeNext into named sub-functions"
```

---

## Task 2: Add Narrative Sub-Domain Barrel Exports

**Goal:** Add 4 `index.ts` barrel files to `narrative/` that group related modules by sub-domain.

**Files:**
- Create: `packages/backend/src/core/narrative/story-bible/index.ts`
- Create: `packages/backend/src/core/narrative/chapter-planning/index.ts`
- Create: `packages/backend/src/core/narrative/writing/index.ts`
- Create: `packages/backend/src/core/narrative/quality/index.ts`

- [ ] **Step 1: Create `story-bible/index.ts`**

```bash
mkdir -p packages/backend/src/core/narrative/story-bible packages/backend/src/core/narrative/chapter-planning packages/backend/src/core/narrative/writing packages/backend/src/core/narrative/quality
```

Create `packages/backend/src/core/narrative/story-bible/index.ts`:

```typescript
// Story Bible sub-domain — character arcs, relationships, world rules, threads, viral strategy
export { validateNarrativeBible } from '../validation.js';
export { deriveViralStoryProtocol, validateViralStoryProtocol, getExpectedPayoffForChapter, formatViralProtocolForPrompt } from '../viral-story-protocol.js';
```

- [ ] **Step 2: Create `chapter-planning/index.ts`**

Create `packages/backend/src/core/narrative/chapter-planning/index.ts`:

```typescript
// Chapter Planning sub-domain — volume plans, chapter cards, tension budgets
export { validateVolumePlans, validateChapterCards, validateTensionBudgets } from '../validation.js';
export { buildVolumePlanPrompt, buildChapterCardPrompt, buildTensionBudgetPrompt } from '../prompts.js';
```

- [ ] **Step 3: Create `writing/index.ts`**

Create `packages/backend/src/core/narrative/writing/index.ts`:

```typescript
// Writing sub-domain — draft prompts, context assembly, text policies
export { buildNarrativeDraftPrompt, buildNarrativeBiblePrompt, parseJsonObject } from '../prompts.js';
export { buildNarrativeCommandContext } from '../context.js';
export { buildAiFirstTextPolicyLines, buildPlainChineseOutputPolicyLines, buildJsonOutputPolicyLines } from '../text-policy.js';
export { stripCodeFences, buildJsonRepairPrompt } from '../json.js';
```

- [ ] **Step 4: Create `quality/index.ts`**

Create `packages/backend/src/core/narrative/quality/index.ts`:

```typescript
// Quality Assurance sub-domain — audit decisions, checkpoints, state normalization, opening retention
export { decideAuditAction } from '../audit.js';
export { shouldRunCheckpoint, shouldRunNarrativeCheckpoint, buildTensionCheckpoint } from '../checkpoint.js';
export { normalizeNarrativeStateDelta } from '../state.js';
export { getOpeningRetentionPhase, buildOpeningRetentionProtocolLines, buildOpeningRetentionContextLines } from '../opening-retention.js';
export { buildChapterAuditPrompt, buildRevisionPrompt } from '../prompts.js';
```

- [ ] **Step 5: Verify existing imports still work**

No existing imports need to change — the barrels are opt-in. Run the full suite:

Run: `pnpm exec vitest run`
Expected: All 543 tests PASS.

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/core/narrative/story-bible/ packages/backend/src/core/narrative/chapter-planning/ packages/backend/src/core/narrative/writing/ packages/backend/src/core/narrative/quality/
git commit -m "refactor: add narrative sub-domain barrel exports"
```

---

## Task 3: Extract Runtime Services Sub-Modules

**Goal:** Extract logging infrastructure and book runner logic from the 658-line `create-runtime-services.ts` into focused modules.

**Files:**
- Create: `packages/backend/src/runtime/create-logging-service.ts`
- Create: `packages/backend/src/runtime/create-book-runner.ts`
- Modify: `packages/backend/src/runtime/create-runtime-services.ts`

- [ ] **Step 1: Read the current `create-runtime-services.ts`**

Read the full file at `packages/backend/src/runtime/create-runtime-services.ts`. Identify the exact sections to extract:

- Logging (lines ~134-241): `getBookSnapshot`, `logExecution`, `classifyProgressEvent`, `logGenerationEvent`
- Book runner (lines ~292-376): `markBookErrored`, `runBook`, `continueBook`, `registerBackgroundRunner`

- [ ] **Step 2: Create `create-logging-service.ts`**

Extract the logging functions. The module exports a factory that takes dependencies and returns logging functions:

```typescript
import type { BookGenerationEvent } from '@story-weaver/shared/contracts';

export function createLoggingService(deps: {
  books: { getById: (bookId: string) => { title: string } | undefined };
  logs: { emit: (entry: any) => void };
}) {
  function getBookSnapshot(bookId: string) {
    const book = deps.books.getById(bookId);
    return { bookId, bookTitle: book?.title ?? null };
  }

  function logExecution(input: {
    bookId?: string | null; level: 'info' | 'success' | 'error'; eventType: string;
    phase?: string | null; message: string; volumeIndex?: number | null;
    chapterIndex?: number | null; errorMessage?: string | null;
  }) {
    deps.logs.emit({
      ...(input.bookId ? getBookSnapshot(input.bookId) : {}),
      level: input.level, eventType: input.eventType, phase: input.phase ?? null,
      message: input.message, volumeIndex: input.volumeIndex ?? null,
      chapterIndex: input.chapterIndex ?? null, errorMessage: input.errorMessage ?? null,
    });
  }

  function classifyProgressEvent(event: Extract<BookGenerationEvent, { type: 'progress' }>) {
    // Copy the exact switch/if chain from create-runtime-services.ts lines ~165-201
    if (event.phase === 'naming_title') return 'book_title_generation';
    // ... all the same cases
    return 'book_progress';
  }

  function logGenerationEvent(event: BookGenerationEvent) {
    // Copy exact logic from create-runtime-services.ts lines ~203-241
  }

  return { logExecution, classifyProgressEvent, logGenerationEvent };
}
```

Copy the EXACT implementation from `create-runtime-services.ts` — do not simplify.

- [ ] **Step 3: Create `create-book-runner.ts`**

Extract the book execution functions:

```typescript
export function createBookRunner(deps: {
  books: { getById: (bookId: string) => any; updateStatus: (bookId: string, status: any) => void };
  progress: { updatePhase: (...args: any[]) => void };
  bookService: { startBook: (bookId: string) => Promise<void>; writeRemainingChapters: (bookId: string) => Promise<any> };
  logExecution: (input: any) => void;
  emitSchedulerStatus: () => void;
  emitBookGeneration: (event: any) => void;
  scheduler: { start: (bookId: string) => Promise<void> };
  registerBackgroundRunner: (bookId: string, runner: Promise<void>) => void;
}) {
  function markBookErrored(bookId: string, error: unknown) {
    // Copy exact logic from create-runtime-services.ts
  }

  async function runBook(bookId: string) {
    // Copy exact logic
  }

  async function continueBook(bookId: string) {
    // Copy exact logic
  }

  return { markBookErrored, runBook, continueBook };
}
```

Copy the EXACT implementations. The functions are moved, not rewritten.

- [ ] **Step 4: Update `create-runtime-services.ts`**

Replace the extracted code with imports and calls:

```typescript
import { createLoggingService } from './create-logging-service.js';
import { createBookRunner } from './create-book-runner.js';
```

Inside the factory:
```typescript
const logging = createLoggingService({ books, logs });
const bookRunner = createBookRunner({ books, progress, bookService, logExecution: logging.logExecution, ... });
```

Replace inline calls to `logExecution`, `classifyProgressEvent`, `logGenerationEvent` with `logging.logExecution`, etc.
Replace inline `markBookErrored`, `runBook`, `continueBook` with `bookRunner.markBookErrored`, etc.

- [ ] **Step 5: Run all tests**

Run: `pnpm exec vitest run`
Expected: All 543 tests PASS.

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/runtime/
git commit -m "refactor: extract logging service and book runner from runtime services"
```
