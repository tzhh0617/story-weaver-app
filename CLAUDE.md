# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts frontend + Electron concurrently)
pnpm run dev

# Browser mode (starts frontend Vite + local backend server)
pnpm run dev:web

# Production browser mode (builds packages, then serves frontend via backend)
pnpm run start:web

# Start an already-built backend server
pnpm run start:server

# Smoke test browser server persistence with a temp SQLite DB
pnpm run smoke:browser-persistence

# Smoke test Electron package contents without writing release/
pnpm run smoke:electron-package

# Type checking across workspace packages, tests, and Electron
pnpm run typecheck

# Tests
pnpm test
pnpm run test:watch

# Run a single test file
pnpm exec vitest run tests/core/scheduler.test.ts

# Build
pnpm run build
pnpm run package
```

Data is stored in `~/.story-weaver/` (SQLite DB, exports, logs). Electron mode
and browser mode share the same backend runtime services and SQLite database.

Browser server environment variables:
- `STORY_WEAVER_SERVER_HOST` — listen host, defaults to `127.0.0.1`
- `STORY_WEAVER_SERVER_PORT` — listen port, defaults to `5174`
- `STORY_WEAVER_ROOT_DIR` — runtime data directory, defaults to `~/.story-weaver`
- `STORY_WEAVER_STATIC_DIR` — built frontend directory, defaults to `packages/frontend/dist`

Browser persistence smoke test:
1. Prefer the automated smoke script: `pnpm run smoke:browser-persistence`.
2. For manual checks, use a temp data directory so local user data is untouched:
   `STORY_WEAVER_ROOT_DIR=$(mktemp -d /tmp/story-weaver-browser-smoke-XXXXXX)`
3. If Vite port `5173` is free, run `pnpm run dev:web`.
4. If `5173` is occupied, run production-style browser mode on another port:
   `pnpm run build && STORY_WEAVER_ROOT_DIR=$STORY_WEAVER_ROOT_DIR STORY_WEAVER_SERVER_PORT=5184 pnpm run start:server`
5. Open `http://127.0.0.1:5173/` for dev mode or `http://127.0.0.1:5184/` for production-style mode.
6. Verify `/api/health`, create/list a book through `/api/books`, and inspect the temp `data.db` with `better-sqlite3`.
7. Stop the server and remove the temp directory.

Electron packaging smoke test without overwriting `release/`:
```bash
rm -rf /tmp/story-weaver-package-smoke
pnpm run smoke:electron-package
rm -rf /tmp/story-weaver-package-smoke
```

Equivalent manual check:
```bash
rm -rf /tmp/story-weaver-package-smoke
pnpm run build
pnpm exec electron-builder --dir --config.directories.output=/tmp/story-weaver-package-smoke
pnpm exec asar list '/tmp/story-weaver-package-smoke/mac-arm64/Story Weaver.app/Contents/Resources/app.asar' | rg '^/(packages/frontend/dist|packages/backend/dist|packages/shared/dist|dist-electron|drizzle)(/|$)'
test -f '/tmp/story-weaver-package-smoke/mac-arm64/Story Weaver.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
rm -rf /tmp/story-weaver-package-smoke
```

## Architecture

This is a pnpm workspace with explicit frontend, backend, and shared packages.

### Frontend (`packages/frontend`)
- React 19 + Vite + Tailwind + shadcn/ui.
- Owns UI, pages, hooks, assets, and HTTP/SSE client code.
- May import `@story-weaver/shared`.
- Must not import `@story-weaver/backend`.
- `@/` resolves to `packages/frontend/src`.

### Backend (`packages/backend`)
- Fastify local API server for browser and Electron modes.
- Owns story core, runtime services, model providers, SQLite storage, exports, and route validation.
- May import `@story-weaver/shared`.
- Concrete route modules live under `packages/backend/src/routes`.

### Shared (`packages/shared`)
- Runtime-neutral API contracts, public view types, and pure setting helpers.
- Must not import frontend, backend, Node-only, or browser-only modules.

### Electron (`electron`)
- Desktop shell.
- Starts `@story-weaver/backend` locally and loads the Vite dev URL or packaged frontend static URL.
- Does not contain business IPC handlers.

### Server API Contract
Frontend business calls use concrete local backend APIs such as `GET /api/books`,
`POST /api/books/:bookId/start`, and `PUT /api/settings/:key`. The frontend
never calls Electron IPC for business behavior. In Electron, the main process
starts the same local Fastify server and loads either Vite with a
`storyWeaverApi` query parameter during development or the packaged server URL
in production. Refreshing the frontend only reconnects HTTP/SSE clients; it does
not close the runtime, pause the scheduler, or cancel generation.

### TypeScript Configs
- `tsconfig.json` — repository-level typecheck for tests and package source aliases.
- `tsconfig.node.json` — Electron shell plus backend imports; outputs to `dist-electron/`.
- `tsconfig.server.json` — backend compatibility typecheck.
- Each workspace package also has its own `tsconfig.json`.

### Model Runtime
Generation requires at least one complete saved model config or a complete
environment model config from `STORY_WEAVER_API_KEY`.
`createRuntimeMode` filters invalid configs and `resolveModelId()` throws
`No model configured` when none remain; the runtime no longer auto-generates
mock content when no model is available.
