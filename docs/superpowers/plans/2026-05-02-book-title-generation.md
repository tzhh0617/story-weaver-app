# Book Title Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional creation-time book titles, explicit title generation status, and title-aware generation prompts.

**Architecture:** Store title generation state on the `books` row and make backend creation the source of truth for whether a title is manual or pending. The outline aggregate generates a title only when `titleGenerationStatus === 'pending'`, then passes the final title into outline generation; prompt builders carry that title through world, bible, outline, card, budget, and draft contexts.

**Tech Stack:** TypeScript, React 19, Vite, Fastify, better-sqlite3, Drizzle schema/migrations, Vitest, Testing Library.

---

## File Structure

- `packages/shared/src/contracts.ts`: Add `BookTitleGenerationStatus`, expose it on `BookRecord`, and allow optional `title` on `BookCreatePayload`.
- `packages/shared/src/schemas/book-schemas.ts`: Validate optional create-time `title`.
- `packages/backend/src/storage/schema.ts`: Add `title_generation_status` to Drizzle's `books` table definition.
- `drizzle/*.sql` and `drizzle/meta/*`: Add one migration that backfills existing rows to `generated`.
- `packages/backend/src/storage/books.ts`: Persist, read, and update `titleGenerationStatus`.
- `packages/backend/src/core/aggregates/book/book-aggregate.ts`: Trim optional title and set `manual` or `pending`.
- `packages/backend/src/core/aggregates/book/book-aggregate-deps.ts`: Extend repository dependency typing.
- `packages/backend/src/core/aggregates/outline/outline-aggregate.ts`: Gate title generation on status, mark generated, and pass final title into later generation.
- `packages/backend/src/core/aggregates/outline/outline-aggregate-deps.ts`: Extend dependency types for title status.
- `packages/backend/src/core/types.ts`: Add `title` to `OutlineGenerationInput`.
- `packages/backend/src/core/prompt-builder.ts`: Make legacy prompt builders title-aware and strengthen `buildTitlePrompt`.
- `packages/backend/src/core/narrative/prompts.ts`: Add optional title input to narrative bible, volume plan, chapter card, tension budget, and draft prompt builders.
- `packages/backend/src/core/ai-outline/bible-based-outline-generator.ts`: Pass title into narrative prompt builders.
- `packages/backend/src/core/ai-outline/fallback-outline-generator.ts`: Pass title into legacy prompt builders.
- `packages/backend/src/core/aggregates/chapter/context-builder.ts`: Add `book.title` to the write-context input and pass it into both draft prompt builders.
- `packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts`: Pass the loaded book title into `buildWriteContext()`.
- `packages/frontend/src/pages/NewBook.tsx`: Add optional title input and submit trimmed title only when non-empty.
- `packages/frontend/src/pages/NewBookRoute.tsx`: Type the new payload and choose the correct creation toast.
- Tests under `tests/shared`, `tests/storage`, `tests/core`, and `tests/renderer`.

## Task 1: Shared Contract And Schema

**Files:**
- Modify: `packages/shared/src/contracts.ts`
- Modify: `packages/shared/src/schemas/book-schemas.ts`
- Test: `tests/shared/schemas.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add these tests inside `describe('book schemas', ...)` in `tests/shared/schemas.test.ts`:

```ts
it('BookCreateSchema accepts an optional title', () => {
  const result = BookCreateSchema.safeParse({
    title: '月税奇谈',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });

  expect(result.success).toBe(true);
  expect(result.data).toMatchObject({ title: '月税奇谈' });
});

it('BookCreateSchema rejects a non-string title', () => {
  const result = BookCreateSchema.safeParse({
    title: 123,
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });

  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run schema tests and verify red**

Run:

```bash
pnpm exec vitest run tests/shared/schemas.test.ts
```

Expected: the optional-title acceptance test fails because `title` is stripped from parsed data.

- [ ] **Step 3: Implement shared types and schema**

In `packages/shared/src/contracts.ts`, add:

```ts
export type BookTitleGenerationStatus = 'manual' | 'pending' | 'generated';
```

Extend `BookRecord`:

```ts
titleGenerationStatus: BookTitleGenerationStatus;
```

Extend `BookCreatePayload`:

```ts
title?: string;
```

In `packages/shared/src/schemas/book-schemas.ts`, update `BookCreateSchema`:

```ts
export const BookCreateSchema = z.object({
  title: z.string().optional(),
  idea: z.string(),
  targetChapters: z.number().int().positive(),
  wordsPerChapter: z.number().int().positive(),
  viralStrategy: ViralStrategySchema,
});
```

- [ ] **Step 4: Run shared tests and typecheck slice**

Run:

```bash
pnpm exec vitest run tests/shared/schemas.test.ts
pnpm run typecheck
```

Expected: schema tests pass; typecheck fails in backend/frontend files that construct or read `BookRecord` without the new field. Those failures drive Tasks 2 and 3.

## Task 2: Storage And Migration

**Files:**
- Modify: `packages/backend/src/storage/schema.ts`
- Modify: `packages/backend/src/storage/books.ts`
- Add: `drizzle/0001_book_title_generation_status.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `drizzle/meta/0001_snapshot.json`
- Test: `tests/storage/books.test.ts`

- [ ] **Step 1: Write failing repository tests**

Add these tests in `tests/storage/books.test.ts`:

```ts
it('persists title generation status on book records', () => {
  const db = createDatabase(':memory:');
  const repo = createBookRepository(db);

  repo.create({
    id: 'book-title-status',
    title: '月税奇谈',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
    titleGenerationStatus: 'manual',
  });

  expect(repo.getById('book-title-status')?.titleGenerationStatus).toBe('manual');
  expect(repo.list()[0].titleGenerationStatus).toBe('manual');
});

it('updates title generation status independently of title text', () => {
  const db = createDatabase(':memory:');
  const repo = createBookRepository(db);

  repo.create({
    id: 'book-auto-title',
    title: '新作品',
    idea: 'A city remembers every promise.',
    targetChapters: 500,
    wordsPerChapter: 2500,
    titleGenerationStatus: 'pending',
  });

  repo.updateTitleGenerationStatus('book-auto-title', 'generated');

  expect(repo.getById('book-auto-title')).toMatchObject({
    title: '新作品',
    titleGenerationStatus: 'generated',
  });
});
```

- [ ] **Step 2: Run storage tests and verify red**

Run:

```bash
pnpm exec vitest run tests/storage/books.test.ts
```

Expected: TypeScript or runtime failures because `titleGenerationStatus` and `updateTitleGenerationStatus` do not exist.

- [ ] **Step 3: Update Drizzle schema**

In `packages/backend/src/storage/schema.ts`, add this column to `books`:

```ts
titleGenerationStatus: text('title_generation_status')
  .notNull()
  .default('generated'),
```

- [ ] **Step 4: Update repository input, row mapping, inserts, and selects**

In `packages/backend/src/storage/books.ts`, expand `NewBookInput`:

```ts
type NewBookInput = Pick<
  BookRecord,
  | 'id'
  | 'title'
  | 'idea'
  | 'targetChapters'
  | 'wordsPerChapter'
  | 'viralStrategy'
  | 'titleGenerationStatus'
>;
```

Expand `BookRow`:

```ts
type BookRow = Omit<BookRecord, 'viralStrategy'> & {
  viralStrategyJson: string | null;
};
```

Add `title_generation_status` to the insert column list and `@titleGenerationStatus` to values. Add this select alias to both `list()` and `getById()`:

```sql
title_generation_status AS titleGenerationStatus,
```

Add repository method:

```ts
updateTitleGenerationStatus(
  bookId: string,
  titleGenerationStatus: BookRecord['titleGenerationStatus']
) {
  db.prepare(
    `
      UPDATE books
      SET title_generation_status = ?, updated_at = ?
      WHERE id = ?
    `
  ).run(titleGenerationStatus, new Date().toISOString(), bookId);
},
```

- [ ] **Step 5: Add migration files**

Create `drizzle/0001_book_title_generation_status.sql`:

```sql
ALTER TABLE `books` ADD `title_generation_status` text DEFAULT 'generated' NOT NULL;
```

Update `drizzle/meta/_journal.json` by appending an entry with index `1`, tag `0001_book_title_generation_status`, and a `when` timestamp greater than the existing entry.

Create `drizzle/meta/0001_snapshot.json` from the previous snapshot plus the new `books.title_generation_status` column. Confirm the snapshot follows the existing Drizzle snapshot shape.

- [ ] **Step 6: Run storage and migration tests**

Run:

```bash
pnpm exec vitest run tests/storage/books.test.ts tests/storage/migrate.test.ts tests/storage/database.test.ts
```

Expected: all selected tests pass.

## Task 3: Book Creation Domain Logic

**Files:**
- Modify: `packages/backend/src/core/aggregates/book/book-aggregate.ts`
- Modify: `packages/backend/src/core/aggregates/book/book-aggregate-deps.ts`
- Test: `tests/core/aggregates/book-aggregate.test.ts`

- [ ] **Step 1: Write failing aggregate tests**

Add these tests inside `describe('createBook', ...)`:

```ts
it('persists a manual title and marks title generation as manual', () => {
  const { aggregate } = createTestAggregate({});

  const bookId = aggregate.createBook({
    title: '月税奇谈',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });

  expect(aggregate.listBooks()[0]).toMatchObject({
    id: bookId,
    title: '月税奇谈',
    titleGenerationStatus: 'manual',
  });
});

it('marks title generation as pending when no title is provided', () => {
  const { aggregate } = createTestAggregate({});

  aggregate.createBook({
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });

  expect(aggregate.listBooks()[0]).toMatchObject({
    title: '新作品',
    titleGenerationStatus: 'pending',
  });
});

it('treats a blank title as missing', () => {
  const { aggregate } = createTestAggregate({});

  aggregate.createBook({
    title: '   ',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });

  expect(aggregate.listBooks()[0]).toMatchObject({
    title: '新作品',
    titleGenerationStatus: 'pending',
  });
});
```

- [ ] **Step 2: Run aggregate tests and verify red**

Run:

```bash
pnpm exec vitest run tests/core/aggregates/book-aggregate.test.ts
```

Expected: tests fail because `createBook` does not accept/persist title status.

- [ ] **Step 3: Implement title handling in book aggregate**

Update `createBook` input type in `book-aggregate.ts`:

```ts
title?: string;
```

Before `deps.books.create`, compute:

```ts
const title = input.title?.trim();
const hasManualTitle = Boolean(title);
```

Pass:

```ts
title: hasManualTitle ? title! : INITIAL_BOOK_TITLE,
titleGenerationStatus: hasManualTitle ? 'manual' : 'pending',
```

Update dependency typing in `book-aggregate-deps.ts` so `books.create` accepts `titleGenerationStatus`.

- [ ] **Step 4: Run aggregate tests**

Run:

```bash
pnpm exec vitest run tests/core/aggregates/book-aggregate.test.ts
```

Expected: all book aggregate tests pass.

## Task 4: Outline Title Generation Gate

**Files:**
- Modify: `packages/backend/src/core/aggregates/outline/outline-aggregate.ts`
- Modify: `packages/backend/src/core/aggregates/outline/outline-aggregate-deps.ts`
- Test: `tests/core/aggregates/outline-aggregate.test.ts`

- [ ] **Step 1: Update test setup to create pending books by default**

In `createDefaultSetup()` and `createDeletionTestSetup()` book creation calls, add:

```ts
titleGenerationStatus: 'pending',
```

- [ ] **Step 2: Write failing outline gate tests**

Add tests in `describe('generateFromIdea', ...)`:

```ts
it('does not generate a title for manual titles', async () => {
  const generateTitleFromIdea = vi.fn().mockResolvedValue('系统标题');
  const generateFromIdea = vi.fn().mockResolvedValue({
    worldSetting: 'World',
    masterOutline: 'Outline',
    volumeOutlines: [],
    chapterOutlines: [],
  });
  const { aggregate, bookId, books } = createDefaultSetup({
    outlineService: { generateTitleFromIdea, generateFromIdea },
  });
  books.updateTitle(bookId, '手填标题');
  books.updateTitleGenerationStatus(bookId, 'manual');

  await aggregate.generateFromIdea(bookId);

  expect(generateTitleFromIdea).not.toHaveBeenCalled();
  expect(books.getById(bookId)).toMatchObject({
    title: '手填标题',
    titleGenerationStatus: 'manual',
  });
});

it('marks generated title status after pending title generation', async () => {
  const generateTitleFromIdea = vi.fn().mockResolvedValue('月税奇谈');
  const { aggregate, bookId, books } = createDefaultSetup({
    outlineService: {
      generateTitleFromIdea,
      generateFromIdea: vi.fn().mockResolvedValue({
        worldSetting: 'World',
        masterOutline: 'Outline',
        volumeOutlines: [],
        chapterOutlines: [],
      }),
    },
  });

  await aggregate.generateFromIdea(bookId);

  expect(books.getById(bookId)).toMatchObject({
    title: '月税奇谈',
    titleGenerationStatus: 'generated',
  });
});

it('passes the final title into outline generation', async () => {
  const generateFromIdea = vi.fn().mockResolvedValue({
    worldSetting: 'World',
    masterOutline: 'Outline',
    volumeOutlines: [],
    chapterOutlines: [],
  });
  const { aggregate, bookId } = createDefaultSetup({
    outlineService: {
      generateTitleFromIdea: vi.fn().mockResolvedValue('月税奇谈'),
      generateFromIdea,
    },
  });

  await aggregate.generateFromIdea(bookId);

  expect(generateFromIdea).toHaveBeenCalledWith(
    expect.objectContaining({ title: '月税奇谈' })
  );
});
```

- [ ] **Step 3: Run outline tests and verify red**

Run:

```bash
pnpm exec vitest run tests/core/aggregates/outline-aggregate.test.ts
```

Expected: failures show automatic title generation is still only gated by method presence and `title` is not passed to `generateFromIdea`.

- [ ] **Step 4: Implement status-based gate**

In `outline-aggregate-deps.ts`, add `titleGenerationStatus` to `books.getById` return type and add dependency method:

```ts
updateTitleGenerationStatus: (
  bookId: string,
  titleGenerationStatus: 'manual' | 'pending' | 'generated'
) => void;
```

In `outline-aggregate.ts`, replace the current title phase condition with:

```ts
let effectiveTitle = book.title;

if (book.titleGenerationStatus === 'pending') {
  updateTrackedPhase({
    bookId,
    phase: 'naming_title',
    stepLabel: '正在生成书名',
    notifyBookUpdated: true,
  });

  const generatedTitle = deps.outlineService.generateTitleFromIdea
    ? (
        await deps.outlineService.generateTitleFromIdea({
          bookId,
          title: book.title,
          idea: book.idea,
          targetChapters: book.targetChapters,
          wordsPerChapter: book.wordsPerChapter,
          viralStrategy: (book as any).viralStrategy ?? null,
          modelId,
        })
      ).trim()
    : '';

  if (!deps.books.getById(bookId)) {
    return;
  }

  effectiveTitle = generatedTitle || deriveTitleFromIdea(book.idea);
  deps.books.updateTitle(bookId, effectiveTitle);
  deps.books.updateTitleGenerationStatus(bookId, 'generated');
  deps.onBookUpdated?.(bookId);
}
```

When calling `deps.outlineService.generateFromIdea`, include:

```ts
title: effectiveTitle,
```

- [ ] **Step 5: Run outline tests**

Run:

```bash
pnpm exec vitest run tests/core/aggregates/outline-aggregate.test.ts
```

Expected: outline aggregate tests pass.

## Task 5: Title-Aware Prompt Inputs

**Files:**
- Modify: `packages/backend/src/core/types.ts`
- Modify: `packages/backend/src/core/prompt-builder.ts`
- Modify: `packages/backend/src/core/narrative/prompts.ts`
- Modify: `packages/backend/src/core/ai-outline/bible-based-outline-generator.ts`
- Modify: `packages/backend/src/core/ai-outline/fallback-outline-generator.ts`
- Test: `tests/core/prompt-builder.test.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [ ] **Step 1: Write failing prompt tests**

In `tests/core/prompt-builder.test.ts`, add:

```ts
it('builds an attractive title prompt from idea and viral strategy', () => {
  const prompt = buildTitlePrompt({
    title: '新作品',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
    viralStrategy: {
      readerPayoff: '弱者反杀收税者',
      protagonistDesire: '夺回奇迹定价权',
      cadenceMode: 'fast',
      antiClicheDirection: '主角每次胜利都背上新债',
    },
  });

  expect(prompt).toContain('Reader payoff: 弱者反杀收税者');
  expect(prompt).toContain('Protagonist desire: 夺回奇迹定价权');
  expect(prompt).toContain('Anti-cliche direction: 主角每次胜利都背上新债');
  expect(prompt).toContain('memorable Chinese web novel title');
  expect(prompt).toContain('Avoid generic empty phrases');
});

it('includes book title in world and draft prompts', () => {
  const worldPrompt = buildWorldPrompt({
    title: '月税奇谈',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });
  const draftPrompt = buildChapterDraftPrompt({
    title: '月税奇谈',
    idea: 'A moon taxes every miracle.',
    worldSetting: 'World setting',
    masterOutline: 'Master outline',
    continuityContext: null,
    chapterTitle: 'Chapter 1',
    chapterOutline: 'Opening',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });

  expect(worldPrompt).toContain('Book title: 月税奇谈');
  expect(draftPrompt).toContain('Book title: 月税奇谈');
});
```

In `tests/core/narrative-prompts.test.ts`, add:

```ts
it('anchors narrative planning prompts to the book title', () => {
  expect(
    buildNarrativeBiblePrompt({
      title: '月税奇谈',
      idea: '一个修复命簿的人发现自己的家族被命运删除。',
      targetChapters: 80,
      wordsPerChapter: 2200,
    })
  ).toContain('Book title: 月税奇谈');

  expect(
    buildVolumePlanPrompt({
      title: '月税奇谈',
      targetChapters: 80,
      bibleSummary: '主题：自由的代价。',
      viralStoryProtocol: viralProtocol,
    })
  ).toContain('Book title: 月税奇谈');

  expect(
    buildChapterCardPrompt({
      title: '月税奇谈',
      bookId: 'book-1',
      targetChapters: 3,
      bibleSummary: '主题：自由的代价。',
      volumePlansText: '第一卷：旧页初鸣，1-3章。',
    })
  ).toContain('Book title: 月税奇谈');
});
```

- [ ] **Step 2: Run prompt tests and verify red**

Run:

```bash
pnpm exec vitest run tests/core/prompt-builder.test.ts tests/core/narrative-prompts.test.ts
```

Expected: tests fail because title and viral strategy are not accepted or rendered.

- [ ] **Step 3: Extend generation input type**

In `packages/backend/src/core/types.ts`, add:

```ts
title: string;
```

to `OutlineGenerationInput`.

- [ ] **Step 4: Update legacy prompt builder signatures and render title**

In `prompt-builder.ts`, include `'title'` in `buildWorldPrompt`, `buildTitlePrompt`, `buildMasterOutlinePrompt`, and `buildChapterDraftPrompt` inputs.

Add to `buildLengthConstraintLines` callers as a nearby line:

```ts
`Book title: ${input.title}`,
```

In `buildTitlePrompt`, include viral strategy lines:

```ts
const viralStrategyLines = input.viralStrategy
  ? [
      input.viralStrategy.readerPayoff
        ? `Reader payoff: ${input.viralStrategy.readerPayoff}`
        : '',
      input.viralStrategy.protagonistDesire
        ? `Protagonist desire: ${input.viralStrategy.protagonistDesire}`
        : '',
      input.viralStrategy.cadenceMode
        ? `Payoff cadence: ${input.viralStrategy.cadenceMode}`
        : '',
      input.viralStrategy.antiClicheDirection
        ? `Anti-cliche direction: ${input.viralStrategy.antiClicheDirection}`
        : '',
    ].filter(Boolean)
  : [];
```

Add title-quality constraints:

```ts
'Create one concise, memorable Chinese web novel title that fits the story theme, protagonist desire, core conflict, and reader payoff.',
'The title should imply a hook, reversal, desire, or pressure point; it should feel clickable without becoming misleading.',
'Avoid generic empty phrases such as 传奇, 风云, 异世, 崛起 unless the user idea makes them specific and necessary.',
'Return only one Chinese book title, without quotes, explanation, candidates, numbering, or Markdown.',
```

- [ ] **Step 5: Update narrative prompt builders**

In `packages/backend/src/core/narrative/prompts.ts`, add optional `title?: string` to planning prompt inputs. Render this helper near the top of relevant prompts:

```ts
function renderBookTitleLine(title?: string | null) {
  return title?.trim() ? [`Book title: ${title.trim()}`] : [];
}
```

Spread it into `buildNarrativeBiblePrompt`, `buildVolumePlanPrompt`, `buildChapterCardPrompt`, `buildTensionBudgetPrompt`, and `buildNarrativeDraftPrompt`:

```ts
...renderBookTitleLine(input.title),
```

Add one requirement line in planning prompts:

```ts
'Treat the book title as a reader promise: world rules, conflicts, rewards, and hooks must keep paying it off.',
```

- [ ] **Step 6: Pass title from outline services**

In `bible-based-outline-generator.ts`, include `title: ctx.input.title` in calls to:

```ts
buildNarrativeBiblePrompt
buildVolumePlanPrompt
buildChapterCardPrompt
buildTensionBudgetPrompt
```

In `fallback-outline-generator.ts`, include `title: ctx.input.title` in calls to:

```ts
buildWorldPrompt
buildMasterOutlinePrompt
```

- [ ] **Step 7: Run prompt and AI outline tests**

Run:

```bash
pnpm exec vitest run tests/core/prompt-builder.test.ts tests/core/narrative-prompts.test.ts tests/core/ai-outline.test.ts
```

Expected: all selected tests pass.

## Task 6: Chapter Drafts Reference Final Title

**Files:**
- Modify: `packages/backend/src/core/aggregates/chapter/context-builder.ts`
- Modify: `packages/backend/src/core/aggregates/chapter/chapter-aggregate.ts`
- Test: `tests/core/aggregates/chapter-aggregate.test.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [ ] **Step 1: Confirm current draft prompt call**

Run:

```bash
rg -n "buildNarrativeDraftPrompt|buildChapterDraftPrompt|Book title|chapterTitle" packages/backend/src/core/aggregates/chapter packages/backend/src/core/chapter-writer.ts
```

Expected: `context-builder.ts` contains both production calls, `buildNarrativeDraftPrompt(...)` and `buildChapterDraftPrompt(...)`.

- [ ] **Step 2: Write failing chapter prompt propagation test**

In `tests/core/aggregates/chapter-aggregate.test.ts`, add a test beside the existing draft writing tests that captures the model prompt and asserts it contains the book title:

```ts
it('includes the final book title in chapter draft prompts', async () => {
  const prompts: string[] = [];
  const setup = createDefaultSetup({
    book: { title: '月税奇谈' },
    generateText: async ({ prompt }: { prompt: string }) => {
      prompts.push(prompt);
      return { text: '林牧抬头，看见月亮开始收税。' };
    },
  });

  await setup.aggregate.writeNextChapter(setup.bookId);

  expect(prompts.join('\n')).toContain('Book title: 月税奇谈');
});
```

If the existing helper does not accept `book` and `generateText` overrides with these names, add the smallest local setup in this test: create a real in-memory database, create one book titled `月税奇谈`, insert one chapter outline, pass a `chapterWriter.writeChapter` fake that records `input.prompt`, and call `writeNextChapter(bookId)`.

- [ ] **Step 3: Run chapter aggregate test and verify red**

Run:

```bash
pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts
```

Expected: the new test fails because chapter draft prompt input does not contain the book title.

- [ ] **Step 4: Implement title propagation**

In `context-builder.ts`, extend the `buildWriteContext` input book type:

```ts
book: {
  title: string;
  idea: string;
  wordsPerChapter: number;
  targetChapters: number;
};
```

In both prompt builder calls inside `context-builder.ts`, pass:

```ts
title: input.book.title,
```

In `chapter-aggregate.ts`, pass the loaded title into the existing `buildWriteContext()` call:

```ts
book: {
  title: book.title,
  idea: book.idea,
  wordsPerChapter: book.wordsPerChapter,
  targetChapters: book.targetChapters,
},
```

- [ ] **Step 5: Run chapter tests**

Run:

```bash
pnpm exec vitest run tests/core/aggregates/chapter-aggregate.test.ts tests/core/narrative-prompts.test.ts tests/core/prompt-builder.test.ts
```

Expected: selected chapter and prompt tests pass.

## Task 7: Frontend Form And Route Payload

**Files:**
- Modify: `packages/frontend/src/pages/NewBook.tsx`
- Modify: `packages/frontend/src/pages/NewBookRoute.tsx`
- Test: `tests/renderer/new-book.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

In `tests/renderer/new-book.test.tsx`, update the label association test:

```ts
expect(screen.getByLabelText('书名')).toBeInTheDocument();
```

Add:

```ts
it('submits a trimmed optional book title when provided', () => {
  const onCreate = vi.fn();

  render(<NewBook onCreate={onCreate} />);

  fireEvent.change(screen.getByLabelText('书名'), {
    target: { value: '  月税奇谈  ' },
  });
  fireEvent.change(screen.getByLabelText('故事设想'), {
    target: { value: 'A moon taxes every miracle.' },
  });
  fireEvent.click(screen.getByText('开始写作'));

  expect(onCreate).toHaveBeenCalledWith({
    title: '月税奇谈',
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });
});

it('does not submit a blank book title', () => {
  const onCreate = vi.fn();

  render(<NewBook onCreate={onCreate} />);

  fireEvent.change(screen.getByLabelText('书名'), {
    target: { value: '   ' },
  });
  fireEvent.change(screen.getByLabelText('故事设想'), {
    target: { value: 'A moon taxes every miracle.' },
  });
  fireEvent.click(screen.getByText('开始写作'));

  expect(onCreate).toHaveBeenCalledWith({
    idea: 'A moon taxes every miracle.',
    targetChapters: 500,
    wordsPerChapter: 2500,
  });
});
```

- [ ] **Step 2: Run renderer tests and verify red**

Run:

```bash
pnpm exec vitest run tests/renderer/new-book.test.tsx
```

Expected: tests fail because the `书名` field does not exist.

- [ ] **Step 3: Implement form field and payload**

In `NewBook.tsx`, add state:

```ts
const [title, setTitle] = useState('');
```

Extend `onCreate` input type:

```ts
title?: string;
```

Add field before `故事设想`:

```tsx
<div className="grid gap-2">
  <Label htmlFor="new-book-title">书名</Label>
  <Input
    id="new-book-title"
    value={title}
    onChange={(event) => setTitle(event.target.value)}
  />
</div>
```

Before `onCreate`, compute:

```ts
const trimmedTitle = title.trim();
```

Submit:

```ts
const result = onCreate({
  ...(trimmedTitle ? { title: trimmedTitle } : {}),
  idea,
  targetChapters,
  wordsPerChapter,
  ...(Object.keys(viralStrategy).length ? { viralStrategy } : {}),
});
```

In `NewBookRoute.tsx`, add `title?: string` to `handleCreate` input type and change the second toast:

```ts
showToast(
  'info',
  input.title ? '书本已创建，正在构建世界观...' : '书本已创建，正在生成书名...'
);
```

- [ ] **Step 4: Run renderer tests**

Run:

```bash
pnpm exec vitest run tests/renderer/new-book.test.tsx
```

Expected: renderer tests pass.

## Task 8: End-To-End Verification

**Files:**
- All files changed by Tasks 1-7.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
pnpm exec vitest run \
  tests/shared/schemas.test.ts \
  tests/storage/books.test.ts \
  tests/storage/migrate.test.ts \
  tests/core/aggregates/book-aggregate.test.ts \
  tests/core/aggregates/outline-aggregate.test.ts \
  tests/core/aggregates/chapter-aggregate.test.ts \
  tests/core/prompt-builder.test.ts \
  tests/core/narrative-prompts.test.ts \
  tests/renderer/new-book.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 2: Run full validation**

Run:

```bash
pnpm run typecheck
pnpm test
```

Expected: typecheck and full test suite pass.

- [ ] **Step 3: Inspect migration status**

Run:

```bash
git diff -- drizzle packages tests
```

Expected: migration adds only `title_generation_status`; existing unrelated schema is unchanged.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add \
  drizzle \
  packages/shared/src/contracts.ts \
  packages/shared/src/schemas/book-schemas.ts \
  packages/backend/src/storage/schema.ts \
  packages/backend/src/storage/books.ts \
  packages/backend/src/core \
  packages/frontend/src/pages/NewBook.tsx \
  packages/frontend/src/pages/NewBookRoute.tsx \
  tests
git commit -m "feat: support explicit book titles"
```

Expected: one implementation commit containing tests, migration, shared contract, backend behavior, prompt updates, and frontend form updates.

## Self-Review

Spec coverage:

- Creation-time optional title: Task 1, Task 3, Task 7.
- Explicit generation status instead of title text comparison: Task 2, Task 3, Task 4.
- Generated state after automatic naming: Task 4.
- Final title used in later generation: Task 4, Task 5, Task 6.
- More attractive automatic title prompt: Task 5.
- Tests across shared/backend/frontend: Tasks 1-8.

Placeholder scan:

- No unresolved placeholders are present.
- Every task includes concrete files, test snippets, commands, and expected outcomes.

Type consistency:

- Status name is consistently `titleGenerationStatus`.
- Enum values are consistently `manual`, `pending`, and `generated`.
- Database column is consistently `title_generation_status`.
