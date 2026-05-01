# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts renderer + electron concurrently)
pnpm run dev

# Browser mode (starts renderer + local Node API server)
pnpm run dev:web

# Production browser mode (builds renderer/server, then serves dist via Fastify)
pnpm run start:web

# Start an already-built browser server
pnpm run start:server

# Smoke test browser server persistence with a temp SQLite DB
pnpm run smoke:browser-persistence

# Type checking (both renderer and electron tsconfigs)
pnpm run typecheck

# Tests
pnpm test              # run all tests once
pnpm run test:watch    # watch mode

# Run a single test file
pnpm exec vitest run tests/core/scheduler.test.ts

# Build
pnpm run build         # renderer (vite) + electron (tsc)
pnpm run package       # build + electron-builder (creates .dmg/.zip)
```

Data is stored in `~/.story-weaver/` (SQLite DB, exports, logs). Electron
mode and browser mode share the same runtime services and SQLite database.

Browser server environment variables:
- `STORY_WEAVER_SERVER_HOST` — listen host, defaults to `127.0.0.1`
- `STORY_WEAVER_SERVER_PORT` — listen port, defaults to `5174`
- `STORY_WEAVER_ROOT_DIR` — runtime data directory, defaults to `~/.story-weaver`
- `STORY_WEAVER_STATIC_DIR` — built renderer directory, defaults to `dist`

Browser persistence smoke test:
1. Prefer the automated smoke script: `pnpm run smoke:browser-persistence`.
   It rebuilds Node native SQLite bindings, builds the app, starts a browser
   server on a free local port, creates a book through `/api/invoke`, verifies
   the row in a temp SQLite database, then stops the server and removes temp
   data.
2. For manual checks, use a temp data directory so local user data is untouched:
   `STORY_WEAVER_ROOT_DIR=$(mktemp -d /tmp/story-weaver-browser-smoke-XXXXXX)`
3. If Vite port `5173` is free, run `pnpm run dev:web`.
4. If `5173` is occupied, run production-style browser mode on another port:
   `pnpm run build && STORY_WEAVER_ROOT_DIR=$STORY_WEAVER_ROOT_DIR STORY_WEAVER_SERVER_PORT=5184 pnpm run start:server`
5. Open `http://127.0.0.1:5173/` for dev mode or `http://127.0.0.1:5184/` for production-style mode.
6. Verify `/api/health`, create/list a book through `/api/invoke`, and inspect the temp `data.db` with `better-sqlite3`.
7. Stop the server and remove the temp directory plus `dist-server`.

Electron packaging smoke test without overwriting `release/`:
```bash
rm -rf /tmp/story-weaver-package-smoke
pnpm run build
pnpm exec electron-builder --dir --config.directories.output=/tmp/story-weaver-package-smoke
pnpm exec asar list '/tmp/story-weaver-package-smoke/mac-arm64/Story Weaver.app/Contents/Resources/app.asar' | rg '^/(dist|dist-electron|drizzle)(/|$)'
test -f '/tmp/story-weaver-package-smoke/mac-arm64/Story Weaver.app/Contents/Resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
rm -rf /tmp/story-weaver-package-smoke dist-server
```

## Architecture

This is an **Electron desktop app** with a strict two-process split:

### Main process (`electron/`)
- `electron/main.ts` — bootstraps the BrowserWindow and registers all IPC handlers
- `electron/runtime.ts` — singleton that wires together all services (DB, scheduler, AI adapters) at startup; exports `getRuntimeServices()`
- `electron/preload.cts` — exposes `window.storyWeaver.invoke` and `window.storyWeaver.onProgress` to the renderer via `contextBridge`
- `electron/ipc/*.ts` — thin IPC handlers that call into `getRuntimeServices()`

### Browser server (`server/`)
- `server/main.ts` — Fastify local API server for browser mode
- `server/config.ts` — resolves browser server environment variables and defaults
- `server/routes/invoke.ts` — `POST /api/invoke`, mirrors existing IPC invoke channels
- `server/routes/events.ts` — SSE endpoints for scheduler, book generation, and execution logs
- `server/routes/static.ts` — serves `dist/` and falls back to `index.html` for browser routes
- `server/channel-dispatch.ts` — validates shared channel payloads and dispatches to runtime services

### Renderer (`renderer/`)
- React 19 + Tailwind v4 + shadcn/ui components
- Root: `renderer/App.tsx` — holds global state (books list, scheduler status, selected book, banner); all sub-pages receive props from here
- Three views: `Library` (list-detail), `NewBook` (creation form), `Settings` (model config + concurrency)
- `renderer/hooks/useIpc.ts` — thin wrapper around `window.storyWeaver`; falls back to HTTP/SSE transport in browser mode
- `renderer/hooks/useProgress.ts` — subscribes to `scheduler:progress` IPC push events
- `@/` resolves to `renderer/` (alias in both `vite.config.ts` and `tsconfig.json`)

### Core logic (`src/`)
All pure TypeScript — no Electron or browser APIs.

- `src/core/engine.ts` — `createNovelEngine`: orchestrates the two-phase lifecycle: (1) build outline → (2) write chapters, tracking status transitions
- `src/core/book-service.ts` — CRUD + generation entry points; called by IPC handlers
- `src/core/scheduler.ts` — in-memory concurrency scheduler; runs book jobs with optional `concurrencyLimit`
- `src/core/ai-outline.ts` / `ai-post-chapter.ts` / `chapter-writer.ts` — AI generation steps using Vercel AI SDK
- `src/models/runtime-mode.ts` — decides real vs. mock mode: if any valid model config exists, use real AI; otherwise fall back to `mock:fallback`
- `src/models/registry.ts` — builds a Vercel AI SDK registry from saved model configs
- `src/shared/contracts.ts` — shared types (`BookRecord`, `BookStatus`, `SchedulerStatus`) and all IPC channel name constants
- `src/storage/*.ts` — `better-sqlite3` repositories; `database.ts` runs migrations idempotently on startup
- `src/mock/story-services.ts` — deterministic mock implementations (keyword-scored Chinese web novel genres) used in development and tests

### IPC contract
All renderer→main calls go through `window.storyWeaver.invoke(channel, payload)`. Channel names are defined in `src/shared/contracts.ts:ipcChannels` and must be used on both sides. Push events (scheduler progress) flow from main→renderer via `ipcChannels.schedulerProgress`.

### Two tsconfigs
- `tsconfig.json` — renderer + src + tests; `moduleResolution: Bundler`
- `tsconfig.node.json` — electron process only; `moduleResolution: NodeNext` (outputs to `dist-electron/`)

### Mock / dev mode
When no model configs are saved and no `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` env vars are set, `createRuntimeMode` returns `kind: 'mock'` and all AI calls are handled by deterministic mocks in `src/mock/`. This lets the full UI flow work without API keys.
