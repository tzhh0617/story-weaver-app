# Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen IPC, remove library-list N+1 loading, and split the largest orchestration files without changing user-facing behavior.

**Architecture:** Keep existing module boundaries. Add small shared IPC helpers, move list progress to core, extract renderer hooks, and extract Electron AI runtime adapters behind a factory.

**Tech Stack:** TypeScript, Electron IPC, React hooks, Vitest, better-sqlite3.

---

### Task 1: Typed IPC Contract And Runtime Payload Validation

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `electron/ipc/books.ts`
- Modify: `electron/ipc/models.ts`
- Modify: `electron/ipc/settings.ts`
- Test: `tests/core/ipc-contracts.test.ts`

- [ ] Add channel payload/response types for existing IPC calls.
- [ ] Add `assertIpcPayload(channel, payload)` with focused validators for payload-bearing channels.
- [ ] Run `pnpm exec vitest run tests/core/ipc-contracts.test.ts` and verify new tests fail before implementation.
- [ ] Use the assertion helper in Electron IPC handlers.
- [ ] Re-run the IPC contract test and typecheck.

### Task 2: Book List Progress From Core

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/core/book-service.ts`
- Modify: `renderer/App.tsx`
- Test: `tests/core/book-service.test.ts`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] Add a failing book-service test that `listBooks()` returns `progress`, `completedChapters`, and `totalChapters`.
- [ ] Add a failing renderer test that initial library load does not call `book:detail` merely to compute card progress.
- [ ] Implement list progress in `createBookService`.
- [ ] Update `App.tsx` to trust the list payload.
- [ ] Run focused core and renderer tests.

### Task 3: Renderer Hooks Extraction

**Files:**
- Create: `renderer/hooks/useBooksController.ts`
- Create: `renderer/hooks/useBookGenerationEvents.ts`
- Modify: `renderer/App.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] Move book/model/settings load helpers into hooks only after Task 2 is green.
- [ ] Move `onBookGeneration` live-output/detail-refresh handling into a focused hook.
- [ ] Keep component props and visible UI unchanged.
- [ ] Run renderer shell tests.

### Task 4: Runtime AI Adapter Extraction

**Files:**
- Create: `electron/runtime-ai-services.ts`
- Modify: `electron/runtime.ts`
- Test: `tests/electron/runtime-mock-fallback.test.ts`

- [ ] Extract mock/real AI service creation behind `createRuntimeAiServices`.
- [ ] Preserve environment model config behavior and mock streaming behavior.
- [ ] Run runtime mock fallback tests and typecheck.

### Task 5: Explicit Book Graph Deletion

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `src/storage/books.ts`
- Test: `tests/core/narrative-book-service.test.ts`

- [ ] Add a failing test proving deleting a narrative-planned book removes narrative records.
- [ ] Make deletion ownership explicit in the service/storage boundary.
- [ ] Run narrative book-service tests and storage tests.

### Task 6: Final Verification

**Files:**
- All touched files

- [ ] Run `pnpm run typecheck`.
- [ ] Run focused Vitest suites touched above.
- [ ] Run `pnpm test` if focused suites pass in reasonable time.
