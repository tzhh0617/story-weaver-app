# Comprehensive Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Story Weaver codebase across four layers — shared type safety, storage integrity, backend route robustness, and frontend architecture.

**Architecture:** Bottom-up layer-by-layer. Layer 1 (shared) establishes the type foundation that Layers 2-4 depend on. Each task produces self-contained, testable changes.

**Tech Stack:** TypeScript, Zod, Fastify, Drizzle ORM, React 19, React Router v7, Vitest

---

## Layer 1: Foundation — Shared Contracts + Error Types + Zod

### Task 1: Add Zod dependency to shared package

**Files:**
- Modify: `packages/shared/package.json`
- Modify: `pnpm-lock.yaml` (via install)

- [ ] **Step 1: Install Zod**

Run: `pnpm --filter @story-weaver/shared add zod`
Expected: Zod added to shared/package.json dependencies, lockfile updated

- [ ] **Step 2: Verify Zod is importable**

Run: `pnpm --filter @story-weaver/shared typecheck`
Expected: PASS (no code changes yet, just dependency)

- [ ] **Step 3: Commit**

```bash
git add packages/shared/package.json pnpm-lock.yaml
git commit -m "chore: add zod dependency to shared package"
```

---

### Task 2: Create custom error type hierarchy

**Files:**
- Create: `packages/shared/src/errors.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write error type tests**

Create `tests/shared/errors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  AppError,
  NotFoundError,
  ValidationError,
  NoModelConfiguredError,
  GenerationError,
  ConflictError,
} from '@story-weaver/shared/errors';

describe('AppError hierarchy', () => {
  it('NotFoundError has code NOT_FOUND and status 404', () => {
    const error = new NotFoundError('Book', 'book-1');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('book-1');
  });

  it('ValidationError has code VALIDATION_ERROR and status 400 with details', () => {
    const details = [{ field: 'idea', reason: 'required' }];
    const error = new ValidationError(details);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
  });

  it('NoModelConfiguredError has code NO_MODEL_CONFIGURED', () => {
    const error = new NoModelConfiguredError();
    expect(error.code).toBe('NO_MODEL_CONFIGURED');
    expect(error.statusCode).toBe(400);
  });

  it('GenerationError has code GENERATION_ERROR and wraps original', () => {
    const error = new GenerationError('API rate limit exceeded');
    expect(error.code).toBe('GENERATION_ERROR');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ originalError: 'API rate limit exceeded' });
  });

  it('ConflictError has code CONFLICT and status 409', () => {
    const error = new ConflictError('Book already running');
    expect(error.code).toBe('CONFLICT');
    expect(error.statusCode).toBe(409);
  });

  it('all errors serialize to JSON with code and message', () => {
    const error = new NotFoundError('Book', 'x');
    const json = error.toJSON();
    expect(json).toEqual({
      code: 'NOT_FOUND',
      message: error.message,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/shared/errors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write error types implementation**

Create `packages/shared/src/errors.ts`:

```typescript
export type ErrorDetail = { field: string; reason: string };

export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, `${resource} not found: ${id}`);
  }
}

export class ValidationError extends AppError {
  override readonly details: ErrorDetail[];

  constructor(details: ErrorDetail[]) {
    const message = details.map((d) => `${d.field}: ${d.reason}`).join('; ');
    super('VALIDATION_ERROR', 400, message, details);
    this.details = details;
  }
}

export class NoModelConfiguredError extends AppError {
  constructor() {
    super('NO_MODEL_CONFIGURED', 400, 'No model configured. Add a model in Settings.');
  }
}

export class GenerationError extends AppError {
  constructor(originalError: string) {
    super('GENERATION_ERROR', 500, `Generation failed: ${originalError}`, {
      originalError,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}
```

- [ ] **Step 4: Export from shared index**

Update `packages/shared/src/index.ts` to add the errors export:

```typescript
export * from './contracts.js';
export * from './settings.js';
export * from './errors.js';
```

- [ ] **Step 5: Add errors export to package.json exports map**

Update `packages/shared/package.json` — add a new entry in `exports`:

```json
"./errors": {
  "types": "./dist/errors.d.ts",
  "import": "./dist/errors.js"
}
```

- [ ] **Step 6: Add vitest alias for errors module**

Update `vitest.config.ts` — add this alias in the `resolve.alias` array, after the existing `@story-weaver/shared/settings` entry:

```typescript
{
  find: '@story-weaver/shared/errors',
  replacement: path.resolve(__dirname, 'packages/shared/src/errors.ts'),
},
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec vitest run tests/shared/errors.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/errors.ts packages/shared/src/index.ts packages/shared/package.json vitest.config.ts tests/shared/errors.test.ts
git commit -m "feat: add custom error type hierarchy to shared package"
```

---

### Task 3: Create Zod schemas for API payloads

**Files:**
- Create: `packages/shared/src/schemas/book-schemas.ts`
- Create: `packages/shared/src/schemas/model-schemas.ts`
- Create: `packages/shared/src/schemas/settings-schemas.ts`
- Create: `packages/shared/src/schemas/event-schemas.ts`
- Create: `tests/shared/schemas.test.ts`

- [ ] **Step 1: Write schema tests**

Create `tests/shared/schemas.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  BookCreateSchema,
  BookExportRequestSchema,
  ViralStrategySchema,
  ViralTropeContractSchema,
} from '@story-weaver/shared/schemas/book-schemas';
import { ModelSaveSchema } from '@story-weaver/shared/schemas/model-schemas';
import { SettingUpdateSchema } from '@story-weaver/shared/schemas/settings-schemas';
import {
  SchedulerStatusSchema,
  BookGenerationProgressSchema,
  BookGenerationChapterStreamSchema,
  BookGenerationChapterCompleteSchema,
  BookGenerationErrorSchema,
  ExecutionLogSchema,
} from '@story-weaver/shared/schemas/event-schemas';

describe('book schemas', () => {
  it('BookCreateSchema accepts valid payload', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'A city that stores memory in rain.',
      targetChapters: 500,
      wordsPerChapter: 2500,
    });
    expect(result.success).toBe(true);
  });

  it('BookCreateSchema accepts optional viralStrategy', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'Revenge story',
      targetChapters: 100,
      wordsPerChapter: 2000,
      viralStrategy: {
        readerPayoff: 'revenge',
        protagonistDesire: '洗清旧案',
        tropeContracts: ['revenge_payback'],
        cadenceMode: 'steady',
        antiClicheDirection: '反派不降智',
      },
    });
    expect(result.success).toBe(true);
  });

  it('BookCreateSchema rejects missing required fields', () => {
    const result = BookCreateSchema.safeParse({ idea: 'test' });
    expect(result.success).toBe(false);
  });

  it('BookCreateSchema rejects zero targetChapters', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'test',
      targetChapters: 0,
      wordsPerChapter: 2500,
    });
    expect(result.success).toBe(false);
  });

  it('BookCreateSchema rejects invalid viralStrategy cadenceMode', () => {
    const result = BookCreateSchema.safeParse({
      idea: 'test',
      targetChapters: 10,
      wordsPerChapter: 2000,
      viralStrategy: {
        cadenceMode: 'invalid_mode',
      },
    });
    expect(result.success).toBe(false);
  });

  it('ViralTropeContractSchema accepts all known tropes', () => {
    const tropes = [
      'rebirth_change_fate', 'system_growth', 'hidden_identity',
      'revenge_payback', 'weak_to_strong', 'forbidden_bond',
      'case_breaking', 'sect_or_family_pressure', 'survival_game',
      'business_or_power_game',
    ];
    for (const trope of tropes) {
      expect(ViralTropeContractSchema.safeParse(trope).success).toBe(true);
    }
  });

  it('BookExportRequestSchema accepts txt and md', () => {
    expect(BookExportRequestSchema.safeParse({ format: 'txt' }).success).toBe(true);
    expect(BookExportRequestSchema.safeParse({ format: 'md' }).success).toBe(true);
    expect(BookExportRequestSchema.safeParse({ format: 'pdf' }).success).toBe(false);
  });
});

describe('model schemas', () => {
  it('ModelSaveSchema accepts valid openai config', () => {
    const result = ModelSaveSchema.safeParse({
      id: 'model-1',
      provider: 'openai',
      modelName: 'gpt-4',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      config: { temperature: 0.7 },
    });
    expect(result.success).toBe(true);
  });

  it('ModelSaveSchema accepts valid anthropic config', () => {
    const result = ModelSaveSchema.safeParse({
      id: 'model-2',
      provider: 'anthropic',
      modelName: 'claude-3-opus',
      apiKey: 'sk-ant-test',
      baseUrl: 'https://api.anthropic.com',
      config: {},
    });
    expect(result.success).toBe(true);
  });

  it('ModelSaveSchema rejects unknown provider', () => {
    const result = ModelSaveSchema.safeParse({
      id: 'model-3',
      provider: 'google',
      modelName: 'gemini',
      apiKey: 'test',
      baseUrl: 'https://google.com',
      config: {},
    });
    expect(result.success).toBe(false);
  });
});

describe('settings schemas', () => {
  it('SettingUpdateSchema accepts string value', () => {
    const result = SettingUpdateSchema.safeParse({ value: 'true' });
    expect(result.success).toBe(true);
  });

  it('SettingUpdateSchema rejects non-string value', () => {
    const result = SettingUpdateSchema.safeParse({ value: 123 });
    expect(result.success).toBe(false);
  });
});

describe('event schemas', () => {
  it('SchedulerStatusSchema accepts valid status', () => {
    const result = SchedulerStatusSchema.safeParse({
      runningBookIds: ['book-1'],
      queuedBookIds: [],
      pausedBookIds: ['book-2'],
      concurrencyLimit: null,
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationProgressSchema accepts progress event', () => {
    const result = BookGenerationProgressSchema.safeParse({
      type: 'progress',
      bookId: 'book-1',
      phase: 'writing',
      stepLabel: 'Writing chapter 5',
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationChapterStreamSchema accepts stream event', () => {
    const result = BookGenerationChapterStreamSchema.safeParse({
      type: 'chapter-stream',
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 5,
      title: 'Chapter 5',
      delta: 'Some text',
      replace: false,
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationChapterCompleteSchema accepts complete event', () => {
    const result = BookGenerationChapterCompleteSchema.safeParse({
      type: 'chapter-complete',
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 5,
    });
    expect(result.success).toBe(true);
  });

  it('BookGenerationErrorSchema accepts error event', () => {
    const result = BookGenerationErrorSchema.safeParse({
      type: 'error',
      bookId: 'book-1',
      phase: 'writing',
      stepLabel: 'Failed',
    });
    expect(result.success).toBe(true);
  });

  it('ExecutionLogSchema accepts valid log', () => {
    const result = ExecutionLogSchema.safeParse({
      id: 1,
      bookId: 'book-1',
      timestamp: '2026-05-02T00:00:00.000Z',
      level: 'info',
      event: 'chapter.complete',
      message: 'Chapter 5 completed',
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/shared/schemas.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create book schemas**

Create `packages/shared/src/schemas/book-schemas.ts`:

```typescript
import { z } from 'zod';

export const ViralTropeContractSchema = z.enum([
  'rebirth_change_fate',
  'system_growth',
  'hidden_identity',
  'revenge_payback',
  'weak_to_strong',
  'forbidden_bond',
  'case_breaking',
  'sect_or_family_pressure',
  'survival_game',
  'business_or_power_game',
]);

export const ViralStrategySchema = z.object({
  readerPayoff: z.string().optional(),
  protagonistDesire: z.string().optional(),
  tropeContracts: z.array(ViralTropeContractSchema).optional(),
  cadenceMode: z.enum(['fast', 'steady', 'slow_burn', 'suppressed_then_burst']).optional(),
  antiClicheDirection: z.string().optional(),
}).optional();

export const BookCreateSchema = z.object({
  idea: z.string(),
  targetChapters: z.number().int().positive(),
  wordsPerChapter: z.number().int().positive(),
  viralStrategy: ViralStrategySchema,
});

export const BookExportRequestSchema = z.object({
  format: z.enum(['txt', 'md']),
});

export type BookCreateInput = z.infer<typeof BookCreateSchema>;
export type BookExportRequestInput = z.infer<typeof BookExportRequestSchema>;
```

- [ ] **Step 4: Create model schemas**

Create `packages/shared/src/schemas/model-schemas.ts`:

```typescript
import { z } from 'zod';

export const ModelSaveSchema = z.object({
  id: z.string(),
  provider: z.enum(['openai', 'anthropic']),
  modelName: z.string(),
  apiKey: z.string(),
  baseUrl: z.string(),
  config: z.record(z.unknown()),
});

export type ModelSaveInput = z.infer<typeof ModelSaveSchema>;
```

- [ ] **Step 5: Create settings schemas**

Create `packages/shared/src/schemas/settings-schemas.ts`:

```typescript
import { z } from 'zod';

export const SettingUpdateSchema = z.object({
  value: z.string(),
});

export type SettingUpdateInput = z.infer<typeof SettingUpdateSchema>;
```

- [ ] **Step 6: Create event schemas**

Create `packages/shared/src/schemas/event-schemas.ts`:

```typescript
import { z } from 'zod';

export const SchedulerStatusSchema = z.object({
  runningBookIds: z.array(z.string()),
  queuedBookIds: z.array(z.string()),
  pausedBookIds: z.array(z.string()),
  concurrencyLimit: z.number().nullable(),
});

const bookGenerationBase = z.object({
  bookId: z.string(),
  phase: z.string().optional(),
  stepLabel: z.string().optional(),
  currentVolume: z.number().nullable().optional(),
  currentChapter: z.number().nullable().optional(),
});

export const BookGenerationProgressSchema = bookGenerationBase.extend({
  type: z.literal('progress'),
});

export const BookGenerationChapterStreamSchema = bookGenerationBase.extend({
  type: z.literal('chapter-stream'),
  volumeIndex: z.number(),
  chapterIndex: z.number(),
  title: z.string(),
  delta: z.string(),
  replace: z.boolean().optional(),
});

export const BookGenerationChapterCompleteSchema = bookGenerationBase.extend({
  type: z.literal('chapter-complete'),
  volumeIndex: z.number(),
  chapterIndex: z.number(),
});

export const BookGenerationErrorSchema = bookGenerationBase.extend({
  type: z.literal('error'),
});

export const BookGenerationEventSchema = z.discriminatedUnion('type', [
  BookGenerationProgressSchema,
  BookGenerationChapterStreamSchema,
  BookGenerationChapterCompleteSchema,
  BookGenerationErrorSchema,
]);

export const ExecutionLogSchema = z.object({
  id: z.number(),
  bookId: z.string(),
  timestamp: z.string(),
  level: z.enum(['info', 'success', 'error']),
  event: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  phase: z.string().optional(),
  stepLabel: z.string().optional(),
});

export type SchedulerStatusInput = z.infer<typeof SchedulerStatusSchema>;
export type BookGenerationEventInput = z.infer<typeof BookGenerationEventSchema>;
export type ExecutionLogInput = z.infer<typeof ExecutionLogSchema>;
```

- [ ] **Step 7: Add vitest aliases for schemas**

Update `vitest.config.ts` — add these aliases after the existing `@story-weaver/shared/errors` entry:

```typescript
{
  find: '@story-weaver/shared/schemas/book-schemas',
  replacement: path.resolve(__dirname, 'packages/shared/src/schemas/book-schemas.ts'),
},
{
  find: '@story-weaver/shared/schemas/model-schemas',
  replacement: path.resolve(__dirname, 'packages/shared/src/schemas/model-schemas.ts'),
},
{
  find: '@story-weaver/shared/schemas/settings-schemas',
  replacement: path.resolve(__dirname, 'packages/shared/src/schemas/settings-schemas.ts'),
},
{
  find: '@story-weaver/shared/schemas/event-schemas',
  replacement: path.resolve(__dirname, 'packages/shared/src/schemas/event-schemas.ts'),
},
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm exec vitest run tests/shared/schemas.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/schemas/ tests/shared/schemas.test.ts vitest.config.ts
git commit -m "feat: add Zod schemas for API payloads and SSE events"
```

---

### Task 4: Create validation utility and update contracts.ts

**Files:**
- Create: `packages/shared/src/validation.ts`
- Modify: `packages/shared/src/contracts.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json`
- Create: `tests/shared/validation.test.ts`

- [ ] **Step 1: Write validation utility tests**

Create `tests/shared/validation.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate, safeValidate } from '@story-weaver/shared/validation';

const TestSchema = z.object({ name: z.string(), age: z.number() });

describe('validate', () => {
  it('returns typed data for valid input', () => {
    const result = validate(TestSchema, { name: 'Alice', age: 30 });
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('throws ValidationError for invalid input', () => {
    expect(() => validate(TestSchema, { name: 'Alice' })).toThrow();
  });
});

describe('safeValidate', () => {
  it('returns success with data for valid input', () => {
    const result = safeValidate(TestSchema, { name: 'Bob', age: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Bob', age: 25 });
    }
  });

  it('returns failure with error details for invalid input', () => {
    const result = safeValidate(TestSchema, { name: 'Bob' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.details.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/shared/validation.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create validation utility**

Create `packages/shared/src/validation.ts`:

```typescript
import type { ZodSchema } from 'zod';
import { ValidationError } from './errors.js';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    reason: issue.message,
  }));
  throw new ValidationError(details);
}

export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: ValidationError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '_root',
    reason: issue.message,
  }));
  return { success: false, error: new ValidationError(details) };
}
```

- [ ] **Step 4: Add exports to shared index**

Update `packages/shared/src/index.ts`:

```typescript
export * from './contracts.js';
export * from './settings.js';
export * from './errors.js';
export * from './validation.js';
```

- [ ] **Step 5: Add validation export to package.json exports map**

Update `packages/shared/package.json` — add:

```json
"./validation": {
  "types": "./dist/validation.d.ts",
  "import": "./dist/validation.js"
}
```

- [ ] **Step 6: Add vitest alias for validation module**

Update `vitest.config.ts` — add:

```typescript
{
  find: '@story-weaver/shared/validation',
  replacement: path.resolve(__dirname, 'packages/shared/src/validation.ts'),
},
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec vitest run tests/shared/validation.test.ts`
Expected: PASS

- [ ] **Step 8: Update contracts.ts — replace unknown types**

In `packages/shared/src/contracts.ts`, find the `NarrativeCheckpointReport` type (or the field `report: unknown`) and replace `unknown` with a more specific type. Since the exact structure depends on the narrative system, replace:

```typescript
report: unknown;
futureCardRevisions: unknown[];
```

with:

```typescript
report: Record<string, unknown> | null;
futureCardRevisions: Array<Record<string, unknown>>;
```

This is a targeted improvement — fully typed schemas for the narrative system are out of scope for this remediation.

- [ ] **Step 9: Run full test suite**

Run: `pnpm test`
Expected: All existing tests still pass

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/validation.ts packages/shared/src/index.ts packages/shared/package.json packages/shared/src/contracts.ts vitest.config.ts tests/shared/validation.test.ts
git commit -m "feat: add validation utility and tighten contracts.ts unknown types"
```

---

## Layer 2: Storage — Transactions, Indexes, JSON Safety, Decoupling

### Task 5: Add database indexes to Drizzle schema

**Files:**
- Modify: `packages/backend/src/storage/schema.ts`

- [ ] **Step 1: Write test for index existence**

Create `tests/storage/indexes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';

describe('database indexes', () => {
  it('has index on books.status', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='books'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_books_status');
  });

  it('has index on chapters.book_id', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='chapters'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_chapters_book_id');
  });

  it('has index on api_logs book_id and created_at', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_logs'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_api_logs_book_id_created_at');
  });

  it('has index on writing_progress.book_id', () => {
    const db = createDatabase(':memory:');
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='writing_progress'"
    ).all().map((r: any) => r.name);
    expect(indexes).toContain('idx_writing_progress_book_id');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/storage/indexes.test.ts`
Expected: FAIL — indexes not found

- [ ] **Step 3: Add indexes to schema**

In `packages/backend/src/storage/schema.ts`, find the `books` table definition and add an index on `status`. Similarly add indexes for the other tables. The Drizzle API uses `.index()` on the table builder or a separate `index()` call.

After the existing table definitions, add these index declarations using Drizzle's `index()` builder (import `index` from `drizzle-orm/sqlite-core` if not already imported):

```typescript
// Add to the imports at the top:
import { index } from 'drizzle-orm/sqlite-core';

// Add after all table definitions:
export const indexes = {
  idxBooksStatus: index('idx_books_status').on(books.status),
  idxChaptersBookId: index('idx_chapters_book_id').on(chapters.bookId),
  idxApiLogsBookIdCreatedAt: index('idx_api_logs_book_id_created_at').on(apiLogs.bookId, apiLogs.createdAt),
  idxWritingProgressBookId: index('idx_writing_progress_book_id').on(writingProgress.bookId),
};
```

Note: If the schema file already uses `sqliteTable` with inline indexes, add these as separate `index()` declarations exported from the same file. Check the existing import style and follow it.

- [ ] **Step 4: Verify the database module creates tables with indexes**

The `createDatabase` function must be updated to apply these indexes when creating tables. If it uses Drizzle's `migrate` or `pushSchema`, this may happen automatically. If not, add explicit `CREATE INDEX IF NOT EXISTS` statements in the table creation section of `packages/backend/src/storage/database.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/storage/indexes.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/storage/schema.ts packages/backend/src/storage/database.ts tests/storage/indexes.test.ts
git commit -m "feat: add database indexes for high-frequency query columns"
```

---

### Task 6: Wrap multi-step storage operations in transactions

**Files:**
- Modify: `packages/backend/src/storage/books.ts`
- Modify: `packages/backend/src/storage/characters.ts`
- Create: `tests/storage/transaction-safety.test.ts`

- [ ] **Step 1: Write transaction safety tests**

Create `tests/storage/transaction-safety.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createChapterRepository } from '@story-weaver/backend/storage/chapters';
import { createCharacterRepository } from '@story-weaver/backend/storage/characters';

describe('storage transaction safety', () => {
  it('book delete removes all related data atomically', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);
    const chapters = createChapterRepository(db);

    books.create({
      id: 'book-1',
      title: 'Test',
      idea: 'Test idea',
      targetChapters: 1,
      wordsPerChapter: 1000,
    });
    chapters.upsertOutline({
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      title: 'Ch 1',
      outline: 'Test',
    });

    books.delete('book-1');

    expect(books.getById('book-1')).toBeUndefined();
    expect(chapters.listByBook('book-1')).toEqual([]);
  });

  it('book clearGeneratedState preserves book record', () => {
    const db = createDatabase(':memory:');
    const books = createBookRepository(db);

    books.create({
      id: 'book-1',
      title: 'Test',
      idea: 'Test idea',
      targetChapters: 1,
      wordsPerChapter: 1000,
    });

    books.clearGeneratedState('book-1');

    const book = books.getById('book-1');
    expect(book).toBeDefined();
    expect(book!.id).toBe('book-1');
  });
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `pnpm exec vitest run tests/storage/transaction-safety.test.ts`
Expected: May PASS or FAIL depending on current delete behavior. The goal is to ensure it passes after wrapping in transactions.

- [ ] **Step 3: Wrap books.ts operations in transactions**

In `packages/backend/src/storage/books.ts`, wrap the `delete()` method body in `db.transaction(() => { ... })` and wrap `clearGeneratedState()` similarly.

The `delete` method should look like:

```typescript
delete(id: string) {
  db.transaction(() => {
    db.prepare('DELETE FROM chapter_thread_actions WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM chapter_character_pressures WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM chapter_relationship_actions WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM chapter_tension_budgets WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM chapter_generation_audits WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM narrative_checkpoints WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM chapter_cards WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM chapters WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM character_states WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM characters WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM relationship_states WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM relationship_edges WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM character_arcs WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM world_rules WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM narrative_threads WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM volume_plans WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM scene_records WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM writing_progress WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM story_bibles WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM book_context WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM plot_threads WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM world_settings WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM api_logs WHERE book_id = ?').run(id);
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
  });
}
```

Wrap `clearGeneratedState()` in `db.transaction(() => { ... })` as well.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/storage/transaction-safety.test.ts`
Expected: PASS

- [ ] **Step 5: Run existing storage tests**

Run: `pnpm exec vitest run tests/storage/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/storage/books.ts packages/backend/src/storage/characters.ts tests/storage/transaction-safety.test.ts
git commit -m "fix: wrap multi-step storage operations in database transactions"
```

---

### Task 7: Add JSON parse safety and export registry TTL

**Files:**
- Modify: `packages/backend/src/storage/story-bibles.ts`
- Modify: `packages/backend/src/storage/chapter-cards.ts`
- Modify: `packages/backend/src/storage/chapter-audits.ts`
- Modify: `packages/backend/src/storage/model-configs.ts`
- Modify: `packages/backend/src/export-registry.ts`
- Create: `tests/storage/json-safety.test.ts`

- [ ] **Step 1: Write JSON safety tests**

Create `tests/storage/json-safety.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createExportRegistry } from '@story-weaver/backend/export-registry';

describe('JSON parse safety', () => {
  it('does not throw on corrupted JSON in story bibles', () => {
    const db = createDatabase(':memory:');
    // Insert a bible row with corrupted JSON directly
    db.prepare(
      "INSERT INTO story_bibles (book_id, premise, genre_contract, themes) VALUES (?, ?, ?, ?)"
    ).run('book-1', 'not-json{', 'test', '["t1"]');
    // Import the repository after the DB is set up
    const { createStoryBibleRepository } = await import('@story-weaver/backend/storage/story-bibles');
    const repo = createStoryBibleRepository(db);
    const result = repo.getByBook('book-1');
    // Should return null or a safe default, not throw
    expect(result).toBeDefined();
  });
});

describe('export registry TTL', () => {
  it('expires entries older than 30 minutes', () => {
    const registry = createExportRegistry();
    const download = registry.register('/tmp/test.txt');
    expect(registry.get(download.id)).toBeTruthy();

    // Manually backdate the entry
    const internal = (registry as any)._exportsById as Map<string, any>;
    const entry = internal.get(download.id);
    entry.createdAt = Date.now() - 31 * 60 * 1000;

    // Next get() should trigger cleanup
    expect(registry.get(download.id)).toBeNull();
  });

  it('rejects registration when at capacity', () => {
    const registry = createExportRegistry();
    const internal = (registry as any)._exportsById as Map<string, any>;

    for (let i = 0; i < 50; i++) {
      registry.register(`/tmp/file-${i}.txt`);
    }

    expect(() => registry.register('/tmp/overflow.txt')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/storage/json-safety.test.ts`
Expected: FAIL — registry doesn't have TTL yet

- [ ] **Step 3: Add safe JSON parse helper to each storage file**

Create a helper pattern used in each storage file. At the top of each file that has `JSON.parse()`, add:

```typescript
function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
```

Then replace all `JSON.parse(field)` calls with `safeJsonParse(field, defaultValue)`. Do this for:
- `story-bibles.ts` — `premise`, `genreContract`, `themes` fields
- `chapter-cards.ts` — JSON fields in card data
- `chapter-audits.ts` — audit result JSON fields
- `model-configs.ts` — config JSON field

- [ ] **Step 4: Add TTL and capacity to export registry**

Replace the implementation of `packages/backend/src/export-registry.ts`:

```typescript
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ConflictError } from '@story-weaver/shared/errors';

const MAX_EXPORTS = 50;
const TTL_MS = 30 * 60 * 1000;

export type ExportDownload = {
  id: string;
  filePath: string;
  fileName: string;
  downloadUrl: string;
  createdAt: number;
};

export function createExportRegistry() {
  const exportsById = new Map<string, ExportDownload>();

  function sweepExpired() {
    const now = Date.now();
    for (const [id, entry] of exportsById) {
      if (now - entry.createdAt > TTL_MS) {
        exportsById.delete(id);
      }
    }
  }

  return {
    register(filePath: string) {
      sweepExpired();

      if (exportsById.size >= MAX_EXPORTS) {
        throw new ConflictError('Export registry is full. Try again later.');
      }

      const id = randomUUID();
      const download: ExportDownload = {
        id,
        filePath,
        fileName: path.basename(filePath),
        downloadUrl: `/api/exports/${id}`,
        createdAt: Date.now(),
      };

      exportsById.set(id, download);
      return download;
    },
    get(id: string) {
      sweepExpired();
      return exportsById.get(id) ?? null;
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/storage/json-safety.test.ts`
Expected: PASS

- [ ] **Step 5b: Fix migrate.ts path validation**

In `packages/backend/src/storage/migrate.ts`, replace the `quoteSqlString()` function with a path validation approach:

```typescript
function safeBackupPath(backupFile: string, rootDir: string): string {
  const resolved = path.resolve(backupFile);
  if (!resolved.startsWith(path.resolve(rootDir))) {
    throw new Error('Backup path must be within the data directory');
  }
  return resolved;
}
```

Update `backupDatabaseBeforeMigration()` to use `safeBackupPath()` before the `VACUUM INTO` call. SQLite doesn't support parameterized `VACUUM INTO`, so strict path validation is the defense.

- [ ] **Step 6: Run full storage test suite**

Run: `pnpm exec vitest run tests/storage/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/storage/story-bibles.ts packages/backend/src/storage/chapter-cards.ts packages/backend/src/storage/chapter-audits.ts packages/backend/src/storage/model-configs.ts packages/backend/src/export-registry.ts tests/storage/json-safety.test.ts
git commit -m "fix: add JSON parse safety and export registry TTL with capacity limit"
```

---

### Task 8: Remove reverse dependencies from storage to core

**Files:**
- Modify: `packages/backend/src/storage/chapter-cards.ts`
- Modify: `packages/backend/src/storage/chapter-audits.ts`
- Modify: `packages/backend/src/storage/story-bibles.ts`
- Modify: `tests/architecture/import-boundaries.test.ts`

- [ ] **Step 1: Identify all storage-to-core imports**

Run: `grep -rn "from '\.\./core/" packages/backend/src/storage/`
Record every file and the specific imports.

- [ ] **Step 2: Add storage-to-core boundary test**

In `tests/architecture/import-boundaries.test.ts`, add a new test:

```typescript
it('keeps storage from importing core domain logic', () => {
  const offenders = listTrackedSourceFiles()
    .filter((file) => file.startsWith('packages/backend/src/storage/'))
    .flatMap((file) =>
      importsIn(file)
        .filter(
          (specifier) =>
            specifier.includes('/core/') ||
            specifier.includes('../core/')
        )
        .map((specifier) => `${file} -> ${specifier}`)
    );

  expect(offenders).toEqual([]);
});
```

- [ ] **Step 3: Run test to see current violations**

Run: `pnpm exec vitest run tests/architecture/import-boundaries.test.ts`
Expected: FAIL on the new test — list all storage files importing from core

- [ ] **Step 4: Replace core imports with local type definitions**

For each storage file identified in Step 1:
- Remove the import from `../core/...`
- Define local type aliases or plain-object interfaces that match the shape the storage layer actually uses
- The mapping from core types to plain objects stays in the aggregate layer (core imports storage, not the reverse)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/architecture/import-boundaries.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/storage/ tests/architecture/import-boundaries.test.ts
git commit -m "refactor: remove reverse dependencies from storage layer to core"
```

---

## Layer 3: Backend Routes — Error Handler, Zod Validation, CORS

### Task 9: Add global error handler to Fastify server

**Files:**
- Modify: `packages/backend/src/main.ts`
- Create: `tests/server/error-handler.test.ts`

- [ ] **Step 1: Write error handler tests**

Create `tests/server/error-handler.test.ts`:

```typescript
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '@story-weaver/backend';
import { NotFoundError, ValidationError } from '@story-weaver/shared/errors';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-error-handler-'));
  roots.push(rootDir);
  return rootDir;
}

describe('global error handler', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns 404 for unknown API routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });
    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('NOT_FOUND');
    } finally {
      await server.close();
    }
  });

  it('returns 400 for validation errors with details', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });
    try {
      const response = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: { idea: 123 },
      });
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toBeDefined();
    } finally {
      await server.close();
    }
  });

  it('returns 500 for unexpected errors', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });
    try {
      const response = await server.inject({
        method: 'GET',
        url: '/api/books/nonexistent-id/detail',
      });
      expect([404, 500]).toContain(response.statusCode);
    } finally {
      await server.close();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/server/error-handler.test.ts`
Expected: FAIL — error response format doesn't match

- [ ] **Step 3: Add global error handler to main.ts**

In `packages/backend/src/main.ts`, add the error handler and not-found handler inside `buildServer()`, after the `app.addHook('onClose', ...)` block and before route registration:

```typescript
import { AppError } from '@story-weaver/shared/errors';

// Inside buildServer(), after onClose hook:
app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.toJSON() });
  }

  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    });
  }

  reply.log.error(error);
  return reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/server/error-handler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/main.ts tests/server/error-handler.test.ts
git commit -m "feat: add global error handler to Fastify server"
```

---

### Task 10: Refactor route validation to use Zod schemas

**Files:**
- Modify: `packages/backend/src/routes/books.ts`
- Modify: `packages/backend/src/routes/models.ts`
- Modify: `packages/backend/src/routes/settings.ts`
- Modify: `tests/server/books-routes.test.ts`

- [ ] **Step 1: Refactor books.ts to use Zod validation**

Replace the hand-written type guards in `packages/backend/src/routes/books.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import type { BookExportResponse } from '@story-weaver/shared/contracts';
import { validate } from '@story-weaver/shared/validation';
import { BookCreateSchema, BookExportRequestSchema } from '@story-weaver/shared/schemas/book-schemas';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

export async function registerBookRoutes(
  app: FastifyInstance,
  services: RuntimeServices,
  options: { exportsRegistry: ExportRegistry }
) {
  app.get('/api/books', async () => services.bookService.listBooks());

  app.post('/api/books', async (request, reply) => {
    const payload = validate(BookCreateSchema, request.body);
    const bookId = await services.bookService.createBook(payload);
    return { bookId };
  });

  app.get<{ Params: { bookId: string } }>(
    '/api/books/:bookId',
    async (request) => services.bookService.getBookDetail(request.params.bookId)
  );

  app.delete<{ Params: { bookId: string } }>(
    '/api/books/:bookId',
    async (request) => {
      await services.deleteBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/start',
    async (request) => {
      await services.startBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/pause',
    async (request) => {
      services.pauseBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/resume',
    async (request) => {
      await services.resumeBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/restart',
    async (request) => {
      await services.restartBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/chapters/write-next',
    async (request) => services.writeNextChapter(request.params.bookId)
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/chapters/write-all',
    async (request) => services.writeRemainingChapters(request.params.bookId)
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/exports',
    async (request, reply): Promise<BookExportResponse | unknown> => {
      const { format } = validate(BookExportRequestSchema, request.body);
      const filePath = await services.exportBook(request.params.bookId, format);
      return options.exportsRegistry.register(filePath);
    }
  );
}
```

Note: Delete all the `isRecord`, `isViralTropeContract`, `isViralStrategyPayload`, `isBookCreatePayload`, `isExportFormat` functions. The Zod schemas handle all validation.

- [ ] **Step 2: Refactor models.ts to use Zod validation**

Replace `packages/backend/src/routes/models.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { validate } from '@story-weaver/shared/validation';
import { ModelSaveSchema } from '@story-weaver/shared/schemas/model-schemas';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';

export async function registerModelRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/models', async () => services.listModelConfigs());

  app.put<{ Params: { modelId: string } }>(
    '/api/models/:modelId',
    async (request, reply) => {
      const payload = validate(ModelSaveSchema, request.body);

      if (payload.id !== request.params.modelId) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Model id does not match route' } });
      }

      services.modelConfigs.save(payload);
      return { ok: true };
    }
  );

  app.post<{ Params: { modelId: string } }>(
    '/api/models/:modelId/test',
    async (request) => services.testModel(request.params.modelId)
  );
}
```

- [ ] **Step 3: Refactor settings.ts to use Zod validation**

Replace `packages/backend/src/routes/settings.ts`:

```typescript
import type { FastifyInstance } from 'fastify';
import { validate } from '@story-weaver/shared/validation';
import { SettingUpdateSchema } from '@story-weaver/shared/schemas/settings-schemas';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../core/chapter-review.js';
import type { RuntimeServices } from '.././runtime/create-runtime-services.js';

function validateSetting(key: string, value: string) {
  if (key === 'scheduler.concurrencyLimit') {
    const trimmed = value.trim();
    if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
      return 'Concurrency limit must be a positive integer';
    }
  }

  if (
    key === SHORT_CHAPTER_REVIEW_ENABLED_KEY &&
    !['true', 'false'].includes(value)
  ) {
    return 'Short chapter review setting must be true or false';
  }

  return null;
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/settings', async () =>
    Object.entries(services.settings.list()).map(([key, value]) => ({
      key,
      value,
    }))
  );

  app.get<{ Params: { key: string } }>(
    '/api/settings/:key',
    async (request) => ({
      key: request.params.key,
      value: services.settings.get(request.params.key),
    })
  );

  app.put<{ Params: { key: string } }>(
    '/api/settings/:key',
    async (request, reply) => {
      const { value } = validate(SettingUpdateSchema, request.body);

      const validationError = validateSetting(request.params.key, value);
      if (validationError) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: validationError } });
      }

      services.settings.set(request.params.key, value);

      if (request.params.key === 'scheduler.concurrencyLimit') {
        const trimmed = value.trim();
        services.setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return { ok: true };
    }
  );
}
```

- [ ] **Step 4: Update existing route tests for new error format**

In `tests/server/books-routes.test.ts`, update the test that checks for `"Invalid book create payload"` to check for the new error format:

```typescript
// Change from:
expect(response.json()).toEqual({ error: 'Invalid book create payload' });

// Change to:
expect(response.json().error.code).toBe('VALIDATION_ERROR');
```

- [ ] **Step 5: Run all server tests**

Run: `pnpm exec vitest run tests/server/`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/routes/books.ts packages/backend/src/routes/models.ts packages/backend/src/routes/settings.ts tests/server/books-routes.test.ts
git commit -m "refactor: replace hand-written type guards with Zod schema validation in routes"
```

---

### Task 11: Tighten CORS and enable conditional logging

**Files:**
- Modify: `packages/backend/src/main.ts`

- [ ] **Step 1: Update CORS configuration in main.ts**

In `packages/backend/src/main.ts`, find the `await app.register(cors, ...)` call and replace:

```typescript
await app.register(cors, {
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  origin: true,
});
```

with:

```typescript
const isDev = !process.env.STORY_WEAVER_SERVER_PORT && !process.env.NODE_ENV;

await app.register(cors, {
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  origin: isDev
    ? ['http://localhost:5173', 'http://127.0.0.1:5173']
    : [],
});
```

- [ ] **Step 2: Enable conditional logging**

In the same file, change:

```typescript
const app = Fastify({ logger: false });
```

to:

```typescript
const app = Fastify({
  logger: process.env.NODE_ENV !== 'test',
});
```

- [ ] **Step 3: Run all server tests**

Run: `pnpm exec vitest run tests/server/`
Expected: All PASS (test environment keeps logger off)

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/main.ts
git commit -m "fix: tighten CORS to dev origins only and enable conditional request logging"
```

---

## Layer 4: Frontend — Error Boundaries, Context, Component Split, SSE Cleanup

### Task 12: Create Error Boundary components

**Files:**
- Create: `packages/frontend/src/components/AppErrorBoundary.tsx`
- Create: `packages/frontend/src/components/PageErrorBoundary.tsx`
- Create: `tests/renderer/error-boundary.test.tsx`

- [ ] **Step 1: Write Error Boundary tests**

Create `tests/renderer/error-boundary.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Component } from 'react';
import { AppErrorBoundary } from '@story-weaver/frontend/components/AppErrorBoundary';
import { PageErrorBoundary } from '@story-weaver/frontend/components/PageErrorBoundary';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Content rendered</div>;
}

describe('AppErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <AppErrorBoundary onToast={vi.fn()}>
        <ThrowingChild shouldThrow={false} />
      </AppErrorBoundary>
    );
    expect(screen.getByText('Content rendered')).toBeInTheDocument();
  });

  it('renders error state when child throws', () => {
    const spy = vi.fn();
    render(
      <AppErrorBoundary onToast={spy}>
        <ThrowingChild shouldThrow={true} />
      </AppErrorBoundary>
    );
    expect(screen.getByText(/出了点问题/)).toBeInTheDocument();
  });
});

describe('PageErrorBoundary', () => {
  it('renders error card when child throws', () => {
    const spy = vi.fn();
    render(
      <PageErrorBoundary onToast={spy}>
        <ThrowingChild shouldThrow={true} />
      </PageErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/renderer/error-boundary.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Create AppErrorBoundary**

Create `packages/frontend/src/components/AppErrorBoundary.tsx`:

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onToast: (tone: 'error', message: string) => void;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onToast('error', error.message || '未知错误');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-medium">出了点问题</h2>
            <button
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => this.setState({ hasError: false })}
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Create PageErrorBoundary**

Create `packages/frontend/src/components/PageErrorBoundary.tsx`:

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onToast: (tone: 'error', message: string) => void;
};

type State = {
  hasError: boolean;
  message: string;
};

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || '页面加载失败' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onToast('error', this.state.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{this.state.message}</p>
          <button
            className="mt-2 text-sm underline"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run tests/renderer/error-boundary.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/components/AppErrorBoundary.tsx packages/frontend/src/components/PageErrorBoundary.tsx tests/renderer/error-boundary.test.tsx
git commit -m "feat: add App and Page level Error Boundaries"
```

---

### Task 13: Create Context providers and useApiCall hook

**Files:**
- Create: `packages/frontend/src/contexts/ModelConfigContext.tsx`
- Create: `packages/frontend/src/contexts/BookContext.tsx`
- Create: `packages/frontend/src/contexts/SchedulerContext.tsx`
- Create: `packages/frontend/src/hooks/useApiCall.ts`

- [ ] **Step 1: Create useApiCall hook**

Create `packages/frontend/src/hooks/useApiCall.ts`:

```typescript
import { useCallback, useRef } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: '资源未找到',
  VALIDATION_ERROR: '输入有误',
  NO_MODEL_CONFIGURED: '未配置模型，请先在设置中添加模型',
  GENERATION_ERROR: '生成失败',
  CONFLICT: '操作冲突',
  INTERNAL_ERROR: '服务器内部错误',
};

type ToastFn = (tone: 'error' | 'success' | 'info', message: string) => void;

export function useApiCall(toast: ToastFn) {
  const toastRef = useRef(toast);
  toastRef.current = toast;

  return useCallback(async function call<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error) {
        const appError = error as Error & { code: string };
        toastRef.current('error', ERROR_MESSAGES[appError.code] ?? appError.message);
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        toastRef.current('error', '网络连接失败');
      } else if (error instanceof Error) {
        toastRef.current('error', error.message || '操作失败，请重试');
      } else {
        toastRef.current('error', '操作失败，请重试');
      }
      return undefined;
    }
  }, []);
}
```

- [ ] **Step 2: Create ModelConfigContext**

Create `packages/frontend/src/contexts/ModelConfigContext.tsx`:

```typescript
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import { useApiCall } from '../hooks/useApiCall';

type ModelConfigView = {
  id: string;
  provider: string;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

type ToastFn = (tone: 'error' | 'success' | 'info', message: string) => void;

type ModelConfigContextValue = {
  modelConfigs: ModelConfigView[];
  shortChapterReviewEnabled: boolean;
  loadModels: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setShortChapterReviewEnabled: (v: boolean) => void;
};

const ModelConfigContext = createContext<ModelConfigContextValue | null>(null);

export function ModelConfigProvider({ children, toast }: { children: ReactNode; toast: ToastFn }) {
  const api = useStoryWeaverApi();
  const call = useApiCall(toast);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigView[]>([]);
  const [shortChapterReviewEnabled, setShortChapterReviewEnabled] = useState(true);

  const loadModels = useCallback(async () => {
    const configs = await api.listModels();
    setModelConfigs(Array.isArray(configs) ? configs : []);
  }, [api]);

  const loadSettings = useCallback(async () => {
    const { parseBooleanSetting } = await import('@story-weaver/shared/settings');
    const { SHORT_CHAPTER_REVIEW_ENABLED_KEY } = await import('@story-weaver/shared/settings');
    const value = await api.getSetting(SHORT_CHAPTER_REVIEW_ENABLED_KEY);
    setShortChapterReviewEnabled(parseBooleanSetting(typeof value === 'string' ? value : null));
  }, [api]);

  return (
    <ModelConfigContext.Provider value={{
      modelConfigs,
      shortChapterReviewEnabled,
      loadModels,
      loadSettings,
      setShortChapterReviewEnabled,
    }}>
      {children}
    </ModelConfigContext.Provider>
  );
}

export function useModelConfigs() {
  const ctx = useContext(ModelConfigContext);
  if (!ctx) throw new Error('useModelConfigs must be used within ModelConfigProvider');
  return ctx;
}
```

- [ ] **Step 3: Create BookContext**

Create `packages/frontend/src/contexts/BookContext.tsx`:

```typescript
import { createContext, useContext, type ReactNode } from 'react';
import { useBooksController } from '../hooks/useBooksController';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';
import type { StoryWeaverApi } from '../hooks/useStoryWeaverApi';

type BookContextValue = ReturnType<typeof useBooksController>;

const BookContext = createContext<BookContextValue | null>(null);

export function BookProvider({ children }: { children: ReactNode }) {
  const api = useStoryWeaverApi();
  const controller = useBooksController(api);
  return (
    <BookContext.Provider value={controller}>
      {children}
    </BookContext.Provider>
  );
}

export function useBookContext() {
  const ctx = useContext(BookContext);
  if (!ctx) throw new Error('useBookContext must be used within BookProvider');
  return ctx;
}
```

- [ ] **Step 4: Create SchedulerContext**

Create `packages/frontend/src/contexts/SchedulerContext.tsx`:

```typescript
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SchedulerStatus, ExecutionLogRecord } from '@story-weaver/shared/contracts';
import { useStoryWeaverApi } from '../hooks/useStoryWeaverApi';

const MAX_EXECUTION_LOGS = 500;

const emptyStatus: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

type SchedulerContextValue = {
  progress: SchedulerStatus;
  executionLogs: ExecutionLogRecord[];
};

const SchedulerContext = createContext<SchedulerContextValue | null>(null);

export function SchedulerProvider({ children }: { children: ReactNode }) {
  const api = useStoryWeaverApi();
  const [progress, setProgress] = useState<SchedulerStatus>(emptyStatus);
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogRecord[]>([]);

  useEffect(() => {
    let isMounted = true;

    void api.getSchedulerStatus().then((payload) => {
      if (isMounted && payload) {
        setProgress(payload);
      }
    });

    const unsubscribe = api.onProgress((payload) => {
      if (isMounted) {
        setProgress(payload as SchedulerStatus);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [api]);

  useEffect(() => {
    const unsubscribe = api.onExecutionLog((payload) => {
      setExecutionLogs((current) => {
        const next = [...current, payload as ExecutionLogRecord];
        return next.length > MAX_EXECUTION_LOGS ? next.slice(-MAX_EXECUTION_LOGS) : next;
      });
    });

    return unsubscribe;
  }, [api]);

  return (
    <SchedulerContext.Provider value={{ progress, executionLogs }}>
      {children}
    </SchedulerContext.Provider>
  );
}

export function useSchedulerContext() {
  const ctx = useContext(SchedulerContext);
  if (!ctx) throw new Error('useSchedulerContext must be used within SchedulerProvider');
  return ctx;
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm --filter @story-weaver/frontend typecheck`
Expected: PASS (contexts and hooks are new files, not wired in yet)

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/contexts/ packages/frontend/src/hooks/useApiCall.ts
git commit -m "feat: add Context providers and useApiCall hook for state management"
```

---

### Task 14: Add AbortSignal to HTTP client and SSE validation

**Files:**
- Modify: `packages/frontend/src/lib/story-weaver-http-client.ts`

- [ ] **Step 1: Add AbortSignal support to requestJson**

In `packages/frontend/src/lib/story-weaver-http-client.ts`, update the `requestJson` function signature to accept an optional signal:

```typescript
async function requestJson<T>(
  baseUrl: string,
  method: HttpMethod,
  pathname: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const requestInit: RequestInit = {
    method,
    signal,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  };

  const response = await fetch(new URL(pathname, baseUrl), requestInit);

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorData = data && typeof data === 'object' && 'error' in data ? data.error : null;
    const code = errorData && typeof errorData === 'object' && 'code' in errorData
      ? (errorData as { code: string }).code
      : undefined;
    const message = errorData && typeof errorData === 'object' && 'message' in errorData
      ? String((errorData as { message: unknown }).message)
      : typeof errorData === 'string'
        ? errorData
        : `HTTP request failed with ${response.status}`;

    const err = new Error(message);
    if (code) (err as any).code = code;
    throw err;
  }

  return data as T;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @story-weaver/frontend typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/src/lib/story-weaver-http-client.ts
git commit -m "feat: add AbortSignal support and structured error parsing to HTTP client"
```

---

### Task 15: Split BookDetail into sub-components

**Files:**
- Create: `packages/frontend/src/pages/book-detail/BookHeader.tsx`
- Create: `packages/frontend/src/pages/book-detail/OutlineSection.tsx`
- Create: `packages/frontend/src/pages/book-detail/NarrativePanel.tsx`
- Create: `packages/frontend/src/pages/book-detail/GenerationProgress.tsx`
- Modify: `packages/frontend/src/pages/BookDetail.tsx`

This is the largest task. The approach:
1. Read the existing `BookDetail.tsx` to identify clear section boundaries
2. Extract each section into its own component file
3. The parent `BookDetail.tsx` imports and composes the sub-components
4. Data flows through Context instead of 60+ props

- [ ] **Step 1: Create BookHeader component**

Create `packages/frontend/src/pages/book-detail/BookHeader.tsx` — extract the title, status badge, and action buttons (pause/resume/restart/export/delete) from the existing BookDetail. This component receives its data from BookContext and SchedulerContext.

- [ ] **Step 2: Create OutlineSection component**

Create `packages/frontend/src/pages/book-detail/OutlineSection.tsx` — extract the outline display/edit panel.

- [ ] **Step 3: Create NarrativePanel component**

Create `packages/frontend/src/pages/book-detail/NarrativePanel.tsx` — extract the characters, plot threads, and narrative graph display.

- [ ] **Step 4: Create GenerationProgress component**

Create `packages/frontend/src/pages/book-detail/GenerationProgress.tsx` — extract the progress bar, live output, and execution logs.

- [ ] **Step 5: Rewrite BookDetail.tsx as a shell**

Rewrite `packages/frontend/src/pages/BookDetail.tsx` to import and compose the sub-components. Remove most props; each sub-component reads from Context. The page shell handles layout only (~150 lines).

- [ ] **Step 6: Verify typecheck and existing tests pass**

Run: `pnpm --filter @story-weaver/frontend typecheck && pnpm exec vitest run tests/renderer/`
Expected: PASS (existing renderer tests may need prop updates)

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/pages/book-detail/ packages/frontend/src/pages/BookDetail.tsx
git commit -m "refactor: split BookDetail into focused sub-components"
```

---

### Task 16: Refactor App.tsx to use Context providers

**Files:**
- Modify: `packages/frontend/src/App.tsx`
- Modify: `packages/frontend/src/main.tsx`

- [ ] **Step 1: Refactor App.tsx**

Rewrite `packages/frontend/src/App.tsx` to:
1. Import the 3 Context providers and `useApiCall`
2. Import `AppErrorBoundary` and `PageErrorBoundary`
3. Remove all direct state management (`useState` for modelConfigs, executionLogs, etc.)
4. Use Context hooks (`useBookContext`, `useModelConfigs`, `useSchedulerContext`) inside route components
5. App becomes ~150 lines: provider tree + route definitions + toast + layout
6. Wrap each `<Route>` element with `<PageErrorBoundary>`

The structure:

```tsx
export default function App() {
  // Toast state (stays here — UI concern)
  const [toast, setToast] = useState<...>(null);
  const showToast = useCallback((tone, message) => { ... }, []);

  return (
    <SidebarProvider ...>
      <AppSidebar />
      <ToastDisplay toast={toast} />
      <SidebarInset>
        <main>
          <ModelConfigProvider toast={showToast}>
            <BookProvider>
              <SchedulerProvider>
                <AppErrorBoundary onToast={showToast}>
                  <AppRoutes showToast={showToast} />
                </AppErrorBoundary>
              </SchedulerProvider>
            </BookProvider>
          </ModelConfigProvider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @story-weaver/frontend typecheck`
Expected: PASS

- [ ] **Step 3: Run renderer tests**

Run: `pnpm exec vitest run tests/renderer/`
Expected: PASS (update any tests that import App directly to wrap in providers)

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/App.tsx packages/frontend/src/main.tsx tests/renderer/
git commit -m "refactor: wire App.tsx to Context providers and Error Boundaries"
```

---

### Task 17: Final integration and cleanup

**Files:**
- Various test files that need updating
- `packages/shared/package.json` exports

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: All PASS

- [ ] **Step 2: Run typecheck across all packages**

Run: `pnpm run typecheck`
Expected: All PASS

- [ ] **Step 3: Verify build succeeds**

Run: `pnpm run build`
Expected: SUCCESS

- [ ] **Step 4: Run architecture boundary tests**

Run: `pnpm exec vitest run tests/architecture/`
Expected: All PASS (storage no longer imports core)

- [ ] **Step 5: Fix any remaining test failures**

Address any test failures from the refactoring. Common issues:
- Components that received props now read from Context — tests need to wrap in providers
- Error response format changed — update assertions
- Import paths changed — update test imports

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: final integration cleanup for comprehensive remediation"
```

---

## Summary

| Layer | Tasks | Key Changes |
|-------|-------|-------------|
| 1 Foundation | 1-4 | Zod, error types, validation utils, tighter contracts |
| 2 Storage | 5-8 | Indexes, transactions, JSON safety, decoupling, TTL |
| 3 Routes | 9-11 | Global error handler, Zod validation, CORS, logging |
| 4 Frontend | 12-16 | Error Boundaries, Context, component split, SSE cleanup |
| Integration | 17 | Full test suite, typecheck, build verification |

**Total: 17 tasks, ~50 commits**
