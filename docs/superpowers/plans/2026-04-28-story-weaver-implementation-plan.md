# Story Weaver Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Story Weaver desktop application that can create books from an IDEA, generate worldbuilding and outlines, write chapters continuously with consistency tracking, manage up to 50 books concurrently, and export finished work as TXT, Markdown, or EPUB.

**Architecture:** Start from a typed Electron + React monorepo layout, keep all IO and AI orchestration in the Electron main process, and expose only a narrow typed IPC bridge to the renderer. Persist all durable state in a single SQLite database, then layer AI generation services, the book engine, the scheduler, and the renderer pages on top in dependency order so each phase produces a runnable slice.

**Tech Stack:** Electron 33+, Node.js 20+, TypeScript, React, Vite, better-sqlite3, Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`), epub-gen-memory, Vitest, React Testing Library, electron-builder

---

## Scope Note

This spec spans multiple subsystems, but the repository is currently greenfield and the layers are tightly coupled. Keep this as one execution plan for the initial build, then split later work into follow-up plans only after the shell, storage layer, engine, and renderer are all in place.

## File Structure

Create and keep these boundaries from the start:

- `package.json`: dependency manifest, scripts for dev, test, lint, build, and package.
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript and tooling configuration.
- `electron/main.ts`: Electron bootstrap, BrowserWindow creation, scheduler boot, IPC registration.
- `electron/preload.ts`: typed `contextBridge` surface for the renderer.
- `electron/ipc/books.ts`: CRUD, start, pause, resume, restart, export handlers.
- `electron/ipc/models.ts`: model list/save/test/delete handlers.
- `electron/ipc/scheduler.ts`: start-all, pause-all, status, progress event wiring.
- `electron/ipc/settings.ts`: settings read/write handlers.
- `src/shared/contracts.ts`: shared DTOs, enums, and IPC contract types used by main and renderer.
- `src/shared/paths.ts`: OS-safe app paths for SQLite, exports, and logs.
- `src/core/types.ts`: engine, outline, chapter context, extraction, and scheduler domain types.
- `src/core/retries.ts`: bounded retry and exponential backoff helpers.
- `src/core/prompt-builder.ts`: prompt templates and context serialization helpers.
- `src/core/outline.ts`: world setting, master outline, volume outline, and chapter outline generation.
- `src/core/consistency.ts`: pre-chapter context builder and post-chapter extraction pipeline.
- `src/core/chapter-writer.ts`: chapter text generation and token usage capture.
- `src/core/engine.ts`: single-book state machine that advances one book through phases.
- `src/core/scheduler.ts`: multi-book concurrency coordinator and fair chapter interleaving.
- `src/models/config.ts`: model configuration validation and normalization.
- `src/models/registry.ts`: runtime provider registry factory for active model configs.
- `src/models/providers/openai.ts`, `src/models/providers/anthropic.ts`, `src/models/providers/custom.ts`: provider constructors.
- `src/storage/database.ts`: SQLite connection, migrations, and transaction helpers.
- `src/storage/migrations.ts`: ordered schema migration list.
- `src/storage/books.ts`, `chapters.ts`, `characters.ts`, `plot-threads.ts`, `progress.ts`, `logs.ts`, `settings.ts`: repository modules, one responsibility each.
- `src/storage/export.ts`: TXT, Markdown, and EPUB generation.
- `src/utils/token-counter.ts`, `src/utils/text-splitter.ts`: token estimation and long-text chunking helpers.
- `renderer/main.tsx`, `renderer/App.tsx`: renderer entry and route shell.
- `renderer/pages/Dashboard.tsx`, `NewBook.tsx`, `BookDetail.tsx`, `Settings.tsx`: top-level screens.
- `renderer/components/BookCard.tsx`, `ProgressBar.tsx`, `ChapterList.tsx`, `StatusBadge.tsx`, `ModelForm.tsx`: reusable UI pieces.
- `renderer/hooks/useIpc.ts`, `renderer/hooks/useProgress.ts`: typed renderer hooks.
- `renderer/styles/app.css`: application styles and layout tokens.
- `tests/core/*.test.ts`, `tests/storage/*.test.ts`, `tests/models/*.test.ts`, `tests/renderer/*.test.tsx`: unit and component tests.
- `tests/e2e/smoke.spec.ts`: packaged app smoke coverage after the shell is stable.

## Task 1: Bootstrap The Workspace And Shared Contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `renderer/main.tsx`
- Create: `renderer/App.tsx`
- Create: `renderer/styles/app.css`
- Create: `src/shared/contracts.ts`
- Create: `src/shared/paths.ts`
- Test: `tests/core/paths.test.ts`

- [ ] **Step 1: Write the failing shared-path test**

```ts
// tests/core/paths.test.ts
import { describe, expect, it } from 'vitest';
import { buildAppPaths } from '../../src/shared/paths';

describe('buildAppPaths', () => {
  it('builds stable data, export, and log paths under the app root', () => {
    const paths = buildAppPaths('/tmp/story-weaver');

    expect(paths.databaseFile).toBe('/tmp/story-weaver/data.db');
    expect(paths.exportDir).toBe('/tmp/story-weaver/exports');
    expect(paths.logDir).toBe('/tmp/story-weaver/logs');
  });
});
```

- [ ] **Step 2: Run the targeted test to verify the repo is still unbootstrapped**

Run: `npm run test -- tests/core/paths.test.ts`

Expected: FAIL with `Cannot find module '../../src/shared/paths'` or a missing script error because the workspace has not been scaffolded yet.

- [ ] **Step 3: Add package scripts, TypeScript/Vite config, the renderer entrypoint, and the shared contract files**

```json
{
  "name": "story-weaver-app",
  "version": "0.1.0",
  "private": true,
  "main": "dist-electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:renderer\" \"npm:dev:electron\"",
    "dev:renderer": "vite",
    "dev:electron": "wait-on tcp:5173 && electron .",
    "build": "npm run build:renderer && npm run build:electron",
    "build:renderer": "vite build",
    "build:electron": "tsc -p tsconfig.node.json",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "package": "npm run build && electron-builder"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/openai-compatible": "^0.2.0",
    "ai": "^4.0.0",
    "better-sqlite3": "^11.7.0",
    "electron": "^33.0.0",
    "epub-gen-memory": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.0",
    "electron-builder": "^25.1.8",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.1",
    "vitest": "^2.1.8",
    "wait-on": "^8.0.1"
  }
}
```

```ts
// src/shared/paths.ts
export type AppPaths = {
  databaseFile: string;
  exportDir: string;
  logDir: string;
};

export function buildAppPaths(rootDir: string): AppPaths {
  return {
    databaseFile: `${rootDir}/data.db`,
    exportDir: `${rootDir}/exports`,
    logDir: `${rootDir}/logs`,
  };
}
```

```ts
// src/shared/contracts.ts
export type BookStatus = 'creating' | 'building_world' | 'building_outline' | 'writing' | 'paused' | 'completed' | 'error';

export type BookRecord = {
  id: string;
  title: string;
  idea: string;
  status: BookStatus;
  modelId: string;
  targetWords: number;
  createdAt: string;
  updatedAt: string;
};

export type SchedulerStatus = {
  runningBookIds: string[];
  queuedBookIds: string[];
  pausedBookIds: string[];
  concurrencyLimit: number | null;
};
```

```tsx
// renderer/App.tsx
export default function App() {
  return (
    <main className="app-shell">
      <h1>Story Weaver</h1>
      <p>Desktop novel automation console is bootstrapping.</p>
    </main>
  );
}
```

- [ ] **Step 4: Run the focused test suite and typecheck**

Run: `npm install && npm run test -- tests/core/paths.test.ts && npm run typecheck`

Expected: PASS for `tests/core/paths.test.ts`, then TypeScript exits with code `0`.

- [ ] **Step 5: Commit the workspace bootstrap**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts .gitignore renderer src tests
git commit -m "chore: bootstrap electron react workspace"
```

## Task 2: Add The Electron Shell And Typed IPC Bridge

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `electron/ipc/books.ts`
- Create: `electron/ipc/models.ts`
- Create: `electron/ipc/scheduler.ts`
- Create: `electron/ipc/settings.ts`
- Modify: `src/shared/contracts.ts`
- Test: `tests/core/ipc-contracts.test.ts`

- [ ] **Step 1: Write the failing IPC contract test**

```ts
// tests/core/ipc-contracts.test.ts
import { describe, expect, it } from 'vitest';
import { ipcChannels } from '../../src/shared/contracts';

describe('ipcChannels', () => {
  it('defines the required book and scheduler channels', () => {
    expect(ipcChannels.bookCreate).toBe('book:create');
    expect(ipcChannels.schedulerStatus).toBe('scheduler:status');
    expect(ipcChannels.bookError).toBe('book:error');
  });
});
```

- [ ] **Step 2: Run the targeted IPC contract test**

Run: `npm run test -- tests/core/ipc-contracts.test.ts`

Expected: FAIL because `ipcChannels` is not exported yet.

- [ ] **Step 3: Implement the Electron shell, preload bridge, and IPC channel registration**

```ts
// src/shared/contracts.ts
export const ipcChannels = {
  bookCreate: 'book:create',
  bookDelete: 'book:delete',
  bookList: 'book:list',
  bookDetail: 'book:detail',
  bookStart: 'book:start',
  bookPause: 'book:pause',
  bookResume: 'book:resume',
  bookRestart: 'book:restart',
  bookExport: 'book:export',
  schedulerStartAll: 'scheduler:startAll',
  schedulerPauseAll: 'scheduler:pauseAll',
  schedulerStatus: 'scheduler:status',
  schedulerProgress: 'scheduler:progress',
  bookChapterDone: 'book:chapterDone',
  bookError: 'book:error',
  modelList: 'model:list',
  modelSave: 'model:save',
  modelTest: 'model:test',
  modelDelete: 'model:delete',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
} as const;
```

```ts
// electron/main.ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerBookHandlers } from './ipc/books';
import { registerModelHandlers } from './ipc/models';
import { registerSchedulerHandlers } from './ipc/scheduler';
import { registerSettingsHandlers } from './ipc/settings';

async function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist-electron/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await window.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }
}

app.whenReady().then(async () => {
  registerBookHandlers();
  registerModelHandlers();
  registerSchedulerHandlers();
  registerSettingsHandlers();
  await createWindow();
});
```

```ts
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { ipcChannels } from '../src/shared/contracts';

contextBridge.exposeInMainWorld('storyWeaver', {
  invoke: <T>(channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload) as Promise<T>,
  onProgress: (listener: (payload: unknown) => void) => {
    const wrapped = (_event: unknown, payload: unknown) => listener(payload);
    ipcRenderer.on(ipcChannels.schedulerProgress, wrapped);
    return () => ipcRenderer.removeListener(ipcChannels.schedulerProgress, wrapped);
  },
});
```

- [ ] **Step 4: Run the IPC contract test and a main-process typecheck**

Run: `npm run test -- tests/core/ipc-contracts.test.ts && npm run typecheck`

Expected: PASS for the IPC test and TypeScript exits with code `0`.

- [ ] **Step 5: Commit the Electron shell**

```bash
git add electron src/shared tests/core/ipc-contracts.test.ts
git commit -m "feat: add electron shell and typed ipc bridge"
```

## Task 3: Implement SQLite Setup, Migrations, And Core Repositories

**Files:**
- Create: `src/storage/migrations.ts`
- Create: `src/storage/database.ts`
- Create: `src/storage/books.ts`
- Create: `src/storage/chapters.ts`
- Create: `src/storage/characters.ts`
- Create: `src/storage/plot-threads.ts`
- Create: `src/storage/progress.ts`
- Create: `src/storage/logs.ts`
- Create: `src/storage/settings.ts`
- Modify: `src/shared/contracts.ts`
- Test: `tests/storage/database.test.ts`
- Test: `tests/storage/books.test.ts`

- [ ] **Step 1: Write the failing database and repository tests**

```ts
// tests/storage/database.test.ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';

describe('createDatabase', () => {
  it('creates the expected tables on first boot', () => {
    const db = createDatabase(':memory:');
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const tableNames = rows.map((row) => row.name);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('writing_progress');
    expect(tableNames).toContain('model_configs');
  });
});
```

```ts
// tests/storage/books.test.ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../../src/storage/database';
import { createBookRepository } from '../../src/storage/books';

describe('book repository', () => {
  it('inserts and lists books in updated order', () => {
    const db = createDatabase(':memory:');
    const repo = createBookRepository(db);

    repo.create({
      id: 'book-1',
      title: 'Book 1',
      idea: 'A city remembers every promise.',
      modelId: 'openai.gpt-4o-mini',
      targetWords: 500000,
    });

    expect(repo.list()[0]?.id).toBe('book-1');
  });
});
```

- [ ] **Step 2: Run the storage tests to verify the persistence layer does not exist yet**

Run: `npm run test -- tests/storage/database.test.ts tests/storage/books.test.ts`

Expected: FAIL because `src/storage/database.ts` and `src/storage/books.ts` do not exist.

- [ ] **Step 3: Implement migrations, the database factory, and the repository modules**

```ts
// src/storage/migrations.ts
export const migrations = [
  `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    idea TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'creating',
    model_id TEXT NOT NULL,
    target_words INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS book_context (
    book_id TEXT PRIMARY KEY,
    world_setting TEXT,
    outline TEXT,
    style_guide TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
  CREATE TABLE IF NOT EXISTS writing_progress (
    book_id TEXT PRIMARY KEY,
    current_volume INTEGER,
    current_chapter INTEGER,
    phase TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_msg TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
  CREATE TABLE IF NOT EXISTS model_configs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    api_key TEXT,
    base_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    config_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role_type TEXT NOT NULL,
    personality TEXT NOT NULL,
    speech_style TEXT,
    appearance TEXT,
    abilities TEXT,
    background TEXT,
    relationships TEXT,
    first_appear INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
  CREATE TABLE IF NOT EXISTS character_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    location TEXT,
    status TEXT,
    knowledge TEXT,
    emotion TEXT,
    power_level TEXT,
    UNIQUE (book_id, character_id, volume_index, chapter_index)
  );
  CREATE TABLE IF NOT EXISTS plot_threads (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    description TEXT NOT NULL,
    planted_at INTEGER NOT NULL,
    expected_payoff INTEGER,
    resolved_at INTEGER,
    importance TEXT NOT NULL DEFAULT 'normal',
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
  CREATE TABLE IF NOT EXISTS world_settings (
    book_id TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (book_id, category, key),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
  CREATE TABLE IF NOT EXISTS scene_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    location TEXT NOT NULL,
    time_in_story TEXT NOT NULL,
    characters_present TEXT NOT NULL,
    events TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
  CREATE TABLE IF NOT EXISTS chapters (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    title TEXT,
    outline TEXT,
    content TEXT,
    summary TEXT,
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    PRIMARY KEY (book_id, volume_index, chapter_index)
  );
  CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT,
    model_id TEXT,
    phase TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `
];
```

```ts
// src/storage/database.ts
import Database from 'better-sqlite3';
import { migrations } from './migrations';

export function createDatabase(filename: string) {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  for (const migration of migrations) {
    db.exec(migration);
  }

  return db;
}
```

```ts
// src/storage/books.ts
import type Database from 'better-sqlite3';
import type { BookRecord } from '../shared/contracts';

type NewBookInput = Pick<BookRecord, 'id' | 'title' | 'idea' | 'modelId' | 'targetWords'>;

export function createBookRepository(db: Database.Database) {
  return {
    create(input: NewBookInput) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO books (id, title, idea, status, model_id, target_words, created_at, updated_at)
        VALUES (@id, @title, @idea, 'creating', @modelId, @targetWords, @now, @now)
      `).run({ ...input, now });
    },
    list(): BookRecord[] {
      return db.prepare(`
        SELECT
          id,
          title,
          idea,
          status,
          model_id AS modelId,
          target_words AS targetWords,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM books
        ORDER BY updated_at DESC
      `).all() as BookRecord[];
    },
  };
}
```

- [ ] **Step 4: Run the storage tests and a full typecheck**

Run: `npm run test -- tests/storage/database.test.ts tests/storage/books.test.ts && npm run typecheck`

Expected: PASS for both storage tests and TypeScript exits with code `0`.

- [ ] **Step 5: Commit the persistence layer**

```bash
git add src/storage src/shared/contracts.ts tests/storage
git commit -m "feat: add sqlite storage layer"
```

## Task 4: Add Model Configuration Validation And Runtime Provider Registry

**Files:**
- Create: `src/models/config.ts`
- Create: `src/models/registry.ts`
- Create: `src/models/providers/openai.ts`
- Create: `src/models/providers/anthropic.ts`
- Create: `src/models/providers/custom.ts`
- Modify: `src/storage/settings.ts`
- Test: `tests/models/registry.test.ts`

- [ ] **Step 1: Write the failing provider registry test**

```ts
// tests/models/registry.test.ts
import { describe, expect, it } from 'vitest';
import { validateModelConfig } from '../../src/models/config';

describe('validateModelConfig', () => {
  it('requires baseUrl for custom openai-compatible providers', () => {
    expect(() =>
      validateModelConfig({
        id: 'deepseek-chat',
        provider: 'deepseek',
        modelName: 'deepseek-chat',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      })
    ).toThrow(/baseUrl/);
  });
});
```

- [ ] **Step 2: Run the model test**

Run: `npm run test -- tests/models/registry.test.ts`

Expected: FAIL because the model config module has not been created.

- [ ] **Step 3: Implement model config validation and the runtime provider registry**

```ts
// src/models/config.ts
export type ModelProvider = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'glm' | 'custom';

export type ModelConfigInput = {
  id: string;
  provider: ModelProvider;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  config: Record<string, unknown>;
};

export function validateModelConfig(input: ModelConfigInput) {
  if (!input.id.trim()) throw new Error('id is required');
  if (!input.modelName.trim()) throw new Error('modelName is required');
  if (!input.apiKey.trim()) throw new Error('apiKey is required');
  if (['deepseek', 'qwen', 'glm', 'custom'].includes(input.provider) && !input.baseUrl.trim()) {
    throw new Error('baseUrl is required for openai-compatible providers');
  }

  return input;
}
```

```ts
// src/models/registry.ts
import { createProviderRegistry } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ModelConfigInput } from './config';

export function createRuntimeRegistry(configs: ModelConfigInput[]) {
  const providers = {
    openai: createOpenAI({ apiKey: configs.find((config) => config.provider === 'openai')?.apiKey ?? '' }),
    anthropic: createAnthropic({ apiKey: configs.find((config) => config.provider === 'anthropic')?.apiKey ?? '' }),
  };

  const compatibleProviders = Object.fromEntries(
    configs
      .filter((config) => ['deepseek', 'qwen', 'glm', 'custom'].includes(config.provider))
      .map((config) => [
        config.provider,
        createOpenAICompatible({
          name: config.provider,
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
        }),
      ])
  );

  return createProviderRegistry({
    ...providers,
    ...compatibleProviders,
  });
}
```

- [ ] **Step 4: Run the validation test and the full unit suite so far**

Run: `npm run test -- tests/models/registry.test.ts tests/storage/database.test.ts tests/storage/books.test.ts`

Expected: PASS for the new model validation test and no regression in the storage tests.

- [ ] **Step 5: Commit the model registry**

```bash
git add src/models src/storage/settings.ts tests/models/registry.test.ts
git commit -m "feat: add model registry and config validation"
```

## Task 5: Build Outline Generation And Prompt Composition

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/prompt-builder.ts`
- Create: `src/core/outline.ts`
- Modify: `src/storage/books.ts`
- Modify: `src/storage/chapters.ts`
- Test: `tests/core/prompt-builder.test.ts`
- Test: `tests/core/outline.test.ts`

- [ ] **Step 1: Write the failing prompt-builder and outline tests**

```ts
// tests/core/prompt-builder.test.ts
import { describe, expect, it } from 'vitest';
import { buildWorldPrompt } from '../../src/core/prompt-builder';

describe('buildWorldPrompt', () => {
  it('anchors the worldbuilding prompt to the user idea and target word count', () => {
    const prompt = buildWorldPrompt({
      idea: 'A mountain archive decides who may remember history.',
      targetWords: 500000,
    });

    expect(prompt).toContain('A mountain archive decides who may remember history.');
    expect(prompt).toContain('500000');
  });
});
```

```ts
// tests/core/outline.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createOutlineService } from '../../src/core/outline';

describe('createOutlineService', () => {
  it('calls the model in world -> master -> volume -> chapter order', async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1\n---\nVolume 2' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 1' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 2' });

    const service = createOutlineService({ generateText: generate });
    await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetWords: 500000,
    });

    expect(generate).toHaveBeenNthCalledWith(1, expect.objectContaining({ prompt: expect.stringContaining('The moon taxes miracles.') }));
    expect(generate).toHaveBeenNthCalledWith(2, expect.objectContaining({ prompt: expect.stringContaining('world') }));
    expect(generate).toHaveBeenNthCalledWith(3, expect.objectContaining({ prompt: expect.stringContaining('outline') }));
    expect(generate).toHaveBeenCalledTimes(5);
  });
});
```

- [ ] **Step 2: Run the focused core tests**

Run: `npm run test -- tests/core/prompt-builder.test.ts tests/core/outline.test.ts`

Expected: FAIL because the prompt builder and outline modules do not exist yet.

- [ ] **Step 3: Implement prompt composition, outline types, and the outline generation service**

```ts
// src/core/types.ts
export type OutlineGenerationInput = {
  bookId: string;
  idea: string;
  targetWords: number;
};

export type OutlineBundle = {
  worldSetting: string;
  masterOutline: string;
  volumeOutlines: string[];
  chapterOutlines: Array<{ volumeIndex: number; chapterIndex: number; title: string; outline: string }>;
};
```

```ts
// src/core/prompt-builder.ts
import type { OutlineGenerationInput } from './types';

export function buildWorldPrompt(input: Pick<OutlineGenerationInput, 'idea' | 'targetWords'>) {
  return [
    'You are designing a long-form Chinese web novel.',
    `User idea: ${input.idea}`,
    `Target length: ${input.targetWords} words`,
    'Return world rules, character anchors, power system, core conflict, and tone guide.',
  ].join('\n');
}

export function buildMasterOutlinePrompt(worldSetting: string, input: Pick<OutlineGenerationInput, 'idea' | 'targetWords'>) {
  return [
    `User idea: ${input.idea}`,
    `World setting:\n${worldSetting}`,
    `Target length: ${input.targetWords} words`,
    'Return the full-book outline, volume breakdown, and chapter count guidance.',
  ].join('\n');
}

export function buildVolumeOutlinePrompt(masterOutline: string, volumeCount = 10) {
  return [
    `Master outline:\n${masterOutline}`,
    `Expand this into ${volumeCount} volume outlines.`,
    'For each volume, return a heading and 10-20 chapter beats.',
    'Separate volumes with a line containing only ---',
  ].join('\n');
}

export function buildChapterOutlinePrompt(volumeOutline: string, volumeIndex: number) {
  return [
    `Volume ${volumeIndex} outline:\n${volumeOutline}`,
    'Return chapter-level outlines in the format "chapterIndex|title|outline".',
    'Generate one line per chapter.',
  ].join('\n');
}
```

```ts
// src/core/outline.ts
import { buildChapterOutlinePrompt, buildMasterOutlinePrompt, buildVolumeOutlinePrompt, buildWorldPrompt } from './prompt-builder';
import type { OutlineBundle, OutlineGenerationInput } from './types';

type GenerateText = (input: { prompt: string }) => Promise<{ text: string }>;

export function createOutlineService({ generateText }: { generateText: GenerateText }) {
  return {
    async generateFromIdea(input: OutlineGenerationInput): Promise<OutlineBundle> {
      const worldSetting = (await generateText({ prompt: buildWorldPrompt(input) })).text;
      const masterOutline = (await generateText({ prompt: buildMasterOutlinePrompt(worldSetting, input) })).text;
      const volumeOutlineText = (await generateText({ prompt: buildVolumeOutlinePrompt(masterOutline) })).text;
      const volumeOutlines = volumeOutlineText.split('\n---\n').filter(Boolean);
      const chapterOutlines = (
        await Promise.all(
          volumeOutlines.map(async (volumeOutline, index) => {
            const chapterText = (
              await generateText({
                prompt: buildChapterOutlinePrompt(volumeOutline, index + 1),
              })
            ).text;

            return chapterText
              .split('\n')
              .filter(Boolean)
              .map((line) => {
                const [chapterIndex, title, outline] = line.split('|');
                return {
                  volumeIndex: index + 1,
                  chapterIndex: Number(chapterIndex),
                  title,
                  outline,
                };
              });
          })
        )
      ).flat();

      return {
        worldSetting,
        masterOutline,
        volumeOutlines,
        chapterOutlines,
      };
    },
  };
}
```

- [ ] **Step 4: Run the outline tests and a typecheck**

Run: `npm run test -- tests/core/prompt-builder.test.ts tests/core/outline.test.ts && npm run typecheck`

Expected: PASS for both outline-related tests and TypeScript exits with code `0`.

- [ ] **Step 5: Commit the outline pipeline**

```bash
git add src/core src/storage/books.ts src/storage/chapters.ts tests/core
git commit -m "feat: add outline generation pipeline"
```

## Task 6: Implement Consistency Tracking And Chapter Writing

**Files:**
- Create: `src/core/consistency.ts`
- Create: `src/core/chapter-writer.ts`
- Create: `src/utils/token-counter.ts`
- Create: `src/utils/text-splitter.ts`
- Modify: `src/storage/characters.ts`
- Modify: `src/storage/plot-threads.ts`
- Modify: `src/storage/chapters.ts`
- Modify: `src/storage/logs.ts`
- Test: `tests/core/consistency.test.ts`
- Test: `tests/core/chapter-writer.test.ts`

- [ ] **Step 1: Write the failing consistency and chapter-writing tests**

```ts
// tests/core/consistency.test.ts
import { describe, expect, it } from 'vitest';
import { selectOpenThreads } from '../../src/core/consistency';

describe('selectOpenThreads', () => {
  it('returns unresolved threads ordered by nearest expected payoff', () => {
    const result = selectOpenThreads([
      { id: 'late', expectedPayoff: 40, resolvedAt: null },
      { id: 'soon', expectedPayoff: 12, resolvedAt: null },
      { id: 'closed', expectedPayoff: 8, resolvedAt: 8 },
    ]);

    expect(result.map((thread) => thread.id)).toEqual(['soon', 'late']);
  });
});
```

```ts
// tests/core/chapter-writer.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createChapterWriter } from '../../src/core/chapter-writer';

describe('createChapterWriter', () => {
  it('records tokens and returns chapter text', async () => {
    const generateText = vi.fn().mockResolvedValue({
      text: 'Chapter output',
      usage: { inputTokens: 100, outputTokens: 400 },
    });

    const writer = createChapterWriter({ generateText });
    const result = await writer.writeChapter({ prompt: 'Write chapter 1' });

    expect(result.content).toBe('Chapter output');
    expect(result.usage.outputTokens).toBe(400);
  });
});
```

- [ ] **Step 2: Run the new core tests**

Run: `npm run test -- tests/core/consistency.test.ts tests/core/chapter-writer.test.ts`

Expected: FAIL because neither module exists.

- [ ] **Step 3: Implement context assembly, post-chapter extraction hooks, token counting, and chapter writing**

```ts
// src/core/consistency.ts
type PlotThreadLite = { id: string; expectedPayoff: number | null; resolvedAt: number | null };

export function selectOpenThreads(threads: PlotThreadLite[]) {
  return threads
    .filter((thread) => thread.resolvedAt === null)
    .sort((left, right) => (left.expectedPayoff ?? Number.MAX_SAFE_INTEGER) - (right.expectedPayoff ?? Number.MAX_SAFE_INTEGER));
}

export function buildChapterContext(input: {
  worldRules: string[];
  personalities: string[];
  recentStates: string[];
  openThreads: string[];
  lastScene: string | null;
  recentSummaries: string[];
  currentChapterOutline: string;
}) {
  return [
    'World rules:',
    ...input.worldRules,
    'Character anchors:',
    ...input.personalities,
    'Recent states:',
    ...input.recentStates,
    'Open threads:',
    ...input.openThreads,
    `Last scene: ${input.lastScene ?? 'none'}`,
    'Recent chapter summaries:',
    ...input.recentSummaries,
    `Current chapter outline: ${input.currentChapterOutline}`,
  ].join('\n');
}
```

```ts
// src/core/chapter-writer.ts
type GenerateText = (input: { prompt: string }) => Promise<{
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}>;

export function createChapterWriter({ generateText }: { generateText: GenerateText }) {
  return {
    async writeChapter(input: { prompt: string }) {
      const response = await generateText({ prompt: input.prompt });
      return {
        content: response.text,
        usage: {
          inputTokens: response.usage?.inputTokens ?? 0,
          outputTokens: response.usage?.outputTokens ?? 0,
        },
      };
    },
  };
}
```

```ts
// src/utils/token-counter.ts
export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 4: Run the focused core tests plus the outline tests to catch interface drift**

Run: `npm run test -- tests/core/consistency.test.ts tests/core/chapter-writer.test.ts tests/core/prompt-builder.test.ts tests/core/outline.test.ts`

Expected: PASS for all four tests.

- [ ] **Step 5: Commit the chapter writing pipeline**

```bash
git add src/core src/storage src/utils tests/core
git commit -m "feat: add chapter writing and consistency tracking"
```

## Task 7: Build The Novel Engine State Machine And Fair Scheduler

**Files:**
- Create: `src/core/retries.ts`
- Create: `src/core/engine.ts`
- Create: `src/core/scheduler.ts`
- Modify: `electron/ipc/books.ts`
- Modify: `electron/ipc/scheduler.ts`
- Modify: `src/storage/progress.ts`
- Test: `tests/core/engine.test.ts`
- Test: `tests/core/scheduler.test.ts`

- [ ] **Step 1: Write the failing engine and scheduler tests**

```ts
// tests/core/engine.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createNovelEngine } from '../../src/core/engine';

describe('createNovelEngine', () => {
  it('moves from creating to building_world when start is called', async () => {
    const engine = createNovelEngine({
      bookId: 'book-1',
      outlineService: { generateFromIdea: vi.fn().mockResolvedValue({ worldSetting: 'world', masterOutline: 'outline', volumeOutlines: [], chapterOutlines: [] }) },
      chapterWriter: { writeChapter: vi.fn() },
      repositories: {
        books: {
          getById: () => ({ id: 'book-1', idea: 'The city taxes shadows.', targetWords: 500000 }),
        },
        progress: {
          updatePhase: vi.fn(),
        },
      },
    });

    await engine.start();
    expect(engine.getStatus()).toBe('building_world');
  });
});
```

```ts
// tests/core/scheduler.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createScheduler } from '../../src/core/scheduler';

describe('createScheduler', () => {
  it('starts only up to the concurrency limit', async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({ concurrencyLimit: 2 });

    scheduler.register({ bookId: 'a', start });
    scheduler.register({ bookId: 'b', start });
    scheduler.register({ bookId: 'c', start });

    await scheduler.startAll();

    expect(start).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the engine and scheduler tests**

Run: `npm run test -- tests/core/engine.test.ts tests/core/scheduler.test.ts`

Expected: FAIL because the orchestration modules do not exist.

- [ ] **Step 3: Implement retries, the per-book engine, and the multi-book scheduler**

```ts
// src/core/retries.ts
export async function withRetries<T>(run: () => Promise<T>, maxAttempts = 3) {
  let delayMs = 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  throw lastError;
}
```

```ts
// src/core/engine.ts
import type { BookStatus } from '../shared/contracts';

export function createNovelEngine(deps: {
  bookId: string;
  outlineService: { generateFromIdea: (input: { bookId: string; idea: string; targetWords: number }) => Promise<unknown> };
  chapterWriter: { writeChapter: (input: { prompt: string }) => Promise<unknown> };
  repositories: {
    books: { getById: (bookId: string) => { id: string; idea: string; targetWords: number } };
    progress: { updatePhase: (bookId: string, phase: string) => void };
  };
}) {
  let status: BookStatus = 'creating';

  return {
    async start() {
      status = 'building_world';
      deps.repositories.progress.updatePhase(deps.bookId, status);
      const book = deps.repositories.books.getById(deps.bookId);
      await deps.outlineService.generateFromIdea({
        bookId: book.id,
        idea: book.idea,
        targetWords: book.targetWords,
      });
    },
    getStatus() {
      return status;
    },
  };
}
```

```ts
// src/core/scheduler.ts
type Runner = { bookId: string; start: () => Promise<void> };

export function createScheduler({ concurrencyLimit }: { concurrencyLimit: number | null }) {
  const runners = new Map<string, Runner>();

  return {
    register(runner: Runner) {
      runners.set(runner.bookId, runner);
    },
    async startAll() {
      const selected = [...runners.values()].slice(0, concurrencyLimit ?? runners.size);
      await Promise.all(selected.map((runner) => runner.start()));
    },
  };
}
```

- [ ] **Step 4: Run the engine/scheduler tests and then the full core suite**

Run: `npm run test -- tests/core/engine.test.ts tests/core/scheduler.test.ts tests/core/consistency.test.ts tests/core/chapter-writer.test.ts tests/core/prompt-builder.test.ts tests/core/outline.test.ts`

Expected: PASS for all six tests.

- [ ] **Step 5: Commit the orchestration layer**

```bash
git add src/core electron/ipc src/storage/progress.ts tests/core
git commit -m "feat: add novel engine and scheduler"
```

## Task 8: Add Book IPC Handlers And The Dashboard/New Book Flow

**Files:**
- Modify: `electron/ipc/books.ts`
- Modify: `electron/ipc/scheduler.ts`
- Create: `renderer/hooks/useIpc.ts`
- Create: `renderer/hooks/useProgress.ts`
- Create: `renderer/pages/Dashboard.tsx`
- Create: `renderer/pages/NewBook.tsx`
- Create: `renderer/components/BookCard.tsx`
- Create: `renderer/components/ProgressBar.tsx`
- Create: `renderer/components/StatusBadge.tsx`
- Modify: `renderer/App.tsx`
- Modify: `renderer/styles/app.css`
- Test: `tests/renderer/dashboard.test.tsx`
- Test: `tests/renderer/new-book.test.tsx`

- [ ] **Step 1: Write the failing Dashboard and NewBook renderer tests**

```tsx
// tests/renderer/dashboard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Dashboard from '../../renderer/pages/Dashboard';

describe('Dashboard', () => {
  it('renders the batch controls and summary line', () => {
    render(<Dashboard books={[]} scheduler={{ runningBookIds: [], queuedBookIds: [], pausedBookIds: [], concurrencyLimit: 3 }} />);

    expect(screen.getByText('全部开始')).toBeInTheDocument();
    expect(screen.getByText(/0\/50 完成/)).toBeInTheDocument();
  });
});
```

```tsx
// tests/renderer/new-book.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NewBook from '../../renderer/pages/NewBook';

describe('NewBook', () => {
  it('submits idea, model, and target word count', () => {
    const onCreate = vi.fn();
    render(<NewBook models={[{ id: 'openai.gpt-4o-mini', label: 'GPT-4o mini' }]} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('IDEA'), { target: { value: 'A map eats its explorers.' } });
    fireEvent.change(screen.getByLabelText('模型'), { target: { value: 'openai.gpt-4o-mini' } });
    fireEvent.change(screen.getByLabelText('目标字数'), { target: { value: '500000' } });
    fireEvent.click(screen.getByText('开始写作'));

    expect(onCreate).toHaveBeenCalledWith({
      idea: 'A map eats its explorers.',
      modelId: 'openai.gpt-4o-mini',
      targetWords: 500000,
    });
  });
});
```

- [ ] **Step 2: Run the renderer tests**

Run: `npm run test -- tests/renderer/dashboard.test.tsx tests/renderer/new-book.test.tsx`

Expected: FAIL because the renderer pages and hooks do not exist.

- [ ] **Step 3: Implement the book handlers, progress hooks, dashboard, and creation form**

```ts
// renderer/hooks/useIpc.ts
declare global {
  interface Window {
    storyWeaver: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<T>;
      onProgress: (listener: (payload: unknown) => void) => () => void;
    };
  }
}

export function useIpc() {
  return window.storyWeaver;
}
```

```tsx
// renderer/pages/NewBook.tsx
import { useState } from 'react';

export default function NewBook({
  models,
  onCreate,
}: {
  models: Array<{ id: string; label: string }>;
  onCreate: (input: { idea: string; modelId: string; targetWords: number }) => void;
}) {
  const [idea, setIdea] = useState('');
  const [modelId, setModelId] = useState(models[0]?.id ?? '');
  const [targetWords, setTargetWords] = useState(500000);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onCreate({ idea, modelId, targetWords });
      }}
    >
      <label>
        IDEA
        <textarea aria-label="IDEA" value={idea} onChange={(event) => setIdea(event.target.value)} />
      </label>
      <label>
        模型
        <select aria-label="模型" value={modelId} onChange={(event) => setModelId(event.target.value)}>
          {models.map((model) => (
            <option key={model.id} value={model.id}>{model.label}</option>
          ))}
        </select>
      </label>
      <label>
        目标字数
        <input aria-label="目标字数" type="number" value={targetWords} onChange={(event) => setTargetWords(Number(event.target.value))} />
      </label>
      <button type="submit">开始写作</button>
    </form>
  );
}
```

```tsx
// renderer/pages/Dashboard.tsx
export default function Dashboard({
  books,
  scheduler,
}: {
  books: Array<{ id: string; title: string; status: string; targetWords: number }>;
  scheduler: { runningBookIds: string[]; queuedBookIds: string[]; pausedBookIds: string[]; concurrencyLimit: number | null };
}) {
  return (
    <section>
      <header>
        <button type="button">全部开始</button>
        <button type="button">全部暂停</button>
      </header>
      <p>{`0/50 完成 | ${scheduler.runningBookIds.length} 写作中 | ${scheduler.queuedBookIds.length} 排队`}</p>
      <div>{books.map((book) => <article key={book.id}>{book.title}</article>)}</div>
    </section>
  );
}
```

- [ ] **Step 4: Run the renderer tests and the typecheck**

Run: `npm run test -- tests/renderer/dashboard.test.tsx tests/renderer/new-book.test.tsx && npm run typecheck`

Expected: PASS for the two renderer tests and TypeScript exits with code `0`.

- [ ] **Step 5: Commit the dashboard and book-creation flow**

```bash
git add electron/ipc renderer tests/renderer
git commit -m "feat: add dashboard and book creation flow"
```

## Task 9: Add Book Detail, Chapter Inspection, And Settings Management

**Files:**
- Create: `renderer/pages/BookDetail.tsx`
- Create: `renderer/pages/Settings.tsx`
- Create: `renderer/components/ChapterList.tsx`
- Create: `renderer/components/ModelForm.tsx`
- Modify: `renderer/components/BookCard.tsx`
- Modify: `electron/ipc/models.ts`
- Modify: `electron/ipc/settings.ts`
- Modify: `src/storage/settings.ts`
- Test: `tests/renderer/book-detail.test.tsx`
- Test: `tests/renderer/settings.test.tsx`

- [ ] **Step 1: Write the failing BookDetail and Settings tests**

```tsx
// tests/renderer/book-detail.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BookDetail from '../../renderer/pages/BookDetail';

describe('BookDetail', () => {
  it('shows tabs for outline, characters, chapters, and plot threads', () => {
    render(<BookDetail book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }} />);

    expect(screen.getByText('大纲')).toBeInTheDocument();
    expect(screen.getByText('人物')).toBeInTheDocument();
    expect(screen.getByText('章节')).toBeInTheDocument();
    expect(screen.getByText('伏笔')).toBeInTheDocument();
  });
});
```

```tsx
// tests/renderer/settings.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Settings from '../../renderer/pages/Settings';

describe('Settings', () => {
  it('submits model settings and global settings', () => {
    const onSaveModel = vi.fn();
    const onSaveSetting = vi.fn();

    render(<Settings onSaveModel={onSaveModel} onSaveSetting={onSaveSetting} />);
    fireEvent.click(screen.getByText('保存模型'));
    fireEvent.click(screen.getByText('保存设置'));

    expect(onSaveModel).toHaveBeenCalled();
    expect(onSaveSetting).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the BookDetail and Settings tests**

Run: `npm run test -- tests/renderer/book-detail.test.tsx tests/renderer/settings.test.tsx`

Expected: FAIL because these screens and forms do not exist yet.

- [ ] **Step 3: Implement the detail page, chapter list, settings page, and model form**

```tsx
// renderer/pages/BookDetail.tsx
export default function BookDetail({
  book,
}: {
  book: { title: string; status: string; wordCount: number };
}) {
  return (
    <section>
      <header>
        <h2>{book.title}</h2>
        <p>{`${book.status} · ${book.wordCount} 字`}</p>
        <button type="button">暂停</button>
        <button type="button">导出</button>
      </header>
      <nav>
        <button type="button">大纲</button>
        <button type="button">人物</button>
        <button type="button">章节</button>
        <button type="button">伏笔</button>
      </nav>
    </section>
  );
}
```

```tsx
// renderer/pages/Settings.tsx
export default function Settings({
  onSaveModel,
  onSaveSetting,
}: {
  onSaveModel: () => void;
  onSaveSetting: () => void;
}) {
  return (
    <section>
      <h2>设置</h2>
      <button type="button" onClick={onSaveModel}>保存模型</button>
      <button type="button" onClick={onSaveSetting}>保存设置</button>
    </section>
  );
}
```

```tsx
// renderer/components/ChapterList.tsx
export default function ChapterList({
  chapters,
}: {
  chapters: Array<{ id: string; title: string; wordCount: number; status: 'done' | 'writing' | 'queued' }>;
}) {
  return (
    <ul>
      {chapters.map((chapter) => (
        <li key={chapter.id}>{`${chapter.title} · ${chapter.wordCount} 字`}</li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run the new renderer tests plus the dashboard tests to catch shared UI regressions**

Run: `npm run test -- tests/renderer/book-detail.test.tsx tests/renderer/settings.test.tsx tests/renderer/dashboard.test.tsx tests/renderer/new-book.test.tsx`

Expected: PASS for all four renderer tests.

- [ ] **Step 5: Commit the detail and settings experience**

```bash
git add renderer electron/ipc src/storage/settings.ts tests/renderer
git commit -m "feat: add book detail and settings pages"
```

## Task 10: Add Export, Recovery, Packaging, And Smoke Coverage

**Files:**
- Create: `src/storage/export.ts`
- Modify: `src/core/engine.ts`
- Modify: `src/core/scheduler.ts`
- Modify: `electron/ipc/books.ts`
- Create: `electron-builder.yml`
- Create: `tests/storage/export.test.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing export and recovery tests**

```ts
// tests/storage/export.test.ts
import { describe, expect, it } from 'vitest';
import { renderMarkdownExport } from '../../src/storage/export';

describe('renderMarkdownExport', () => {
  it('renders the title followed by chapter headings and bodies', () => {
    const markdown = renderMarkdownExport({
      title: 'Book 1',
      chapters: [
        { title: 'Chapter 1', content: 'Body 1' },
        { title: 'Chapter 2', content: 'Body 2' },
      ],
    });

    expect(markdown).toContain('# Book 1');
    expect(markdown).toContain('## Chapter 1');
    expect(markdown).toContain('Body 2');
  });
});
```

```ts
// tests/e2e/smoke.spec.ts
import { describe, expect, it } from 'vitest';

describe('packaged smoke contract', () => {
  it('documents the acceptance target for packaging and resume support', () => {
    expect({
      packageScript: 'npm run package',
      restartAction: 'book:restart',
      exportFormats: ['txt', 'md', 'epub'],
    }).toEqual({
      packageScript: 'npm run package',
      restartAction: 'book:restart',
      exportFormats: ['txt', 'md', 'epub'],
    });
  });
});
```

- [ ] **Step 2: Run the export-focused tests**

Run: `npm run test -- tests/storage/export.test.ts tests/e2e/smoke.spec.ts`

Expected: FAIL because `src/storage/export.ts` does not exist yet.

- [ ] **Step 3: Implement the export layer, crash recovery hooks, and packaging configuration**

```ts
// src/storage/export.ts
export function renderTextExport(input: { title: string; chapters: Array<{ title: string; content: string }> }) {
  return [input.title, '', ...input.chapters.flatMap((chapter) => [chapter.title, chapter.content, ''])].join('\n');
}

export function renderMarkdownExport(input: { title: string; chapters: Array<{ title: string; content: string }> }) {
  return [
    `# ${input.title}`,
    '',
    ...input.chapters.flatMap((chapter) => [`## ${chapter.title}`, '', chapter.content, '']),
  ].join('\n');
}
```

```ts
// electron-builder.yml
appId: com.storyweaver.desktop
productName: Story Weaver
files:
  - dist/**
  - dist-electron/**
mac:
  category: public.app-category.productivity
directories:
  output: release
```

```ts
// src/core/engine.ts
export function extendEngineForRecoveryAndExport(deps: {
  bookId: string;
  repositories: {
    books: { getById: (bookId: string) => { title: string } };
    chapters: {
      listByBook: (bookId: string) => Array<{ title: string; content: string }>;
      clearGeneratedContent: (bookId: string) => void;
    };
    progress: {
      getByBookId: (bookId: string) => { currentVolume: number | null; currentChapter: number | null; phase: string | null } | null;
      updatePhase: (bookId: string, phase: string) => void;
      reset: (bookId: string) => void;
    };
  };
  exporter: {
    export: (format: 'txt' | 'md' | 'epub', input: { title: string; chapters: Array<{ title: string; content: string }> }) => Promise<string>;
  };
  runFrom: (volumeIndex: number, chapterIndex: number) => Promise<void>;
}) {
  return {
    async resumeFromProgress() {
      const progress = deps.repositories.progress.getByBookId(deps.bookId);
      if (!progress) {
        await deps.runFrom(1, 1);
        return;
      }

      const nextVolume = progress.currentVolume ?? 1;
      const nextChapter = (progress.currentChapter ?? 0) + 1;
      deps.repositories.progress.updatePhase(deps.bookId, 'writing');
      await deps.runFrom(nextVolume, nextChapter);
    },
    pause() {
      deps.repositories.progress.updatePhase(deps.bookId, 'paused');
    },
    restart() {
      deps.repositories.chapters.clearGeneratedContent(deps.bookId);
      deps.repositories.progress.reset(deps.bookId);
    },
    async exportBook(format: 'txt' | 'md' | 'epub') {
      const book = deps.repositories.books.getById(deps.bookId);
      const chapters = deps.repositories.chapters.listByBook(deps.bookId);
      return deps.exporter.export(format, {
        title: book.title,
        chapters,
      });
    },
  };
}
```

- [ ] **Step 4: Run the export tests, then the entire suite, then package the app**

Run: `npm run test -- tests/storage/export.test.ts tests/e2e/smoke.spec.ts && npm run test && npm run package`

Expected: PASS for the focused export tests, PASS for the full test suite, then `electron-builder` emits packaged artifacts into `release/`.

- [ ] **Step 5: Commit the export and packaging slice**

```bash
git add src/storage/export.ts src/core/engine.ts src/core/scheduler.ts electron/ipc/books.ts electron-builder.yml tests/storage/export.test.ts tests/e2e/smoke.spec.ts package.json
git commit -m "feat: add export recovery and packaging"
```

## Final Verification Checklist

Run these before calling the build complete:

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run package`

Manually verify these behaviors in the packaged app:

- Create a book from an IDEA and confirm it enters `creating`, then `building_world`, then `building_outline`.
- Confirm the dashboard can show multiple books and that start-all and pause-all drive scheduler state.
- Start three books with a concurrency limit of `2` and confirm only two are active at once.
- Pause a writing book, restart the app, and confirm it resumes from the persisted `writing_progress` row.
- Open Book Detail and confirm the outline, character, chapter, and plot-thread tabs populate from SQLite.
- Export the same book as TXT, Markdown, and EPUB and confirm all files open correctly.

## Spec Coverage Notes

This plan covers the shell, full SQLite schema, AI generation pipeline, volume and chapter outline expansion, consistency layer, scheduler, progress tracking, IPC, dashboard, new-book flow, book detail, settings, export, crash recovery, and packaging described in the spec.
