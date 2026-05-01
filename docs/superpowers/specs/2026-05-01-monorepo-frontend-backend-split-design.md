# Monorepo Frontend/Backend Split Design

## Goal

Split Story Weaver into explicit monorepo packages for frontend, backend, and shared contracts while preserving both browser mode and the Electron desktop app.

The target architecture is:

- `packages/frontend`: React/Vite UI and browser transport.
- `packages/backend`: Fastify API, runtime services, AI orchestration, model providers, SQLite repositories, story core, and mock services.
- `packages/shared`: API contracts, shared types, and pure cross-runtime constants/helpers.
- `electron`: desktop shell that starts the backend server and loads the frontend. It must not contain business logic.

## Current Context

The app already runs through a local Fastify server in both browser and Electron modes. The renderer uses concrete HTTP/SSE APIs, and Electron starts the same local server rather than owning business IPC handlers.

The remaining architectural issue is source ownership. Core logic still lives under root `src`, while `server` imports it directly. The renderer also imports shared contracts from `src/shared`, and currently imports `src/core/chapter-review` for short chapter review setting parsing and serialization. This makes `src` act as an ambiguous shared space instead of a clear backend boundary.

## Architecture

Create a `pnpm` workspace with three first-class packages:

- `@story-weaver/shared`
- `@story-weaver/backend`
- `@story-weaver/frontend`

The root package remains the orchestration layer for scripts, Electron packaging, repository-wide tests, and developer commands.

### Package Boundaries

`packages/shared` owns code that is safe in both browser and Node runtimes:

- API request/response contracts.
- Entity view types such as `BookRecord`, `BookDetail`, `SchedulerStatus`, and `ExecutionLogRecord`.
- Shared enum-like unions and literal constants used by both frontend and backend.
- Small pure helpers only when they have no storage, AI, Node, DOM, or process dependency.

`packages/backend` owns all application behavior:

- Fastify server startup and route modules.
- Runtime service composition.
- Story core orchestration and chapter generation.
- AI model registry and providers.
- SQLite schema, migrations, and repositories.
- Export generation and local file serving registry.
- Deterministic mock services used by tests and development fallback.

`packages/frontend` owns browser/UI behavior:

- React app, pages, components, hooks, styles, and assets.
- HTTP/SSE client for the concrete backend API.
- UI-only formatting helpers and presentation state.
- Frontend tests that mock API methods rather than backend internals.

`electron` owns only desktop integration:

- Start the backend server from `@story-weaver/backend`.
- Load Vite during development or the packaged frontend static URL in production.
- Manage BrowserWindow lifecycle.
- Avoid importing frontend source files or backend business internals beyond the backend server entry point.

### Dependency Rules

Allowed:

- `frontend -> shared`
- `backend -> shared`
- `electron -> backend`
- root test/config scripts -> any package as needed

Forbidden:

- `frontend -> backend`
- `shared -> frontend`
- `shared -> backend`
- `backend -> frontend`
- `electron -> frontend source`

These rules should be enforced with TypeScript path aliases and repository tests that scan imports for forbidden package edges.

## Target File Layout

```text
packages/
  shared/
    package.json
    tsconfig.json
    src/
      contracts.ts
      paths.ts
      settings.ts
  backend/
    package.json
    tsconfig.json
    src/
      main.ts
      config.ts
      export-registry.ts
      routes/
      core/
      models/
      mock/
      runtime/
      storage/
      utils/
  frontend/
    package.json
    tsconfig.json
    vite.config.ts
    src/
      App.tsx
      main.tsx
      components/
      hooks/
      lib/
      pages/
      types/
      assets/
electron/
  main.ts
tests/
  core/
  storage/
  server/
  renderer/
  ...
```

The exact internal frontend path can keep the current `renderer` file names during migration if that reduces churn, but the package root should become `packages/frontend`.

## Data Flow

Browser mode:

1. `packages/backend` starts Fastify.
2. `packages/frontend` runs through Vite in development or is served from the backend in production.
3. Frontend calls concrete REST endpoints such as `GET /api/books`, `POST /api/books/:bookId/start`, and `PUT /api/settings/:key`.
4. Frontend subscribes to backend SSE endpoints for scheduler, book-generation, and execution-log events.

Desktop mode:

1. Electron starts a local backend server through `@story-weaver/backend`.
2. Electron opens a BrowserWindow pointed at Vite in development or the backend-served frontend in production.
3. The frontend uses the same HTTP/SSE API as browser mode.
4. Refreshing the frontend reconnects clients but does not restart runtime services, pause scheduling, or lose the SQLite connection.

Shared types:

1. Backend route implementations import contracts from `@story-weaver/shared`.
2. Frontend API client and UI props import contracts from `@story-weaver/shared`.
3. Runtime-only types stay in backend unless they are part of the public API contract.

## Build And Run

Add `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

Root scripts should remain the main developer interface:

- `pnpm run dev`: start frontend Vite and Electron desktop app. Electron starts or connects to the local backend server.
- `pnpm run dev:web`: start frontend Vite and backend Fastify for browser development.
- `pnpm run start:web`: start the built backend and serve the built frontend.
- `pnpm run build`: build shared, backend, frontend, and Electron outputs.
- `pnpm run typecheck`: typecheck all packages and Electron.
- `pnpm test`: run repository-wide Vitest suites.

Build order:

1. `@story-weaver/shared`
2. `@story-weaver/backend`
3. `@story-weaver/frontend`
4. Electron TypeScript and packaging assets

The Electron package should include:

- frontend build output from `packages/frontend/dist`
- backend build output from `packages/backend/dist`
- SQLite migration files under the backend package
- native dependencies such as `better-sqlite3`

## Migration Strategy

Use staged moves to keep the app working between steps:

1. Introduce workspace metadata and package-level TypeScript configs.
2. Move shared contracts and pure shared helpers from `src/shared` into `packages/shared/src`.
3. Move backend-owned modules from `server` and `src/core|storage|models|runtime|mock|utils` into `packages/backend/src`.
4. Move renderer files into `packages/frontend/src` and update Vite aliases.
5. Update import paths to use `@story-weaver/shared`, `@story-weaver/backend`, and frontend-local aliases.
6. Update root scripts, package build outputs, Electron startup imports, and Electron packaging config.
7. Add import-boundary tests to prevent frontend/backend coupling from returning.

During migration, do not change business behavior unless required by the package split. Existing API route behavior, database paths, model fallback behavior, scheduler semantics, and export behavior should remain unchanged.

## Handling Current Shared Logic

Move `src/shared/contracts.ts` to `packages/shared/src/contracts.ts`.

Move `src/shared/paths.ts` only if it is truly runtime-neutral. If it remains tied to backend data directories, move it to backend instead.

Move the short chapter review setting key and parse/serialize helpers out of `src/core/chapter-review.ts` into shared only if they remain pure setting helpers. Backend keeps `shouldRewriteShortChapter` because it is generation behavior. The frontend should import only the setting key and parse/serialize helpers from shared.

## Error Handling

Backend route validation stays in backend route modules. Invalid payloads should continue returning structured `{ error: string }` responses with appropriate status codes.

Frontend HTTP client should continue converting non-2xx backend responses into thrown `Error` objects with backend-provided messages when available.

Electron startup should surface backend startup failures as application startup failures instead of silently loading a broken frontend.

Import-boundary violations should fail tests or typecheck, not rely on review comments.

## Testing

Use existing tests as regression coverage while updating import paths:

- `tests/server/*`: import backend server utilities from `@story-weaver/backend`.
- `tests/core/*`, `tests/storage/*`, `tests/models/*`, `tests/runtime/*`, `tests/mock/*`: import backend internals from `@story-weaver/backend` package subpaths.
- `tests/renderer/*`: import frontend modules from `@story-weaver/frontend` or package-local aliases where appropriate.
- Contract tests: import shared types from `@story-weaver/shared`.

Add boundary tests:

- Frontend files must not import `@story-weaver/backend`.
- Shared files must not import `@story-weaver/frontend` or `@story-weaver/backend`.
- Backend files must not import `@story-weaver/frontend`.
- Electron must not import frontend source files.

Verification commands for the full migration:

```bash
pnpm run typecheck
pnpm test
pnpm run build
pnpm run smoke:browser-persistence
pnpm run smoke:electron-package
```

## Acceptance Criteria

- The repository has `packages/frontend`, `packages/backend`, and `packages/shared`.
- The frontend package has no direct backend imports.
- The shared package has no runtime-specific dependencies.
- Browser mode can create, list, read, start, pause, resume, restart, write, and export books through the backend API.
- Electron desktop mode still starts the local backend and loads the frontend successfully.
- Existing SQLite data location and migration behavior remain compatible.
- Existing model mock fallback behavior remains compatible.
- Import-boundary tests prevent reintroducing ambiguous `src` ownership.
- Full typecheck, test, build, browser persistence smoke, and Electron package smoke pass.
