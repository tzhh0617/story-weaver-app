# Execution Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global Logs menu module where current-run background execution events stream in realtime.

**Architecture:** Keep execution records in a runtime-only event stream through `src/storage/logs.ts`, expose them through a new `logs:event` IPC push channel, record scheduler and generation lifecycle events in `electron/runtime.ts`, and render a `renderer/pages/Logs.tsx` view from the existing app shell.

**Tech Stack:** Electron IPC, better-sqlite3, React, Vitest, Testing Library, shadcn-style local UI primitives, lucide-react.

---

## File Structure

- `src/shared/contracts.ts`: add `ExecutionLogRecord` and `logs:event`.
- `src/storage/migrations.ts`: make sure no execution log persistence table is created.
- `src/storage/logs.ts`: implement the realtime stream.
- `electron/runtime.ts`: construct the log stream and emit execution events.
- `electron/ipc/logs.ts`: register the logs event forwarder.
- `electron/main.ts`: register logs IPC.
- `electron/preload.cts`: expose `onExecutionLog`.
- `renderer/hooks/useIpc.ts`: add the renderer fallback for `onExecutionLog`.
- `renderer/components/app-sidebar.tsx`: add the Logs nav item.
- `renderer/App.tsx`: add realtime log state, route handling, and subscription cleanup.
- `renderer/pages/Logs.tsx`: new logs page.
- `tests/storage/logs.test.ts`: storage behavior tests.
- `tests/core/ipc-contracts.test.ts`: contract coverage.
- `tests/renderer/app-shell.test.tsx`: UI routing and filtering coverage.

## Tasks

### Task 1: Realtime Stream And Contracts

- [x] Write failing tests for `ExecutionLogRecord`, `logs:event`, no `logs:list`, realtime stream emission, and no SQLite log table.
- [x] Run the focused tests and verify they fail because contracts/stream behavior are missing.
- [x] Add the shared types, remove the persistence table, and implement the realtime stream.
- [x] Run the focused tests and verify they pass.

### Task 2: Runtime And IPC Logging

- [x] Write failing tests or extend focused coverage showing runtime-created logs are emitted through `subscribeExecutionLogs`.
- [x] Add `electron/ipc/logs.ts` and register it from `electron/main.ts`.
- [x] Wire `createExecutionLogStream` into runtime services.
- [x] Record command and lifecycle logs for start, start all, pause all, resume, restart, progress, chapter completion, errors, and completion.
- [x] Run focused tests and typecheck.

### Task 3: Renderer Logs Page

- [x] Write failing renderer tests for the `日志` sidebar item, realtime append, autoscroll, empty state, book filtering, level filtering, and search.
- [x] Add `renderer/pages/Logs.tsx`.
- [x] Extend `AppView`, navigation items, `App.tsx` realtime log subscription, and Logs page filters.
- [x] Run focused renderer tests.

### Task 4: Verification

- [x] Run `pnpm exec vitest run tests/storage/logs.test.ts tests/core/ipc-contracts.test.ts tests/renderer/app-shell.test.tsx`.
- [x] Run `pnpm run typecheck`.
- [x] Inspect changed files for unrelated churn.
