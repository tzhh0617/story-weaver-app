# Architecture Hardening Design

**Goal:** Tighten the current architecture without changing the app's user-facing workflow.

**Scope:** This pass addresses IPC contract safety, library progress loading, renderer orchestration weight, runtime composition weight, and book deletion ownership.

## Current Shape

The app has a healthy top-level split: Electron main process in `electron/`, React UI in `renderer/`, pure domain logic in `src/core`, persistence in `src/storage`, and shared DTOs in `src/shared`. The weak spots are mostly at boundaries: IPC accepts unvalidated `unknown` payloads, the renderer computes list progress by issuing a detail request per book, and the runtime/app root files coordinate too many concerns.

## Design

IPC channels get a typed map in shared code. Main-process handlers use shared assertion helpers before touching payload fields. Renderer code continues to call `window.storyWeaver.invoke`, but the local hook receives typed overloads so common channel calls no longer rely on ad hoc generics.

Book list progress moves to the core service. `book:list` returns `BookListItem[]`, extending `BookRecord` with `progress`, `completedChapters`, and `totalChapters`. This removes the renderer's N+1 detail calls while keeping the channel name stable.

Renderer orchestration is reduced by moving book loading and live generation event handling into focused hooks. `App.tsx` remains the layout/view coordinator, but data-fetch and event-update logic lives in reusable units.

Runtime composition is reduced by extracting AI service adapter creation from `electron/runtime.ts`. The runtime keeps wiring services together, but provider/mock switching and model invocation wrappers move behind a factory.

Book deletion becomes explicit at the service level. The persistence repository can still perform table-level cleanup, but the service contract documents that deleting a book graph includes generated content, continuity state, progress, and narrative planning records.

## Testing

Use focused TDD:

- IPC contract tests for payload validation.
- Book service tests for list progress.
- Renderer shell tests proving library load no longer calls `book:detail` for every listed book.
- Runtime typecheck and existing runtime/mock tests for adapter extraction.
- Book service deletion tests for narrative records.

## Non-Goals

This pass does not redesign UI, change model providers, migrate SQLite schemas, or replace the preload bridge API. It keeps behavior stable while making the next feature easier to land.
