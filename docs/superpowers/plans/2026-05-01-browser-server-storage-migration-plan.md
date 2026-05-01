# Browser Server Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

> **Superseded:** 这份计划记录了中间迁移态，当时还保留 `/api/invoke`
> 和 IPC channel 兼容层。当前目标架构以
> `docs/superpowers/specs/2026-05-01-server-api-runtime-design.md` 为准：
> 所有业务调用使用具名 HTTP API / SSE，不再使用 `xxx:xxxx` channel
> 调用。

**Goal:** Let the existing Vite renderer run in a normal browser against a local Node server while sharing the same durable SQLite data and migration path as the Electron app.

**Architecture:** Keep the renderer and Electron shell intact. Extract the current Electron runtime composition into a shared runtime factory, add Fastify as a thin HTTP/SSE transport, and make the renderer choose Electron IPC or browser HTTP based on environment. Introduce Drizzle as the schema/migration manager while keeping existing `better-sqlite3` repositories in place.

**Tech Stack:** TypeScript, Vite React, Electron IPC, Fastify, SQLite, `better-sqlite3`, Drizzle Kit, Vitest.

---

## File Structure

- Create `drizzle.config.ts`: Drizzle Kit config for SQLite migration generation.
- Create `src/storage/schema.ts`: Drizzle table definitions matching existing SQLite tables.
- Create `src/storage/migrate.ts`: Runtime migration and backup helper.
- Modify `src/storage/database.ts`: Replace destructive development reset with safe migration orchestration.
- Create `src/runtime/create-runtime-services.ts`: Shared runtime factory used by Electron and Fastify.
- Modify `electron/runtime.ts`: Thin Electron singleton wrapper around shared runtime.
- Create `server/main.ts`: Fastify startup.
- Create `server/channel-dispatch.ts`: Maps shared IPC channel names to runtime methods.
- Create `server/routes/invoke.ts`: `POST /api/invoke` transport.
- Create `server/routes/events.ts`: SSE event transport.
- Create `server/routes/health.ts`: Runtime health endpoint.
- Create `tsconfig.server.json`: NodeNext TypeScript config for server files.
- Modify `package.json`: Add Fastify, Drizzle, server scripts, and build script.
- Modify `renderer/hooks/useIpc.ts`: Choose Electron IPC when available and browser HTTP/SSE otherwise.
- Create `renderer/lib/story-weaver-http-client.ts`: Browser transport implementation.
- Test `tests/storage/database.test.ts`: Migration safety and non-destructive startup.
- Test `tests/storage/migrate.test.ts`: Backup and migration table behavior.
- Test `tests/runtime/create-runtime-services.test.ts`: Shared runtime can boot against a temp data directory.
- Test `tests/server/invoke.test.ts`: HTTP invoke dispatch.
- Test `tests/renderer/http-transport.test.tsx`: Browser fallback calls HTTP transport.

---

### Task 1: Database Safety Baseline

**Files:**
- Modify: `tests/storage/database.test.ts`
- Modify: `src/storage/database.ts`

- [x] **Step 1: Write failing migration safety test**

Add a test that creates an older development-shaped database with a `books` row and a legacy `chapters.outline` column, then opens it with `createDatabase(filePath)` and expects the `books` row to remain. This fails against the current `shouldResetDevelopmentStorySchema` path because startup drops story tables.

- [x] **Step 2: Run focused test and verify red**

Run: `pnpm exec vitest run tests/storage/database.test.ts -t "does not drop existing books" --reporter=dot`

Expected: FAIL because the current migration path resets the story schema.

- [x] **Step 3: Remove destructive reset from normal migration path**

Change `runMigrations` so it only creates missing tables and additive columns. Do not call `resetDevelopmentStorySchema` during normal `createDatabase` startup. Keep any destructive helper unexported and unused, or remove it entirely if no tests require it.

- [x] **Step 4: Verify green**

Run: `pnpm exec vitest run tests/storage/database.test.ts --reporter=dot`

Expected: PASS.
---

### Task 2: Add Drizzle Migration Layer Without Rewriting Repositories

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/storage/schema.ts`
- Create: `src/storage/migrate.ts`
- Modify: `src/storage/database.ts`
- Modify: `package.json`
- Test: `tests/storage/migrate.test.ts`

- [x] **Step 1: Install migration dependencies**

Run: `pnpm add drizzle-orm && pnpm add -D drizzle-kit`

- [x] **Step 2: Write failing migration runner test**

Create `tests/storage/migrate.test.ts` with a temp directory database. Assert that `migrateDatabase(db, { migrationsFolder })` creates a migration metadata table and can be run twice without changing existing rows.

- [x] **Step 3: Verify red**

Run: `pnpm exec vitest run tests/storage/migrate.test.ts --reporter=dot`

Expected: FAIL because `src/storage/migrate.ts` does not exist.

- [x] **Step 4: Add Drizzle config and schema**

Add Drizzle table declarations for all existing tables in `src/storage/schema.ts`. Keep field names aligned with current SQL column names so existing repositories remain compatible.

- [x] **Step 5: Add migration runner**

Implement `src/storage/migrate.ts` with `drizzle-orm/better-sqlite3/migrator`. It receives an open `better-sqlite3` database and a migrations folder. It does not own repository creation.

- [x] **Step 6: Verify migration tests**

Run: `pnpm exec vitest run tests/storage/migrate.test.ts tests/storage/database.test.ts --reporter=dot`

Expected: PASS.

---

### Task 3: Extract Shared Runtime Factory

**Files:**
- Create: `src/runtime/create-runtime-services.ts`
- Create: `src/runtime/app-paths.ts`
- Modify: `electron/runtime.ts`
- Test: `tests/runtime/create-runtime-services.test.ts`
- Test: `tests/server/runtime-lifecycle.test.ts`

- [x] **Step 1: Write failing shared runtime boot test**

Create a test that calls `createRuntimeServices({ rootDir: tempDir })`, lists books, saves a setting, and closes cleanly if a close method is introduced.

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run tests/runtime/create-runtime-services.test.ts --reporter=dot`

Expected: FAIL because the shared runtime factory does not exist.

- [x] **Step 3: Move runtime composition**

Move the service composition currently inside `electron/runtime.ts` into `src/runtime/create-runtime-services.ts`. Keep Electron-specific IPC registration and BrowserWindow code in `electron/`.

- [x] **Step 4: Keep Electron singleton wrapper**

Update `electron/runtime.ts` so `getRuntimeServices()` calls `createRuntimeServices({ rootDir: path.join(os.homedir(), '.story-weaver') })`.

- [x] **Step 5: Verify runtime behavior**

Run: `pnpm exec vitest run tests/runtime/create-runtime-services.test.ts tests/server/runtime-lifecycle.test.ts --reporter=dot`

Expected: PASS.

---

### Task 4: Add Fastify Invoke Transport

**Files:**
- Create: `server/main.ts`
- Create: `server/channel-dispatch.ts`
- Create: `server/routes/invoke.ts`
- Create: `server/routes/health.ts`
- Create: `tsconfig.server.json`
- Modify: `package.json`
- Test: `tests/server/invoke.test.ts`

- [x] **Step 1: Install server dependency**

Run: `pnpm add fastify @fastify/cors`

- [x] **Step 2: Write failing invoke route test**

Create a test that starts the Fastify app with a temp runtime root, posts `{ "channel": "book:list" }` to `/api/invoke`, and expects an empty array.

- [x] **Step 3: Verify red**

Run: `pnpm exec vitest run tests/server/invoke.test.ts --reporter=dot`

Expected: FAIL because the server app does not exist.

- [x] **Step 4: Implement channel dispatch**

Map existing `ipcChannels` to runtime service calls. Reuse `assertIpcPayload` before dispatching any payload-bearing channel.

- [x] **Step 5: Implement Fastify app**

Register JSON body handling, CORS for local development, `/api/health`, and `/api/invoke`. Export a `buildServer` function for tests and a `main` startup path for CLI usage.

- [x] **Step 6: Verify server tests**

Run: `pnpm exec vitest run tests/server/invoke.test.ts --reporter=dot`

Expected: PASS.

---

### Task 5: Add SSE Event Transport

**Files:**
- Create: `server/routes/events.ts`
- Modify: `server/main.ts`
- Test: `tests/server/events.test.ts`

- [x] **Step 1: Write failing SSE subscription test**

Start the server with a temp runtime root, subscribe to `/api/events/execution-logs`, emit or trigger one log event through runtime behavior, and assert an SSE `data:` frame is received.

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run tests/server/events.test.ts --reporter=dot`

Expected: FAIL because event routes are absent.

- [x] **Step 3: Implement SSE helper**

Add a shared helper that writes `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and closes the runtime subscription when the request closes.

- [x] **Step 4: Register event endpoints**

Add endpoints for book generation, execution logs, and scheduler status. Serialize each event as one `data: ${JSON.stringify(event)}\n\n` frame.

- [x] **Step 5: Verify event tests**

Run: `pnpm exec vitest run tests/server/events.test.ts --reporter=dot`

Expected: PASS.

---

### Task 6: Browser HTTP/SSE Renderer Transport

**Files:**
- Create: `renderer/lib/story-weaver-http-client.ts`
- Modify: `renderer/hooks/useIpc.ts`
- Test: `tests/renderer/http-transport.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [x] **Step 1: Write failing browser fallback test**

Delete `window.storyWeaver`, mock `fetch`, call the hook through a tiny test component, invoke `book:list`, and assert it posts to `/api/invoke`.

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run tests/renderer/http-transport.test.tsx --reporter=dot`

Expected: FAIL because the current fallback is a no-op.

- [x] **Step 3: Implement HTTP invoke client**

Add `invoke(channel, payload)` that posts `{ channel, payload }` to `/api/invoke`, throws on non-2xx responses, and returns the JSON `data` field.

- [x] **Step 4: Implement browser event subscriptions**

Use `EventSource` for the three browser event endpoints. Keep the same listener signatures currently used by `useProgress`, `useBookGenerationEvents`, and `App`.

- [x] **Step 5: Update `useIpc` fallback**

Return the HTTP/SSE client when `window.storyWeaver` is absent.

- [x] **Step 6: Verify renderer tests**

Run: `pnpm exec vitest run tests/renderer/http-transport.test.tsx tests/renderer/app-shell.test.tsx --reporter=dot`

Expected: PASS.

---

### Task 7: Full Verification

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md`

- [x] **Step 1: Add scripts**

Add `dev:server`, `dev:web`, `build:server`, and include server typecheck in the verification path.

- [x] **Step 2: Document local browser mode**

Update `CLAUDE.md` with the browser mode commands and the fact that Electron and browser mode share `~/.story-weaver/data.db`.

- [x] **Step 3: Run focused suites**

Run: `pnpm exec vitest run tests/storage tests/runtime tests/server tests/renderer --reporter=dot`

Expected: PASS.

- [x] **Step 4: Run typecheck and build**

Run: `pnpm run typecheck && pnpm run build && pnpm run build:server`

Expected: PASS.
