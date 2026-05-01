# Server API Runtime Design

**Goal:** Make the local server the only business runtime and transport, while preserving the existing Story Weaver user-facing features.

**Scope:** This change removes renderer-to-Electron business IPC from the active architecture. Books, generation, scheduling, model settings, model tests, exports, execution logs, browser mode, and Electron packaging remain supported through the server API.

**Success criteria:**

- Renderer command calls always use HTTP, including inside Electron.
- Renderer event subscriptions always use SSE, including inside Electron.
- Electron no longer has a working business IPC bridge.
- Refreshing or closing a renderer page does not close the server runtime, pause the scheduler, cancel generation, or close the SQLite database.
- Browser mode and Electron mode both run against the same local server behavior.
- Packaged Electron can launch the app without a Vite dev server.

## Current Shape

The project already has most of the server path in place. `server/main.ts` creates `RuntimeServices`, exposes `/api/invoke`, streams events over `/api/events/*`, serves exports, and can serve built renderer assets. The renderer also has `renderer/lib/story-weaver-http-client.ts`, which can call `/api/invoke` and subscribe to SSE.

The remaining split is in `renderer/hooks/useIpc.ts`: Electron windows prefer `window.storyWeaver`, which is exposed by `electron/preload.cts` and backed by `electron/ipc/*` handlers registered in `electron/main.ts`. This keeps two business transports alive. It also means Electron page refreshes are tied to a renderer bridge that should no longer own application behavior.

There is also a packaging gap. `electron-builder.yml` currently packages `dist`, `dist-electron`, `drizzle`, and the icon, but not `dist-server`. That works for `file://` renderer loading plus Electron IPC, but server-only packaged Electron needs the compiled server in the app bundle.

## Design

The server becomes the single owner of business runtime state. `createRuntimeServices()` is instantiated by the server process and lives independently from browser pages or Electron renderer reloads. All commands flow through `/api/invoke`. Scheduler progress, book generation events, and execution logs flow through SSE endpoints.

The renderer keeps its existing `StoryWeaverIpc` shape as an internal compatibility type, but `useIpc()` always returns the HTTP/SSE client. It no longer checks `window.storyWeaver`. Existing UI calls can keep using `ipc.invoke(...)` during this migration, but the implementation underneath is server-only.

Electron no longer registers business IPC handlers and no longer exposes the Story Weaver business bridge from preload. The Electron main process becomes a desktop shell: set icon/window options, ensure or connect to the local server, and load a URL served by either the Vite dev server or the built Fastify static server. In packaged mode, the server serves `dist` and `/api/*`; Electron loads that server URL instead of loading `dist/index.html` directly from `file://`.

The old user-facing behavior stays intact because the channel contract and dispatcher remain available on the server. The existing `ipcChannels` naming can be made neutral with `apiChannels` while keeping compatibility aliases for low-risk migration. The key architectural rule is that no renderer code calls Electron IPC for business behavior.

## File-Level Design

### Renderer Transport

`renderer/hooks/useIpc.ts` remains the one hook used by the app, but its implementation becomes unconditional:

- It imports `createHttpStoryWeaverClient`.
- It returns that client from `useMemo`.
- It does not read `window.storyWeaver`.
- The global `Window.storyWeaver` declaration is removed or narrowed to legacy test-only cleanup if TypeScript needs a transition.

`renderer/lib/story-weaver-http-client.ts` becomes the only renderer transport implementation. It should support an explicit API origin so Electron can load a Vite page from `http://localhost:5173` while calling the server on `http://127.0.0.1:5174`:

- Default browser mode: same-origin `new URL('/api/invoke', window.location.href)`.
- Electron dev mode: API base from a global value or environment-injected value.
- Packaged Electron mode: same-origin server URL because Electron loads the renderer from the Fastify server.

The preferred minimal API is:

```ts
createHttpStoryWeaverClient({ baseUrl?: string } = {})
```

When `baseUrl` is absent, the client uses `window.location.origin`. For SSE, endpoint URLs are built from the same base. This avoids a future bug where Electron loads Vite from port `5173` but API calls accidentally go to Vite instead of the server.

### Server Runtime

`server/main.ts` remains the production server entry and should export reusable pieces:

- `buildServer(options)` for tests and embedded Electron startup.
- `startServer(options)` or equivalent helper that listens on a host/port and returns `{ app, url }`.
- The existing CLI `main()` path still starts the server from environment config.

`server/config.ts` remains the central config resolver. It should be able to resolve:

- `host`, default `127.0.0.1`.
- `port`, default `5174`.
- `rootDir`, default `~/.story-weaver`.
- `staticDir`, default built renderer directory.

The implementation plan should decide whether Electron imports `buildServer()` directly or spawns `dist-server/server/main.js`. Direct import is simpler during development and easier to shut down with Electron; spawning gives stricter process isolation. The recommended first implementation is direct import in Electron main, because it keeps the runtime inside the desktop app lifecycle and avoids process supervision complexity.

### Electron Shell

`electron/main.ts` becomes responsible for shell setup and server-backed loading:

- Keep `app`, `BrowserWindow`, `nativeImage`, icon setup, window dimensions, title bar, background color, and app lifecycle.
- Remove imports from `electron/ipc/books.ts`, `electron/ipc/scheduler.ts`, `electron/ipc/models.ts`, `electron/ipc/settings.ts`, and `electron/ipc/logs.ts`.
- Remove calls to all business handler registration functions.
- Before creating or loading the window, ensure the server is listening.
- Load a server-backed URL:
  - Dev renderer mode: load `VITE_DEV_SERVER_URL`, but provide the API base to the renderer so it calls the server port.
  - Packaged mode: load the Fastify URL, such as `http://127.0.0.1:<port>/`.

`electron/preload.cts` should not expose `window.storyWeaver`. If a preload file is still useful for non-business desktop affordances later, it can stay as a minimal no-op or metadata bridge. For this migration, the cleanest result is either an empty preload or no preload configured. If no preload is used, `electron/main.ts` removes the `preload` field from `webPreferences`.

`electron/ipc/*.ts` should be deleted in the final state of this migration. Keeping unreachable files after the renderer has moved would make the architecture look less complete and invite accidental re-use. Server dispatch is the replacement for these handlers.

### Shared Contracts

`src/shared/contracts.ts` remains the shared source for channel strings, payload validation, payload types, and response types. To reduce churn, the first implementation can keep `ipcChannels`, `IpcPayloadMap`, and `IpcResponseMap` names. A neutral naming layer can be added without breaking existing imports:

```ts
export const apiChannels = ipcChannels;
export type ApiInvokeChannel = IpcInvokeChannel;
export type ApiPayloadMap = IpcPayloadMap;
export type ApiResponseMap = IpcResponseMap;
```

New server and renderer code should prefer the neutral API names once they exist. Existing UI code can keep the `ipc` variable name until a separate cleanup pass.

### Packaging And Build

Packaged server-only Electron needs server output and server dependencies available:

- `package.json` `build` should continue to run renderer, Electron, and server builds.
- `electron-builder.yml` must package `dist-server/**`.
- If Electron directly imports server source output, `dist-electron/electron/main.js` needs a stable relative import to `dist-server/server/main.js` after build.
- Drizzle migration files remain packaged through `drizzle/**`.
- Built renderer assets remain packaged through `dist/**`.

The packaged app should not require a Vite server. It should start the local Fastify server, serve `dist/index.html`, and use the same `/api/*` endpoints as browser mode.

## Server Lifecycle

Development supports two workflows:

- Browser mode runs Vite plus `server/main.ts`.
- Electron mode starts or connects to the same kind of local server, then opens the renderer against a server-aware frontend URL.

Production Electron starts an in-process or child-process server before creating the window. The server owns the SQLite connection, scheduler, generation tasks, export registry, and event subscriptions. Closing or refreshing a renderer page only closes that page's SSE listeners. It does not call `services.close()`, pause the scheduler, or cancel active generation.

Server shutdown still closes runtime services through Fastify's `onClose` hook. That shutdown belongs to the server process lifecycle, not the renderer page lifecycle.

### Refresh And Reconnect Behavior

A page refresh does this:

1. The browser closes existing SSE connections.
2. `server/routes/events.ts` removes only the listeners associated with those HTTP requests.
3. The server runtime continues running.
4. The new page instance calls `/api/invoke` for initial state.
5. The new page instance opens fresh SSE connections.

No refresh path should call `app.close()`, `services.close()`, `scheduler.pauseAll()`, or `db.close()`.

Events are not guaranteed to replay after disconnect. Durable state is recovered through normal API reads:

- Book detail reflects persisted chapters, status, progress, outlines, and generated content.
- Scheduler status reflects current running/queued state.
- Execution log history is currently streamed live; if the UI needs historical logs after refresh, that should be a separate log-history API rather than overloading SSE replay in this migration.

### Server Startup Strategy

For Electron development, the existing `dev:electron` script currently waits only on Vite. It should also ensure the server is running. There are two acceptable script shapes:

- Run Vite, server, and Electron together with `concurrently`, and have Electron load Vite while renderer API calls point to server.
- Let Electron main start the server itself, and keep the script waiting only for Vite.

The recommended shape is: Electron main starts the server itself. This makes development and production behave similarly. Browser-only development can keep `dev:web`.

Port handling should be explicit:

- Default server port remains `5174`.
- If the default port is unavailable, Electron should either fail with a clear error or intentionally choose another port and pass that URL to the renderer.
- Silent fallback is risky because the renderer must know the exact API base.

The first implementation should fail clearly on port conflicts. Dynamic port selection can come later if needed.

## API And Events

`POST /api/invoke` remains the command endpoint for the existing operations:

- Book create, delete, list, detail, start, pause, resume, restart, export, write next chapter, and write all chapters.
- Scheduler start all, pause all, and status.
- Model list, save, and test.
- Settings get and set.

SSE endpoints remain:

- `/api/events/scheduler`
- `/api/events/book-generation`
- `/api/events/execution-logs`

After a page refresh, the renderer re-subscribes to SSE and re-queries book detail, scheduler status, and logs as needed. Events that occurred while the page was disconnected are reflected through persisted book state and scheduler status rather than replayed from the closed SSE connection.

### API Base Resolution

The renderer transport resolves URLs in this order:

1. Explicit `baseUrl` passed to `createHttpStoryWeaverClient`.
2. A global injected by Electron before page scripts run, for example `window.__STORY_WEAVER_API_BASE_URL__`.
3. Same-origin `window.location.origin`.

If the preload is removed, Electron can still inject the API base through `BrowserWindow.webContents.executeJavaScript` after navigation starts, or by appending a query parameter to the Vite URL in development. Query parameter is simpler and visible:

```text
http://localhost:5173/?storyWeaverApi=http%3A%2F%2F127.0.0.1%3A5174
```

The renderer client reads the query value once and uses it for fetch and SSE. In packaged mode, the query is unnecessary because the server serves both UI and API from the same origin.

### Error Behavior

The HTTP client should keep current behavior:

- Parse JSON responses when available.
- Throw the server-provided `error` string for non-2xx responses.
- Throw a status-based fallback error if the body is missing or malformed.
- Return the `data` field for successful invoke calls.
- Preserve export response formatting so the existing UI can display the file path and download URL.

SSE parse failures should not crash React rendering. The current implementation assumes valid JSON; this is acceptable if server tests cover well-formed frames. Defensive parse handling can be added in implementation if it is small.

## Migration Boundaries

Remove active business IPC wiring:

- `electron/main.ts` stops importing and calling `registerBookHandlers`, `registerSchedulerHandlers`, `registerModelHandlers`, `registerSettingsHandlers`, and `registerLogHandlers`.
- `electron/preload.cts` stops exposing `window.storyWeaver` business methods.
- `electron/ipc/*` handlers are deleted or left unreachable only temporarily during a staged deletion. The final state should not keep a second working business transport.

Keep compatibility where it protects existing features:

- Shared payload and response contracts remain the source of truth.
- Renderer UI code can continue to receive an object named `ipc` until a later naming cleanup.
- Existing server dispatch keeps the current channel strings, so saved behavior and tests do not need a wholesale rename.

### Functional Compatibility Matrix

The following existing capabilities must continue working through server API:

| Feature | Existing channel/event | Server-only behavior |
| --- | --- | --- |
| Create book | `book:create` | `/api/invoke` validates payload and returns book id. |
| Delete book | `book:delete` | `/api/invoke` deletes the full book graph. |
| List books | `book:list` | `/api/invoke` returns current persisted list. |
| Book detail | `book:detail` | `/api/invoke` returns detail after refresh. |
| Start/pause/resume/restart | `book:start`, `book:pause`, `book:resume`, `book:restart` | Server scheduler/runtime owns state. |
| Write next/all | `book:writeNext`, `book:writeAll` | Long-running work continues if UI refreshes. |
| Export | `book:export` | Server registers export and returns download URL. |
| Scheduler status | `scheduler:status`, scheduler SSE | API read plus live SSE updates. |
| Model configs | `model:list`, `model:save`, `model:test` | Same validation and runtime model test through server. |
| Settings | `settings:get`, `settings:set` | Same persisted settings and scheduler concurrency update. |
| Execution logs | logs SSE | Live logs stream over SSE. |

### Deletion Policy

Deletion should happen in one migration pass, not indefinitely staged:

1. Make renderer server-only.
2. Make Electron start/load server-only.
3. Remove IPC registrations and preload business bridge.
4. Delete `electron/ipc/*.ts`.
5. Update tests and docs to describe server API instead of preload IPC.

If a file cannot be deleted because another build config still includes it, the build config should change. The final architecture should not compile unused business IPC modules.

### Documentation Updates

`CLAUDE.md` should be updated because it currently describes Electron IPC as the renderer-to-main path. It should describe:

- Browser mode commands.
- Electron mode commands.
- Server API as the only business transport.
- The fact that frontend refresh does not restart runtime tasks.
- Shared SQLite root behavior.

## Testing

Use TDD for the migration:

- Renderer transport test: even if a fake `window.storyWeaver` exists, `useIpc()` calls `/api/invoke` and uses SSE.
- Electron config test: `electron/main.ts` does not import or register `electron/ipc/*` business handlers.
- Preload test: preload no longer exposes invoke or business event listeners.
- Server lifecycle test: closing an SSE request removes only that listener and does not close runtime services or pause scheduler state.
- Server static/API test: built static serving and `/api/*` can coexist behind one Fastify server.
- Existing server, renderer, runtime, storage, and smoke tests continue to pass.

Detailed expected test changes:

- `tests/renderer/http-transport.test.tsx`
  - Add a test that installs a fake `window.storyWeaver` with throwing methods, renders a probe, and verifies fetch is still called.
  - Add API base test for a non-same-origin base URL.

- `tests/core/dev-runtime-config.test.ts`
  - Replace preload whitelist assertions with server-only assertions.
  - Assert `electron/main.ts` does not contain `registerBookHandlers`, `registerSchedulerHandlers`, `registerModelHandlers`, `registerSettingsHandlers`, or `registerLogHandlers`.
  - Assert `electron/main.ts` contains server startup/loading behavior.
  - Assert `electron-builder.yml` includes `dist-server/**`.

- `tests/server/events.test.ts`
  - Add a mock runtime test where closing an SSE response calls the subscription cleanup but does not call `services.close()`.
  - Keep current scheduler SSE frame test.

- `tests/server/static.test.ts`
  - Keep existing SPA fallback and API 404 coverage.
  - Add a test that `/api/health` still works when static serving is enabled.

- `tests/server/invoke.test.ts`
  - Keep existing `/api/invoke` channel validation tests.
  - Add one compatibility test for a long-running-ish command dispatch if a cheap fake runtime can prove the call is server-owned.

- `tests/electron/runtime-mock-fallback.test.ts`
  - Keep runtime composition coverage if Electron still imports runtime wrappers.
  - Remove or relocate Electron-specific expectations if runtime ownership fully moves to server.

Verification commands after implementation:

```bash
pnpm exec vitest run tests/renderer/http-transport.test.tsx tests/server/events.test.ts tests/server/static.test.ts tests/server/invoke.test.ts tests/core/dev-runtime-config.test.ts --reporter=dot
pnpm run typecheck
pnpm run build
pnpm run smoke:browser-persistence
```

The Electron package smoke test should be restored or updated if the current worktree has a missing script expectation. Its purpose should be to prove packaged artifacts contain `dist`, `dist-electron`, `dist-server`, `drizzle`, and native SQLite bindings.

## Risks And Decisions

**Decision: keep the server dispatcher contract stable.** This avoids rewriting every feature while still removing IPC as a transport.

**Decision: no event replay in this migration.** Refresh recovery comes from persisted state plus current scheduler status. Replay can be added later as a log-history feature.

**Risk: dev Electron points fetch at Vite instead of API.** Mitigation: explicit API base resolution and tests.

**Risk: packaged Electron cannot import server output.** Mitigation: package `dist-server/**` and verify build paths in config tests and package smoke.

**Risk: port conflict prevents app startup.** Mitigation: fail with a clear error in the first implementation. Dynamic fallback can be a separate enhancement.

**Risk: deleting IPC files breaks old tests before replacement tests exist.** Mitigation: TDD order starts with tests that assert the new server-only behavior, then removes the old files.

## Non-Goals

This change does not redesign the UI, change model providers, replace SQLite, alter book generation logic, or remove the Electron desktop app. It also does not require renaming every `ipc` variable in the renderer immediately. Naming cleanup can follow once the transport migration is complete and verified.
