# Comprehensive Remediation Design

**Date:** 2026-05-02
**Status:** Approved
**Strategy:** Layer-by-layer bottom-up (shared → storage → routes → frontend)
**Delivery:** Single PR to `feature/story-weaver-mvp`
**Breaking changes:** Allowed (pre-release)

## Problem Statement

The codebase has accumulated structural weaknesses across four layers: untyped API boundaries (`unknown`/`as` assertions), unsafe storage operations (no transactions, no indexes, unvalidated JSON parsing), inconsistent backend error handling (no global handler, hand-written type guards, permissive CORS), and frontend architectural debt (1249-line components, 60+ prop drilling, no Error Boundaries, unbounded memory growth).

## Design

### Layer 1: Foundation — Shared Contracts + Error Types + Zod

#### 1.1 Custom Error Type Hierarchy (`packages/shared/src/errors.ts`)

```
AppError (base: { code: string; statusCode: number; message: string; details?: unknown })
├── NotFoundError          (404, NOT_FOUND)
├── ValidationError        (400, VALIDATION_ERROR, details: { field: string; reason: string }[])
├── NoModelConfiguredError (400, NO_MODEL_CONFIGURED)
├── GenerationError        (500, GENERATION_ERROR, details: { originalError: string })
└── ConflictError          (409, CONFLICT)
```

Each error carries a `code` string. Frontend dispatches on `code` rather than parsing `message` text. Backend global error handler serializes all errors to `{ error: { code, message, details? } }`.

#### 1.2 Zod Schemas (`packages/shared/src/schemas/`)

Define Zod schemas for every API request/response body and SSE event payload:

- `book-schemas.ts` — `BookCreateSchema`, `BookActionSchema`, `BookRecordSchema`
- `model-schemas.ts` — `ModelSaveSchema`, `ModelConfigSchema`
- `settings-schemas.ts` — `SettingUpdateSchema`, `SettingRecordSchema`
- `event-schemas.ts` — `SchedulerStatusSchema`, `BookGenerationEventSchema`, `ExecutionLogSchema`

Derive TypeScript types via `z.infer<typeof XxxSchema>`, replacing hand-written interfaces and `unknown` types in `contracts.ts`. Specifically:

- `report: unknown` → concrete `NarrativeCheckpointReport` type
- `futureCardRevisions: unknown[]` → `FutureCardRevision[]`
- `config: Record<string, unknown>` → typed model config with known fields

#### 1.3 Validation Utilities (`packages/shared/src/validation.ts`)

- `validate<T>(schema: ZodSchema<T>, data: unknown): T` — validates and returns typed data; throws `ValidationError` on failure
- `safeValidate<T>(schema, data): { success: true; data: T } | { success: false; error: ValidationError }` — non-throwing variant

Both backend routes and frontend SSE handlers use these utilities.

### Layer 2: Storage — Transactions, Indexes, JSON Safety, Decoupling

#### 2.1 Database Indexes

Add indexes via Drizzle schema `.index()` declarations:

| Table | Column(s) | Purpose |
|---|---|---|
| `books` | `status` | Filter active books |
| `chapters` | `book_id` | Chapter lookup by book |
| `api_logs` | `book_id, created_at` | Log queries |
| `writing_progress` | `book_id` | Progress queries |

Generate migration via `drizzle-kit generate`.

#### 2.2 Transaction Wrapping

Wrap multi-step operations with `db.transaction()`:

- `books.ts delete()` — book + chapters + characters + progress + narrative data
- `books.ts clearGeneratedState()` — generated content cleanup
- `characters.ts save()` — character + state batch upsert
- `chapter-cards.ts` batch operations

If any step fails, the entire transaction rolls back.

#### 2.3 JSON Column Validation

All `JSON.parse()` calls in storage files (`story-bibles.ts`, `chapter-cards.ts`, `chapter-audits.ts`, `model-configs.ts`) gain:

1. try-catch around parse
2. Zod schema validation of parsed result
3. On failure: log warning and return empty default value (never throw from a read operation on corrupted data)

#### 2.4 Eliminate Reverse Dependencies

Storage files (`chapter-cards.ts`, `chapter-audits.ts`, `story-bibles.ts`) currently import types from `../core/narrative/types.js`. Change:

- Storage layer operates on raw DB row types only
- Define mapping functions within each storage module that return plain objects matching shared contract types
- Core aggregates import from storage and shared; storage never imports from core

#### 2.5 Export Registry Cleanup (`export-registry.ts`)

Add to `ExportDownload` entries:

- `createdAt: number` timestamp on registration
- On every `get()` call, sweep entries older than 30 minutes
- Reject new registrations when map exceeds 50 entries
- Throw `ConflictError` on overflow

#### 2.6 SQL Safety (`migrate.ts`)

Replace `quoteSqlString()` string concatenation with a safe approach. SQLite's `VACUUM INTO` does not support parameterized paths, so validate the path strictly (must be under `STORY_WEAVER_ROOT_DIR`, no path traversal) before interpolation.

### Layer 3: Backend Routes — Error Handler, Zod Validation, CORS

#### 3.1 Global Error Handler (`main.ts`)

Register in `buildServer()`:

```
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) → reply.status(error.statusCode).send({ error: { code, message, details } })
  if (error.validation) → convert to ValidationError format → 400
  else → log error, reply 500 with generic message
})

app.setNotFoundHandler((request, reply) → 404 { error: { code: "NOT_FOUND", message: "..." } })
```

#### 3.2 Route Validation Refactor

Replace all hand-written type guards (`isBookCreatePayload`, `isModelSavePayload`, etc.) with:

```typescript
const payload = validate(BookCreateSchema, req.body);
```

Delete all `isXxxPayload` functions from route files. Validation errors are automatically caught by the global error handler.

#### 3.3 CORS Tightening

Change from `origin: true` to:

```typescript
cors: {
  origin: process.env.NODE_ENV === 'production'
    ? []  // same-origin only in production (frontend served from same server)
    : ['http://localhost:5173', 'http://127.0.0.1:5173']
}
```

#### 3.4 Request Logging

Enable Fastify logger conditionally:

```typescript
logger: process.env.NODE_ENV !== 'test'
```

This adds request IDs and structured logging without test noise.

### Layer 4: Frontend — Error Boundaries, Context, Component Split, SSE Cleanup

#### 4.1 Error Boundaries

Two levels:

- **`AppErrorBoundary`** — wraps the route outlet. Catches unexpected errors, renders a full-page error state with retry button. Sidebar navigation remains functional.
- **`PageErrorBoundary`** — wraps each page component. Catches page-level errors, renders an inline error card. Sidebar remains functional.

Both use `componentDidCatch` to push error info to the toast system.

#### 4.2 State Management via Context

Extract state from App.tsx into 3 Context providers:

| Context | State | Hook |
|---|---|---|
| `ModelConfigContext` | `modelConfigs`, `shortChapterReviewEnabled`, CRUD actions | `useModelConfigs()` |
| `BookContext` | `books`, `selectedBookId`, `selectedBookDetail`, load/select actions | `useBooksController()` (enhanced) |
| `SchedulerContext` | `progress`, SSE subscription, generation events, `executionLogs` | `useProgress()` + `useBookGenerationEvents()` (enhanced) |

App.tsx reduces to ~150 lines: provider tree + route definitions + layout.

#### 4.3 BookDetail Component Split (1249 → ~5 focused components)

| Component | Responsibility | ~Lines |
|---|---|---|
| `BookDetail.tsx` | Page shell, composes children | ~150 |
| `BookHeader.tsx` | Title, status badge, action buttons | ~120 |
| `OutlineSection.tsx` | Outline display/edit | ~150 |
| `ChapterList.tsx` | Chapter list with auto-reveal (existing, enhanced) | ~250 |
| `NarrativePanel.tsx` | Characters, plot threads, narrative graph | ~200 |
| `GenerationProgress.tsx` | Progress bar, generation logs | ~150 |

Each component reads from Context. No more 60+ prop drilling through BookDetail.

#### 4.4 SSE Cleanup & Request Cancellation

- `requestJson` in `story-weaver-http-client.ts` gains optional `signal?: AbortSignal` parameter
- All fetch calls in hooks pass an `AbortController.signal` from `useEffect` cleanup
- `executionLogs` array capped at 500 entries; oldest discarded on overflow

#### 4.5 Unified Frontend Error Handling

Create `useApiCall` hook:

```typescript
function useApiCall() {
  return async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError) {
        showToast(ERROR_MESSAGES[error.code] ?? error.message);
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        showToast('网络连接失败');
      } else {
        showToast('操作失败，请重试');
      }
    }
  };
}
```

All API call sites use this hook instead of ad-hoc try-catch blocks. `ERROR_MESSAGES` is a `Record<string, string>` constant mapping error codes to Chinese UI strings (e.g., `{ NOT_FOUND: '资源未找到', VALIDATION_ERROR: '输入有误', ... }`).

## File Map (New/Modified)

### New Files
- `packages/shared/src/errors.ts`
- `packages/shared/src/schemas/book-schemas.ts`
- `packages/shared/src/schemas/model-schemas.ts`
- `packages/shared/src/schemas/settings-schemas.ts`
- `packages/shared/src/schemas/event-schemas.ts`
- `packages/shared/src/validation.ts`
- `packages/frontend/src/components/AppErrorBoundary.tsx`
- `packages/frontend/src/components/PageErrorBoundary.tsx`
- `packages/frontend/src/contexts/ModelConfigContext.tsx`
- `packages/frontend/src/contexts/BookContext.tsx`
- `packages/frontend/src/contexts/SchedulerContext.tsx`
- `packages/frontend/src/hooks/useApiCall.ts`
- `packages/frontend/src/pages/book-detail/BookHeader.tsx`
- `packages/frontend/src/pages/book-detail/OutlineSection.tsx`
- `packages/frontend/src/pages/book-detail/NarrativePanel.tsx`
- `packages/frontend/src/pages/book-detail/GenerationProgress.tsx`

### Modified Files
- `packages/shared/src/contracts.ts` — replace `unknown` types with Zod-derived types
- `packages/shared/src/index.ts` — export new modules
- `packages/backend/src/main.ts` — global error handler, CORS, logger
- `packages/backend/src/routes/*.ts` — Zod validation, remove type guards
- `packages/backend/src/storage/schema.ts` — add indexes
- `packages/backend/src/storage/books.ts` — transaction wrapping
- `packages/backend/src/storage/characters.ts` — transaction wrapping
- `packages/backend/src/storage/chapter-cards.ts` — JSON validation, remove core imports
- `packages/backend/src/storage/chapter-audits.ts` — JSON validation, remove core imports
- `packages/backend/src/storage/story-bibles.ts` — JSON validation, remove core imports
- `packages/backend/src/storage/model-configs.ts` — JSON validation
- `packages/backend/src/storage/migrate.ts` — parameterized queries
- `packages/backend/src/export-registry.ts` — TTL + capacity limit
- `packages/frontend/src/App.tsx` — reduce to layout + providers + routes
- `packages/frontend/src/pages/BookDetail.tsx` — split into sub-components
- `packages/frontend/src/lib/story-weaver-http-client.ts` — AbortSignal support
- `packages/frontend/src/hooks/useProgress.ts` — Zod validation on SSE data
- `packages/frontend/src/hooks/useBookGenerationEvents.ts` — Zod validation on SSE data

### Deleted Patterns
- All `isXxxPayload` type guard functions in route files
- Direct `JSON.parse()` without try-catch in storage files
- All `as UnknownType` assertions in frontend hooks

## Testing

- **Layer 1:** Unit tests for error classes, Zod schemas (valid/invalid inputs), `validate`/`safeValidate` utilities
- **Layer 2:** Storage tests for transaction rollback, JSON parse resilience, index existence
- **Layer 3:** Route tests using global error handler, Zod rejection cases, CORS header checks
- **Layer 4:** Component tests for Error Boundary behavior, Context provider tests, SSE cleanup verification
- **Integration:** Existing test suite must pass; architecture import boundary tests updated

## Non-Goals

- UI redesign or new user-facing features
- Model provider changes
- Database schema redesign (only adding indexes)
- Performance optimization beyond indexes
- Migration to external state management library (Redux, Zustand)
- Rate limiting (local-only app, not needed yet)
