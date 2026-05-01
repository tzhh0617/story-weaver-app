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
