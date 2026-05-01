# Server API Runtime Design

**Goal:** Make the local server the only business runtime and transport, while preserving the existing Story Weaver user-facing features.

**Scope:** This change removes renderer-to-Electron business IPC from the active architecture. Books, generation, scheduling, model settings, model tests, exports, execution logs, browser mode, and Electron packaging remain supported through the server API.

## Current Shape

The project already has most of the server path in place. `server/main.ts` creates `RuntimeServices`, exposes `/api/invoke`, streams events over `/api/events/*`, serves exports, and can serve built renderer assets. The renderer also has `renderer/lib/story-weaver-http-client.ts`, which can call `/api/invoke` and subscribe to SSE.

The remaining split is in `renderer/hooks/useIpc.ts`: Electron windows prefer `window.storyWeaver`, which is exposed by `electron/preload.cts` and backed by `electron/ipc/*` handlers registered in `electron/main.ts`. This keeps two business transports alive. It also means Electron page refreshes are tied to a renderer bridge that should no longer own application behavior.

## Design

The server becomes the single owner of business runtime state. `createRuntimeServices()` is instantiated by the server process and lives independently from browser pages or Electron renderer reloads. All commands flow through `/api/invoke`. Scheduler progress, book generation events, and execution logs flow through SSE endpoints.

The renderer keeps its existing `StoryWeaverIpc` shape as an internal compatibility type, but `useIpc()` always returns the HTTP/SSE client. It no longer checks `window.storyWeaver`. Existing UI calls can keep using `ipc.invoke(...)` during this migration, but the implementation underneath is server-only.

Electron no longer registers business IPC handlers and no longer exposes the Story Weaver business bridge from preload. The Electron main process becomes a desktop shell: set icon/window options, ensure or connect to the local server, and load a URL served by either the Vite dev server or the built Fastify static server. In packaged mode, the server serves `dist` and `/api/*`; Electron loads that server URL instead of loading `dist/index.html` directly from `file://`.

The old user-facing behavior stays intact because the channel contract and dispatcher remain available on the server. The existing `ipcChannels` naming can be made neutral with `apiChannels` while keeping compatibility aliases for low-risk migration. The key architectural rule is that no renderer code calls Electron IPC for business behavior.

## Server Lifecycle

Development supports two workflows:

- Browser mode runs Vite plus `server/main.ts`.
- Electron mode starts or connects to the same kind of local server, then opens the renderer against that server-backed URL.

Production Electron starts an in-process or child-process server before creating the window. The server owns the SQLite connection, scheduler, generation tasks, export registry, and event subscriptions. Closing or refreshing a renderer page only closes that page's SSE listeners. It does not call `services.close()`, pause the scheduler, or cancel active generation.

Server shutdown still closes runtime services through Fastify's `onClose` hook. That shutdown belongs to the server process lifecycle, not the renderer page lifecycle.

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

## Migration Boundaries

Remove active business IPC wiring:

- `electron/main.ts` stops importing and calling `registerBookHandlers`, `registerSchedulerHandlers`, `registerModelHandlers`, `registerSettingsHandlers`, and `registerLogHandlers`.
- `electron/preload.cts` stops exposing `window.storyWeaver` business methods.
- `electron/ipc/*` handlers are deleted or left unreachable only temporarily during a staged deletion. The final state should not keep a second working business transport.

Keep compatibility where it protects existing features:

- Shared payload and response contracts remain the source of truth.
- Renderer UI code can continue to receive an object named `ipc` until a later naming cleanup.
- Existing server dispatch keeps the current channel strings, so saved behavior and tests do not need a wholesale rename.

## Testing

Use TDD for the migration:

- Renderer transport test: even if a fake `window.storyWeaver` exists, `useIpc()` calls `/api/invoke` and uses SSE.
- Electron config test: `electron/main.ts` does not import or register `electron/ipc/*` business handlers.
- Preload test: preload no longer exposes invoke or business event listeners.
- Server lifecycle test: closing an SSE request removes only that listener and does not close runtime services or pause scheduler state.
- Server static/API test: built static serving and `/api/*` can coexist behind one Fastify server.
- Existing server, renderer, runtime, storage, and smoke tests continue to pass.

## Non-Goals

This change does not redesign the UI, change model providers, replace SQLite, alter book generation logic, or remove the Electron desktop app. It also does not require renaming every `ipc` variable in the renderer immediately. Naming cleanup can follow once the transport migration is complete and verified.
