# Server API Runtime Design

**Goal:** Make the local server the only business runtime and expose concrete HTTP interfaces for every Story Weaver capability, while preserving existing user-facing behavior.

**Scope:** This change removes renderer-to-Electron business IPC and also removes the generic `/api/invoke` command bus from the target architecture. Books, generation, scheduling, model settings, model tests, exports, execution logs, browser mode, and Electron packaging remain supported through named server API routes.

**Success criteria:**

- Renderer command calls always use concrete HTTP endpoints, including inside Electron.
- Renderer event subscriptions always use SSE, including inside Electron.
- No renderer business code calls `ipc.invoke`, `window.storyWeaver.invoke`, or a generic `{ channel, payload }` API.
- Electron no longer has a working business IPC bridge.
- Refreshing or closing a renderer page does not close the server runtime, pause the scheduler, cancel generation, or close the SQLite database.
- Browser mode and Electron mode both run against the same local server behavior.
- Packaged Electron can launch the app without a Vite dev server.

## Current Shape

The project already has most of the server runtime path in place. `server/main.ts` creates `RuntimeServices`, streams events over `/api/events/*`, serves exports, and can serve built renderer assets. The renderer has `renderer/lib/story-weaver-http-client.ts`, but today it posts channel names to `/api/invoke`.

The remaining architecture still has two command buses:

- Electron command bus: `renderer/hooks/useIpc.ts` can prefer `window.storyWeaver`, which is exposed by `electron/preload.cts` and backed by `electron/ipc/*` handlers registered in `electron/main.ts`.
- HTTP command bus: `/api/invoke` accepts `{ channel, payload }` and forwards through `server/channel-dispatch.ts`.

Both buses hide concrete operations behind string command names. The new design removes both active buses and replaces them with explicit resource/action endpoints.

There is also a packaging gap. `electron-builder.yml` currently packages `dist`, `dist-electron`, `drizzle`, and the icon, but not `dist-server`. That works for `file://` renderer loading plus Electron IPC, but server-only packaged Electron needs the compiled server in the app bundle.

## Design

The server becomes the single owner of business runtime state. `createRuntimeServices()` is instantiated by the server process and lives independently from browser pages or Electron renderer reloads.

Commands flow through concrete HTTP interfaces such as `GET /api/books`, `POST /api/books/:bookId/start`, and `PUT /api/settings/:key`. Scheduler progress, book generation events, and execution logs continue to flow through SSE endpoints.

The renderer gets a concrete API client instead of a generic invoke function. UI code should call methods like `api.listBooks()`, `api.startBook(bookId)`, `api.saveModel(input)`, and `api.setSetting(key, value)`. The `useIpc()` hook should be replaced by `useStoryWeaverApi()` or reduced to a temporary wrapper around the concrete API object during migration. The final state should not expose a generic `invoke(channel, payload)` method to application components.

Electron no longer registers business IPC handlers and no longer exposes the Story Weaver business bridge from preload. The Electron main process becomes a desktop shell: set icon/window options, ensure or connect to the local server, and load a URL served by either the Vite dev server or the built Fastify static server. In packaged mode, the server serves `dist` and `/api/*`; Electron loads that server URL instead of loading `dist/index.html` directly from `file://`.

The old user-facing behavior stays intact because each old operation receives a concrete route and client method. The route names become the public local API contract.

## Concrete API Contract

All JSON endpoints return typed JSON directly. Successful mutation endpoints that have no useful domain value return `{ "ok": true }`. Error responses use `{ "error": string }` and an appropriate non-2xx status.

### Books

| Method | Path | Request | Response | Runtime call |
| --- | --- | --- | --- | --- |
| `GET` | `/api/books` | none | `BookListItem[]` | `bookService.listBooks()` |
| `POST` | `/api/books` | `BookCreatePayload` | `{ bookId: string }` | `bookService.createBook(payload)` |
| `GET` | `/api/books/:bookId` | none | `BookDetail \| null` | `bookService.getBookDetail(bookId)` |
| `DELETE` | `/api/books/:bookId` | none | `{ ok: true }` | `deleteBook(bookId)` |
| `POST` | `/api/books/:bookId/start` | none | `{ ok: true }` | `startBook(bookId)` |
| `POST` | `/api/books/:bookId/pause` | none | `{ ok: true }` | `pauseBook(bookId)` |
| `POST` | `/api/books/:bookId/resume` | none | `{ ok: true }` | `resumeBook(bookId)` |
| `POST` | `/api/books/:bookId/restart` | none | `{ ok: true }` | `restartBook(bookId)` |
| `POST` | `/api/books/:bookId/chapters/write-next` | none | current write result | `writeNextChapter(bookId)` |
| `POST` | `/api/books/:bookId/chapters/write-all` | none | `{ completedChapters: number; status: "completed" \| "paused" \| "deleted" }` | `writeRemainingChapters(bookId)` |
| `POST` | `/api/books/:bookId/exports` | `{ format: "txt" \| "markdown" \| "epub" }` | `{ filePath: string; downloadUrl: string }` | `exportBook(bookId, format)` plus export registry |

### Scheduler

| Method | Path | Request | Response | Runtime call |
| --- | --- | --- | --- | --- |
| `GET` | `/api/scheduler/status` | none | `SchedulerStatus` | `getSchedulerStatus()` |
| `POST` | `/api/scheduler/start` | none | `{ ok: true }` | `startAllBooks()` |
| `POST` | `/api/scheduler/pause` | none | `{ ok: true }` | `pauseAllBooks()` |

### Models

| Method | Path | Request | Response | Runtime call |
| --- | --- | --- | --- | --- |
| `GET` | `/api/models` | none | `ModelSavePayload[]` | `modelConfigs.list()` |
| `PUT` | `/api/models/:modelId` | `ModelSavePayload` | `{ ok: true }` | validates matching id, then `modelConfigs.save(input)` |
| `POST` | `/api/models/:modelId/test` | none | `{ ok: boolean; message: string }` | `testModel(modelId)` |

`ModelSavePayload` already contains `id`, so `PUT /api/models/:modelId` must reject requests where `payload.id !== modelId`.

### Settings

| Method | Path | Request | Response | Runtime call |
| --- | --- | --- | --- | --- |
| `GET` | `/api/settings` | none | `Array<{ key: string; value: string }>` | `settings.list()` |
| `GET` | `/api/settings/:key` | none | `{ key: string; value: string \| null }` | `settings.get(key)` |
| `PUT` | `/api/settings/:key` | `{ value: string }` | `{ ok: true }` | validates setting, then `settings.set(key, value)` |

`scheduler.concurrencyLimit` and the short chapter review setting keep their existing validation behavior. Setting `scheduler.concurrencyLimit` also updates the live scheduler concurrency limit.

### Events And Exports

SSE endpoints remain:

- `GET /api/events/scheduler`
- `GET /api/events/book-generation`
- `GET /api/events/execution-logs`

Export download remains:

- `GET /api/exports/:exportId`

### Health

- `GET /api/health` returns `{ ok: true }`.

## File-Level Design

### Server Routes

Replace the generic invoke route and dispatcher with domain route modules:

- Create `server/routes/books.ts`.
- Create `server/routes/scheduler.ts`.
- Create `server/routes/models.ts`.
- Create `server/routes/settings.ts`.
- Keep `server/routes/events.ts`.
- Keep `server/routes/exports.ts`.
- Keep `server/routes/health.ts`.
- Keep `server/routes/static.ts`.
- Delete `server/routes/invoke.ts`.
- Delete `server/channel-dispatch.ts`.

`server/main.ts` registers the domain routes with the same `RuntimeServices` instance. Each route validates path parameters and request bodies before calling runtime services. Shared validation helpers can live in `server/routes/validation.ts` if repeated code becomes noisy.

### Renderer API Client

Create or reshape the renderer client around concrete methods:

```ts
export type StoryWeaverApi = {
  listBooks: () => Promise<BookListItem[]>;
  createBook: (payload: BookCreatePayload) => Promise<string>;
  getBookDetail: (bookId: string) => Promise<BookDetail | null>;
  deleteBook: (bookId: string) => Promise<void>;
  startBook: (bookId: string) => Promise<void>;
  pauseBook: (bookId: string) => Promise<void>;
  resumeBook: (bookId: string) => Promise<void>;
  restartBook: (bookId: string) => Promise<void>;
  writeNextChapter: (bookId: string) => Promise<unknown>;
  writeAllChapters: (bookId: string) => Promise<{
    completedChapters: number;
    status: 'completed' | 'paused' | 'deleted';
  }>;
  exportBook: (bookId: string, format: BookExportPayload['format']) => Promise<string>;
  getSchedulerStatus: () => Promise<SchedulerStatus>;
  startScheduler: () => Promise<void>;
  pauseScheduler: () => Promise<void>;
  listModels: () => Promise<ModelSavePayload[]>;
  saveModel: (input: ModelSavePayload) => Promise<void>;
  testModel: (modelId: string) => Promise<{ ok: boolean; message: string }>;
  listSettings: () => Promise<Array<{ key: string; value: string }>>;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  onProgress: (listener: (payload: unknown) => void) => () => void;
  onBookGeneration: (listener: (payload: unknown) => void) => () => void;
  onExecutionLog: (listener: (payload: unknown) => void) => () => void;
};
```

`renderer/lib/story-weaver-http-client.ts` should implement that object using `fetchJson()` helpers for `GET`, `POST`, `PUT`, and `DELETE`. It should not export a generic `invoke()` method.

`renderer/hooks/useIpc.ts` should be replaced with `renderer/hooks/useStoryWeaverApi.ts`. During implementation, a temporary `useIpc()` wrapper may return the concrete API object only if it helps keep the UI migration small, but application code should be updated to use method calls rather than `invoke(channel, payload)`.

### API Base Resolution

The renderer transport supports an explicit API origin so Electron can load a Vite page from `http://localhost:5173` while calling the server on `http://127.0.0.1:5174`.

The client resolves URLs in this order:

1. Explicit `baseUrl` passed to `createHttpStoryWeaverClient`.
2. A query parameter such as `storyWeaverApi=http%3A%2F%2F127.0.0.1%3A5174`.
3. Same-origin `window.location.origin`.

Packaged Electron does not need the query parameter because the server serves both UI and API from the same origin. Electron development uses the query parameter when loading Vite.

### Electron Shell

`electron/main.ts` becomes responsible for shell setup and server-backed loading:

- Keep `app`, `BrowserWindow`, `nativeImage`, icon setup, window dimensions, title bar, background color, and app lifecycle.
- Remove imports from `electron/ipc/books.ts`, `electron/ipc/scheduler.ts`, `electron/ipc/models.ts`, `electron/ipc/settings.ts`, and `electron/ipc/logs.ts`.
- Remove calls to all business handler registration functions.
- Before creating or loading the window, ensure the server is listening.
- Development renderer mode loads `VITE_DEV_SERVER_URL` with a `storyWeaverApi` query parameter.
- Packaged mode loads the Fastify URL, such as `http://127.0.0.1:<port>/`.

`electron/preload.cts` should be deleted for this migration. `electron/main.ts` removes the `preload` field from `webPreferences`. If a future desktop-only affordance needs preload again, it should be introduced as a separate non-business bridge.

`electron/ipc/*.ts` should be deleted in the final state of this migration. Keeping unreachable files after the renderer has moved would make the architecture look less complete and invite accidental re-use.

### Shared Contracts

`src/shared/contracts.ts` should stop being organized around channels for new work. The concrete API should have named request and response types instead:

- `BookCreateRequest`
- `BookCreateResponse`
- `BookExportRequest`
- `BookExportResponse`
- `ModelSaveRequest`
- `ModelTestResponse`
- `SettingValueResponse`
- `OkResponse`

Existing domain DTOs such as `BookDetail`, `BookListItem`, `SchedulerStatus`, `BookGenerationEvent`, and `ExecutionLogRecord` remain shared. During migration, existing `ipcChannels` exports can remain only until all imports are removed. The final state should delete the channel constants and channel maps if no tests or implementation code use them.

### Packaging And Build

Packaged server-only Electron needs server output and server dependencies available:

- `package.json` `build` should continue to run renderer, Electron, and server builds.
- `electron-builder.yml` must package `dist-server/**`.
- If Electron directly imports server output, `dist-electron/electron/main.js` needs a stable relative import to `dist-server/server/main.js` after build.
- Drizzle migration files remain packaged through `drizzle/**`.
- Built renderer assets remain packaged through `dist/**`.

The packaged app should not require a Vite server. It should start the local Fastify server, serve `dist/index.html`, and use the same concrete `/api/*` endpoints as browser mode.

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
4. The new page instance calls concrete read endpoints such as `GET /api/books/:bookId` and `GET /api/scheduler/status`.
5. The new page instance opens fresh SSE connections.

No refresh path should call `app.close()`, `services.close()`, `scheduler.pauseAll()`, or `db.close()`.

Events are not guaranteed to replay after disconnect. Durable state is recovered through normal API reads:

- Book detail reflects persisted chapters, status, progress, outlines, and generated content.
- Scheduler status reflects current running/queued state.
- Execution log history is currently streamed live; if the UI needs historical logs after refresh, that should be a separate log-history API rather than overloading SSE replay in this migration.

### Server Startup Strategy

For Electron development, the existing `dev:electron` script currently waits only on Vite. Electron main should start the server itself so development and production behave similarly. Browser-only development can keep `dev:web`.

Port handling should be explicit:

- Default server port remains `5174`.
- If the default port is unavailable, Electron should fail with a clear error in the first implementation.
- Silent fallback is risky because the renderer must know the exact API base.

Dynamic port selection can come later if needed.

## Error Behavior

The HTTP client should provide shared error handling:

- Parse JSON responses when available.
- Throw the server-provided `error` string for non-2xx responses.
- Throw a status-based fallback error if the body is missing or malformed.
- Return typed response values for successful calls.
- Preserve export response formatting so the existing UI can display the file path and download URL.

SSE parse failures should not crash React rendering. The current implementation assumes valid JSON; this is acceptable if server tests cover well-formed frames. Defensive parse handling can be added in implementation if it is small.

## Migration Boundaries

Remove active business command buses:

- `electron/main.ts` stops importing and calling `registerBookHandlers`, `registerSchedulerHandlers`, `registerModelHandlers`, `registerSettingsHandlers`, and `registerLogHandlers`.
- `electron/preload.cts` stops exposing `window.storyWeaver` business methods.
- `electron/ipc/*` handlers are deleted.
- `server/routes/invoke.ts` is deleted.
- `server/channel-dispatch.ts` is deleted.
- Renderer components stop calling `invoke(channel, payload)`.
- Shared channel constants and maps are deleted once no imports remain.

Keep compatibility where it protects existing features:

- Domain DTOs remain the source of truth for payloads and responses.
- Existing UI flows keep the same visible behavior and labels.
- Export downloads continue to use `/api/exports/:exportId`.
- SSE endpoints keep their current URLs.

### Functional Compatibility Matrix

The following existing capabilities must continue working through concrete server API:

| Feature | Concrete API |
| --- | --- |
| Create book | `POST /api/books` |
| Delete book | `DELETE /api/books/:bookId` |
| List books | `GET /api/books` |
| Book detail | `GET /api/books/:bookId` |
| Start book | `POST /api/books/:bookId/start` |
| Pause book | `POST /api/books/:bookId/pause` |
| Resume book | `POST /api/books/:bookId/resume` |
| Restart book | `POST /api/books/:bookId/restart` |
| Write next chapter | `POST /api/books/:bookId/chapters/write-next` |
| Write all chapters | `POST /api/books/:bookId/chapters/write-all` |
| Export book | `POST /api/books/:bookId/exports`, then `GET /api/exports/:exportId` |
| Scheduler status | `GET /api/scheduler/status` and scheduler SSE |
| Start all scheduled books | `POST /api/scheduler/start` |
| Pause all scheduled books | `POST /api/scheduler/pause` |
| Model list | `GET /api/models` |
| Model save | `PUT /api/models/:modelId` |
| Model test | `POST /api/models/:modelId/test` |
| Settings list | `GET /api/settings` |
| Setting read | `GET /api/settings/:key` |
| Setting write | `PUT /api/settings/:key` |
| Execution logs | `GET /api/events/execution-logs` |

### Deletion Policy

Deletion should happen in one migration pass, not indefinitely staged:

1. Add concrete server route tests.
2. Implement concrete server routes.
3. Add concrete renderer client tests.
4. Migrate renderer UI from `invoke(channel, payload)` to named client methods.
5. Make Electron start/load server-only.
6. Remove IPC registrations and preload business bridge.
7. Delete `electron/ipc/*.ts`, `server/routes/invoke.ts`, and `server/channel-dispatch.ts`.
8. Remove unused channel contracts.
9. Update tests and docs to describe concrete server API.

If a file cannot be deleted because another build config still includes it, the build config should change. The final architecture should not compile unused command bus modules.

### Documentation Updates

`CLAUDE.md` should be updated because it currently describes Electron IPC as the renderer-to-main path. It should describe:

- Browser mode commands.
- Electron mode commands.
- Concrete server API as the only business transport.
- The fact that frontend refresh does not restart runtime tasks.
- Shared SQLite root behavior.

## Testing

Use TDD for the migration:

- Server route tests for every concrete endpoint group.
- Renderer client tests proving method calls hit concrete endpoints and never call a generic invoke function.
- Electron config test proving `electron/main.ts` does not import or register `electron/ipc/*` business handlers.
- Preload test proving preload no longer exposes invoke or business event listeners.
- Server lifecycle test proving closing an SSE request removes only that listener and does not close runtime services or pause scheduler state.
- Server static/API test proving built static serving and `/api/*` can coexist behind one Fastify server.
- Existing renderer, runtime, storage, and smoke tests continue to pass after being updated away from channel calls.

Detailed expected test changes:

- `tests/server/books-routes.test.ts`
  - Covers list, create, detail, delete, lifecycle actions, chapter write actions, and export registration.

- `tests/server/scheduler-routes.test.ts`
  - Covers status, start all, and pause all.

- `tests/server/models-routes.test.ts`
  - Covers list, save, and test model.

- `tests/server/settings-routes.test.ts`
  - Covers list, get, set, concurrency validation, and short chapter review validation.

- `tests/renderer/http-transport.test.tsx`
  - Rework around `createHttpStoryWeaverClient()` concrete methods.
  - Add a test that installs a fake `window.storyWeaver` with throwing methods and verifies concrete HTTP methods still use fetch.
  - Add API base test for a non-same-origin base URL.

- `tests/renderer/app-shell.test.tsx`
  - Replace `ipc.invoke` mock expectations with concrete API method expectations.

- `tests/core/dev-runtime-config.test.ts`
  - Replace preload whitelist assertions with server-only assertions.
  - Assert `electron/main.ts` does not contain `registerBookHandlers`, `registerSchedulerHandlers`, `registerModelHandlers`, `registerSettingsHandlers`, or `registerLogHandlers`.
  - Assert `electron/main.ts` contains server startup/loading behavior.
  - Assert `electron-builder.yml` includes `dist-server/**`.
  - Assert `server/routes/invoke.ts` and `server/channel-dispatch.ts` are absent in the final state.

- `tests/server/events.test.ts`
  - Add a mock runtime test where closing an SSE response calls the subscription cleanup but does not call `services.close()`.
  - Keep current scheduler SSE frame test.

- `tests/server/static.test.ts`
  - Keep existing SPA fallback and API 404 coverage.
  - Add a test that `/api/health` still works when static serving is enabled.

Verification commands after implementation:

```bash
pnpm exec vitest run tests/server tests/renderer/http-transport.test.tsx tests/renderer/app-shell.test.tsx tests/core/dev-runtime-config.test.ts --reporter=dot
pnpm run typecheck
pnpm run build
pnpm run smoke:browser-persistence
```

The Electron package smoke test should be restored or updated if the current worktree has a missing script expectation. Its purpose should be to prove packaged artifacts contain `dist`, `dist-electron`, `dist-server`, `drizzle`, and native SQLite bindings.

## Risks And Decisions

**Decision: replace command buses with concrete endpoints.** `/api/invoke` and Electron IPC handlers are removed from the target architecture, not retained as compatibility transports.

**Decision: keep domain DTOs stable where possible.** This preserves behavior while changing transport shape.

**Decision: no event replay in this migration.** Refresh recovery comes from persisted state plus current scheduler status. Replay can be added later as a log-history feature.

**Risk: dev Electron points fetch at Vite instead of API.** Mitigation: explicit API base resolution and tests.

**Risk: packaged Electron cannot import server output.** Mitigation: package `dist-server/**` and verify build paths in config tests and package smoke.

**Risk: port conflict prevents app startup.** Mitigation: fail with a clear error in the first implementation. Dynamic fallback can be a separate enhancement.

**Risk: route proliferation adds boilerplate.** Mitigation: use small route modules and shared request/response helpers, but keep endpoints explicit.

## Non-Goals

This change does not redesign the UI, change model providers, replace SQLite, alter book generation logic, or remove the Electron desktop app. It also does not add event replay or historical log APIs. Naming cleanup beyond removing command bus concepts can follow once the concrete API migration is complete and verified.
