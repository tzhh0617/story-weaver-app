# Book Detail Live Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the book detail page show the complete chapter list, current generation step, current chapter, and live streamed chapter output.

**Architecture:** Add a typed book-generation event contract shared by core, Electron, and renderer. The core service emits fine-grained progress and chapter stream events while the renderer keeps live stream text in memory and refreshes persisted detail data after completion events. Existing scheduler progress continues to drive library summaries.

**Tech Stack:** TypeScript, React, Electron IPC, Vitest, Testing Library, AI SDK `generateText`/`streamText`.

---

## File Structure

- Modify `src/shared/contracts.ts`: add `BookGenerationEvent`, progress metadata, and `bookGeneration` IPC channel.
- Modify `src/core/chapter-writer.ts`: support optional `onChunk` callback and optional streaming text provider.
- Modify `src/core/book-service.ts`: accept `onGenerationEvent`, emit progress/stream events, and include progress metadata.
- Modify `electron/runtime.ts`: bridge core generation events to listeners and use AI SDK streaming for real model runs.
- Modify `electron/preload.cts`: expose `onBookGeneration`.
- Modify `renderer/hooks/useIpc.ts`: type and provide fallback for `onBookGeneration`.
- Modify `renderer/types/book-detail.ts`: include progress metadata.
- Modify `renderer/App.tsx`: subscribe to generation events and pass active event state to `BookDetail`.
- Modify `renderer/components/ChapterList.tsx`: render all chapter states, active row, outline-only rows, and selection.
- Modify `renderer/pages/BookDetail.tsx`: add progress and live output panels plus chapter selection.
- Modify tests in `tests/core/chapter-writer.test.ts`, `tests/core/book-service.test.ts`, `tests/renderer/book-detail.test.tsx`, and `tests/renderer/app-shell.test.tsx`.

## Task 1: Shared Event Contract And Chapter Writer Streaming

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/core/chapter-writer.ts`
- Test: `tests/core/chapter-writer.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving `writeChapter` forwards chunks and still returns full content:

```ts
it('forwards streaming chunks while returning the final chapter text', async () => {
  const streamText = vi.fn(async function* () {
    yield '第一段';
    yield '第二段';
  });
  const onChunk = vi.fn();
  const writer = createChapterWriter({
    generateText: vi.fn(),
    streamText,
  });

  const result = await writer.writeChapter({
    prompt: 'Write chapter 1',
    onChunk,
  });

  expect(onChunk).toHaveBeenNthCalledWith(1, '第一段');
  expect(onChunk).toHaveBeenNthCalledWith(2, '第二段');
  expect(result.content).toBe('第一段第二段');
});
```

- [ ] **Step 2: Verify red**

Run: `pnpm vitest run tests/core/chapter-writer.test.ts`

Expected: FAIL because `streamText` and `onChunk` are not supported.

- [ ] **Step 3: Implement minimal contract and writer support**

Add `BookGenerationEvent` and `bookGeneration` channel. Update `createChapterWriter` so it uses `streamText` when provided and `onChunk` is passed, otherwise it keeps the existing `generateText` path.

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run tests/core/chapter-writer.test.ts`

Expected: PASS.

## Task 2: Core Book Service Progress Events

**Files:**
- Modify: `src/core/book-service.ts`
- Test: `tests/core/book-service.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving `writeNextChapter` emits `progress`, `chapter-stream`, and `chapter-complete` events in order and passes chunk callbacks into `chapterWriter.writeChapter`.

- [ ] **Step 2: Verify red**

Run: `pnpm vitest run tests/core/book-service.test.ts`

Expected: FAIL because `onGenerationEvent`, `currentChapter`, and stream events do not exist.

- [ ] **Step 3: Implement minimal core events**

Add an optional `onGenerationEvent` dependency. Emit:

- `progress` with `phase: 'writing'`, `stepLabel: '正在写第 N 章'`, `currentVolume`, `currentChapter`
- `chapter-stream` for every chunk
- `progress` with `stepLabel: '正在生成第 N 章摘要与连续性'` before post-chapter extraction
- `chapter-complete` after persistence

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run tests/core/book-service.test.ts`

Expected: PASS.

## Task 3: Electron IPC Bridge

**Files:**
- Modify: `electron/runtime.ts`
- Modify: `electron/preload.cts`
- Modify: `renderer/hooks/useIpc.ts`
- Test: `tests/electron/runtime-mock-fallback.test.ts`

- [ ] **Step 1: Write failing tests**

Add coverage that the mock runtime exposes `subscribeBookGeneration` and emits deterministic chapter stream events when a mock chapter is written.

- [ ] **Step 2: Verify red**

Run: `pnpm vitest run tests/electron/runtime-mock-fallback.test.ts`

Expected: FAIL because the subscription does not exist.

- [ ] **Step 3: Implement IPC bridge**

Add `bookGenerationListeners`, subscribe/unsubscribe support, and forward events through `ipcChannels.bookGeneration`. Expose `onBookGeneration` in preload and renderer IPC fallback.

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run tests/electron/runtime-mock-fallback.test.ts`

Expected: PASS.

## Task 4: Book Detail UI

**Files:**
- Modify: `renderer/components/ChapterList.tsx`
- Modify: `renderer/pages/BookDetail.tsx`
- Modify: `renderer/types/book-detail.ts`
- Test: `tests/renderer/book-detail.test.tsx`

- [ ] **Step 1: Write failing tests**

Add renderer tests for all planned chapters, active current chapter, step label panel, selected outline fallback, and live stream chunks.

- [ ] **Step 2: Verify red**

Run: `pnpm vitest run tests/renderer/book-detail.test.tsx`

Expected: FAIL because progress/live panels and selectable chapter rows do not exist.

- [ ] **Step 3: Implement UI**

Update chapter rows to buttons, add active styling, add progress and live output sections, and make selected chapter preview prefer live text, saved content, then outline.

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run tests/renderer/book-detail.test.tsx`

Expected: PASS.

## Task 5: App Event Wiring

**Files:**
- Modify: `renderer/App.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write failing tests**

Add tests proving `App` subscribes to `onBookGeneration`, appends stream chunks for the selected book, ignores other books, and refreshes detail after completion.

- [ ] **Step 2: Verify red**

Run: `pnpm vitest run tests/renderer/app-shell.test.tsx`

Expected: FAIL because App only subscribes to scheduler progress.

- [ ] **Step 3: Implement event state**

Store active generation event state in `App`, clear it on book switch, pass it into `BookDetail`, and refresh selected detail on `chapter-complete` or `error`.

- [ ] **Step 4: Verify green**

Run: `pnpm vitest run tests/renderer/app-shell.test.tsx`

Expected: PASS.

## Task 6: Full Verification

**Files:**
- All touched files

- [ ] **Step 1: Run focused suites**

Run:

```bash
pnpm vitest run tests/core/chapter-writer.test.ts tests/core/book-service.test.ts tests/renderer/book-detail.test.tsx tests/renderer/app-shell.test.tsx tests/electron/runtime-mock-fallback.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run full test suite if focused checks pass**

Run: `pnpm test`

Expected: PASS.

## Self-Review

- Spec coverage: complete chapter list is covered in Task 4; current step and chapter metadata are covered in Tasks 2 and 4; stream events are covered in Tasks 1, 2, 3, and 5.
- Placeholder scan: no `TBD`, `TODO`, or undefined future work remains.
- Type consistency: event names and fields use the shared `BookGenerationEvent` contract from Task 1 throughout later tasks.
