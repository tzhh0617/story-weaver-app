# Concrete Server API Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Electron IPC and the generic `/api/invoke` command bus with concrete local server API routes while preserving existing Story Weaver behavior.

**Architecture:** Fastify owns the single long-lived runtime and exposes named route modules for books, scheduler, models, settings, events, exports, health, and static assets. The renderer uses a concrete `StoryWeaverApi` client with named methods instead of `invoke(channel, payload)`. Electron becomes a desktop shell that starts the local server, loads either Vite with an API-base query parameter or the packaged Fastify URL, and has no business preload or IPC handlers.

**Tech Stack:** TypeScript, Fastify, React, Vite, Electron, SQLite, Vitest, Testing Library.

---

## File Structure

- Create `server/routes/books.ts`: concrete book CRUD, lifecycle, chapter writing, and export routes.
- Create `server/routes/scheduler.ts`: concrete scheduler status/start/pause routes.
- Create `server/routes/models.ts`: concrete model list/save/test routes.
- Create `server/routes/settings.ts`: concrete setting list/read/write routes with live scheduler update behavior.
- Modify `server/main.ts`: register concrete routes, export a reusable `startServer()`, remove invoke route registration.
- Delete `server/routes/invoke.ts`: remove generic channel endpoint.
- Delete `server/channel-dispatch.ts`: remove generic channel dispatcher.
- Modify `server/routes/events.ts`: keep listener cleanup observable through existing `once=1` behavior and add a runtime-close regression test.
- Modify `tests/server/export.test.ts`: use concrete book and export routes.
- Create `tests/server/books-routes.test.ts`: cover concrete book APIs.
- Create `tests/server/scheduler-routes.test.ts`: cover concrete scheduler APIs.
- Create `tests/server/models-routes.test.ts`: cover concrete model APIs.
- Create `tests/server/settings-routes.test.ts`: cover concrete settings APIs.
- Modify `tests/server/events.test.ts`: assert SSE disconnect only removes listeners.
- Modify `tests/server/static.test.ts`: assert health works when static serving is enabled.
- Modify `src/shared/contracts.ts`: add concrete request/response aliases and remove channel contracts after renderer/server migration.
- Create `renderer/hooks/useStoryWeaverApi.ts`: concrete API hook.
- Modify `renderer/lib/story-weaver-http-client.ts`: named API methods, explicit base URL, no generic invoke export.
- Modify `renderer/hooks/useBooksController.ts`: consume `StoryWeaverApi` and named methods.
- Modify `renderer/hooks/useProgress.ts`: use `useStoryWeaverApi()` and `getSchedulerStatus()`.
- Modify `renderer/hooks/useBookGenerationEvents.ts`: consume `StoryWeaverApi`.
- Modify `renderer/App.tsx`: replace all `ipc.invoke(...)` calls and `ipcChannels` control flow with named methods.
- Modify renderer tests under `tests/renderer`: replace IPC mocks with concrete API mocks.
- Delete `renderer/hooks/useIpc.ts`: remove renderer IPC abstraction after call sites move.
- Delete `electron/preload.cts`: remove business preload.
- Delete `electron/ipc/books.ts`, `electron/ipc/logs.ts`, `electron/ipc/models.ts`, `electron/ipc/scheduler.ts`, `electron/ipc/settings.ts`: remove business IPC handlers.
- Modify `electron/main.ts`: start local server and load server-aware URL.
- Modify `tsconfig.node.json`: remove `.cts` include if preload is deleted; include any server startup import types needed by Electron.
- Modify `tsconfig.server.json`: remove `electron/runtime.ts` include if no longer needed by server build.
- Modify `electron-builder.yml`: package `dist-server/**`.
- Modify `package.json`: keep builds aligned and restore package smoke script if expected by tests.
- Modify `CLAUDE.md`: document concrete server API and refresh-safe runtime behavior.

---

### Task 1: Add Concrete Shared API Types

**Files:**
- Modify: `src/shared/contracts.ts`
- Test: `tests/core/ipc-contracts.test.ts`

- [x] **Step 1: Write the failing type test**

Append this test to `tests/core/ipc-contracts.test.ts`:

```ts
import type {
  BookCreateRequest,
  BookCreateResponse,
  BookExportRequest,
  BookExportResponse,
  ModelTestResponse,
  OkResponse,
  SettingValueResponse,
} from '../../src/shared/contracts';

describe('concrete server API contracts', () => {
  it('exports named request and response contracts for concrete routes', () => {
    const createRequest: BookCreateRequest = {
      idea: 'A library that writes itself.',
      targetChapters: 2,
      wordsPerChapter: 1200,
    };
    const createResponse: BookCreateResponse = { bookId: 'book-1' };
    const exportRequest: BookExportRequest = { format: 'txt' };
    const exportResponse: BookExportResponse = {
      filePath: '/tmp/story-weaver/book.txt',
      downloadUrl: '/api/exports/export-1',
    };
    const modelTest: ModelTestResponse = {
      ok: true,
      message: 'Model connection succeeded',
    };
    const settingValue: SettingValueResponse = {
      key: 'scheduler.concurrencyLimit',
      value: '2',
    };
    const ok: OkResponse = { ok: true };

    expect(createRequest.targetChapters).toBe(2);
    expect(createResponse.bookId).toBe('book-1');
    expect(exportRequest.format).toBe('txt');
    expect(exportResponse.downloadUrl).toBe('/api/exports/export-1');
    expect(modelTest.ok).toBe(true);
    expect(settingValue.value).toBe('2');
    expect(ok.ok).toBe(true);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts -t "concrete server API contracts" --reporter=dot
```

Expected: FAIL because the named concrete API types are not exported.

- [x] **Step 3: Add concrete API type aliases**

Add these exports after the existing payload type definitions in `src/shared/contracts.ts`:

```ts
export type BookCreateRequest = BookCreatePayload;

export type BookCreateResponse = {
  bookId: string;
};

export type BookExportRequest = Pick<BookExportPayload, 'format'>;

export type BookExportResponse = {
  filePath: string;
  downloadUrl: string;
};

export type ModelSaveRequest = ModelSavePayload;

export type ModelTestResponse = {
  ok: boolean;
  message: string;
};

export type SettingValueResponse = {
  key: string;
  value: string | null;
};

export type OkResponse = {
  ok: true;
};
```

- [x] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts -t "concrete server API contracts" --reporter=dot
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
git add src/shared/contracts.ts tests/core/ipc-contracts.test.ts
git commit -m "feat: add concrete server api contracts"
```

---

### Task 2: Add Concrete Book Routes

**Files:**
- Create: `server/routes/books.ts`
- Modify: `server/main.ts`
- Create: `tests/server/books-routes.test.ts`
- Modify: `tests/server/export.test.ts`

- [x] **Step 1: Write failing book route tests**

Create `tests/server/books-routes.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-books-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server book routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('creates, lists, reads, and deletes a book through concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const create = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: {
          idea: 'A city that stores memory in rain.',
          targetChapters: 1,
          wordsPerChapter: 1200,
        },
      });

      expect(create.statusCode).toBe(200);
      expect(create.json()).toEqual({ bookId: expect.any(String) });

      const bookId = create.json().bookId as string;
      const list = await server.inject({ method: 'GET', url: '/api/books' });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual([
        expect.objectContaining({ id: bookId, idea: 'A city that stores memory in rain.' }),
      ]);

      const detail = await server.inject({
        method: 'GET',
        url: `/api/books/${bookId}`,
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json()).toEqual(
        expect.objectContaining({
          book: expect.objectContaining({ id: bookId }),
        })
      );

      const deletion = await server.inject({
        method: 'DELETE',
        url: `/api/books/${bookId}`,
      });
      expect(deletion.statusCode).toBe(200);
      expect(deletion.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });

  it('exposes lifecycle and chapter writing actions as concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const create = await server.inject({
        method: 'POST',
        url: '/api/books',
        payload: {
          idea: 'A courier delivers chapters to the future.',
          targetChapters: 1,
          wordsPerChapter: 800,
        },
      });
      const bookId = create.json().bookId as string;

      const start = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/start`,
      });
      expect(start.statusCode).toBe(200);
      expect(start.json()).toEqual({ ok: true });

      const pause = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/pause`,
      });
      expect(pause.statusCode).toBe(200);
      expect(pause.json()).toEqual({ ok: true });

      const resume = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/resume`,
      });
      expect(resume.statusCode).toBe(200);
      expect(resume.json()).toEqual({ ok: true });

      const restart = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/restart`,
      });
      expect(restart.statusCode).toBe(200);
      expect(restart.json()).toEqual({ ok: true });

      const writeNext = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/chapters/write-next`,
      });
      expect(writeNext.statusCode).toBe(200);

      const writeAll = await server.inject({
        method: 'POST',
        url: `/api/books/${bookId}/chapters/write-all`,
      });
      expect(writeAll.statusCode).toBe(200);
      expect(writeAll.json()).toEqual(
        expect.objectContaining({
          completedChapters: expect.any(Number),
          status: expect.stringMatching(/completed|paused|deleted/),
        })
      );
    } finally {
      await server.close();
    }
  });
});
```

- [x] **Step 2: Update export route test to expect concrete export route**

In `tests/server/export.test.ts`, replace the `/api/invoke` create/export requests with:

```ts
const createResponse = await server.inject({
  method: 'POST',
  url: '/api/books',
  payload: {
    idea: 'A city remembers every exported chapter.',
    targetChapters: 1,
    wordsPerChapter: 1200,
  },
});
const bookId = createResponse.json().bookId as string;

const exportResponse = await server.inject({
  method: 'POST',
  url: `/api/books/${bookId}/exports`,
  payload: { format: 'txt' },
});

expect(exportResponse.statusCode).toBe(200);
expect(exportResponse.json()).toMatchObject({
  filePath: expect.stringMatching(/\.txt$/),
  downloadUrl: expect.stringMatching(/^\/api\/exports\//),
});

const downloadResponse = await server.inject({
  method: 'GET',
  url: exportResponse.json().downloadUrl,
});
```

- [x] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/server/books-routes.test.ts tests/server/export.test.ts --reporter=dot
```

Expected: FAIL with 404 responses for `/api/books`.

- [x] **Step 4: Implement book routes**

Create `server/routes/books.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type {
  BookCreatePayload,
  BookExportFormat,
  BookExportResponse,
} from '../../src/shared/contracts.js';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';
import type { createExportRegistry } from '../export-registry.js';

type ExportRegistry = ReturnType<typeof createExportRegistry>;

function isBookCreatePayload(value: unknown): value is BookCreatePayload {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as BookCreatePayload).idea === 'string' &&
    Number.isInteger((value as BookCreatePayload).targetChapters) &&
    Number.isInteger((value as BookCreatePayload).wordsPerChapter)
  );
}

function isExportFormat(value: unknown): value is BookExportFormat {
  return value === 'txt' || value === 'markdown' || value === 'epub';
}

export async function registerBookRoutes(
  app: FastifyInstance,
  services: RuntimeServices,
  options: { exportsRegistry: ExportRegistry }
) {
  app.get('/api/books', async () => services.bookService.listBooks());

  app.post('/api/books', async (request, reply) => {
    if (!isBookCreatePayload(request.body)) {
      return reply.status(400).send({ error: 'Invalid book create payload' });
    }

    const bookId = await services.bookService.createBook(request.body);
    return { bookId };
  });

  app.get<{ Params: { bookId: string } }>(
    '/api/books/:bookId',
    async (request) => services.bookService.getBookDetail(request.params.bookId)
  );

  app.delete<{ Params: { bookId: string } }>(
    '/api/books/:bookId',
    async (request) => {
      await services.deleteBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/start',
    async (request) => {
      await services.startBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/pause',
    async (request) => {
      services.pauseBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/resume',
    async (request) => {
      await services.resumeBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/restart',
    async (request) => {
      await services.restartBook(request.params.bookId);
      return { ok: true };
    }
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/chapters/write-next',
    async (request) => services.writeNextChapter(request.params.bookId)
  );

  app.post<{ Params: { bookId: string } }>(
    '/api/books/:bookId/chapters/write-all',
    async (request) => services.writeRemainingChapters(request.params.bookId)
  );

  app.post<{ Params: { bookId: string }; Body: { format?: unknown } }>(
    '/api/books/:bookId/exports',
    async (request, reply): Promise<BookExportResponse | unknown> => {
      if (!isExportFormat(request.body?.format)) {
        return reply.status(400).send({ error: 'Invalid export format' });
      }

      const filePath = await services.exportBook(
        request.params.bookId,
        request.body.format
      );
      return options.exportsRegistry.register(filePath);
    }
  );
}
```

- [x] **Step 5: Register book routes**

Modify `server/main.ts` imports and route registration:

```ts
import { registerBookRoutes } from './routes/books.js';
```

Replace the invoke registration line with:

```ts
await registerBookRoutes(app, services, { exportsRegistry });
```

- [x] **Step 6: Run tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/server/books-routes.test.ts tests/server/export.test.ts --reporter=dot
```

Expected: PASS.

- [x] **Step 7: Commit**

Run:

```bash
git add server/main.ts server/routes/books.ts tests/server/books-routes.test.ts tests/server/export.test.ts
git commit -m "feat: add concrete book server routes"
```

---

### Task 3: Add Scheduler, Models, And Settings Routes

**Files:**
- Create: `server/routes/scheduler.ts`
- Create: `server/routes/models.ts`
- Create: `server/routes/settings.ts`
- Modify: `server/main.ts`
- Create: `tests/server/scheduler-routes.test.ts`
- Create: `tests/server/models-routes.test.ts`
- Create: `tests/server/settings-routes.test.ts`

- [x] **Step 1: Write failing scheduler route tests**

Create `tests/server/scheduler-routes.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-scheduler-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server scheduler routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns scheduler status and accepts start and pause commands', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const status = await server.inject({
        method: 'GET',
        url: '/api/scheduler/status',
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toEqual(
        expect.objectContaining({
          runningBookIds: [],
          queuedBookIds: [],
          pausedBookIds: [],
        })
      );

      const start = await server.inject({
        method: 'POST',
        url: '/api/scheduler/start',
      });
      expect(start.statusCode).toBe(200);
      expect(start.json()).toEqual({ ok: true });

      const pause = await server.inject({
        method: 'POST',
        url: '/api/scheduler/pause',
      });
      expect(pause.statusCode).toBe(200);
      expect(pause.json()).toEqual({ ok: true });
    } finally {
      await server.close();
    }
  });
});
```

- [x] **Step 2: Write failing model route tests**

Create `tests/server/models-routes.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-models-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server model routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('lists and saves model configs through concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const input = {
        id: 'model-1',
        provider: 'openai',
        modelName: 'gpt-test',
        apiKey: 'test-key',
        baseUrl: 'https://example.test/v1',
        config: {},
      };

      const save = await server.inject({
        method: 'PUT',
        url: '/api/models/model-1',
        payload: input,
      });
      expect(save.statusCode).toBe(200);
      expect(save.json()).toEqual({ ok: true });

      const list = await server.inject({
        method: 'GET',
        url: '/api/models',
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual([input]);

      const mismatch = await server.inject({
        method: 'PUT',
        url: '/api/models/model-2',
        payload: input,
      });
      expect(mismatch.statusCode).toBe(400);
      expect(mismatch.json()).toEqual({ error: 'Model id does not match route' });
    } finally {
      await server.close();
    }
  });
});
```

- [x] **Step 3: Write failing settings route tests**

Create `tests/server/settings-routes.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../../src/core/chapter-review';
import { buildServer } from '../../server/main';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-settings-api-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server settings routes', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('lists, reads, and writes settings through concrete routes', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const save = await server.inject({
        method: 'PUT',
        url: '/api/settings/scheduler.concurrencyLimit',
        payload: { value: '2' },
      });
      expect(save.statusCode).toBe(200);
      expect(save.json()).toEqual({ ok: true });

      const read = await server.inject({
        method: 'GET',
        url: '/api/settings/scheduler.concurrencyLimit',
      });
      expect(read.statusCode).toBe(200);
      expect(read.json()).toEqual({
        key: 'scheduler.concurrencyLimit',
        value: '2',
      });

      const list = await server.inject({
        method: 'GET',
        url: '/api/settings',
      });
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual(
        expect.arrayContaining([
          { key: 'scheduler.concurrencyLimit', value: '2' },
        ])
      );
    } finally {
      await server.close();
    }
  });

  it('keeps existing settings validation behavior', async () => {
    const server = await buildServer({ rootDir: makeRootDir() });

    try {
      const invalidConcurrency = await server.inject({
        method: 'PUT',
        url: '/api/settings/scheduler.concurrencyLimit',
        payload: { value: '0' },
      });
      expect(invalidConcurrency.statusCode).toBe(400);
      expect(invalidConcurrency.json()).toEqual({
        error: 'Concurrency limit must be a positive integer',
      });

      const invalidReview = await server.inject({
        method: 'PUT',
        url: `/api/settings/${encodeURIComponent(SHORT_CHAPTER_REVIEW_ENABLED_KEY)}`,
        payload: { value: 'sometimes' },
      });
      expect(invalidReview.statusCode).toBe(400);
      expect(invalidReview.json()).toEqual({
        error: 'Short chapter review setting must be true or false',
      });
    } finally {
      await server.close();
    }
  });
});
```

- [x] **Step 4: Run tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/server/scheduler-routes.test.ts tests/server/models-routes.test.ts tests/server/settings-routes.test.ts --reporter=dot
```

Expected: FAIL with 404 responses for scheduler, models, and settings routes.

- [x] **Step 5: Implement scheduler routes**

Create `server/routes/scheduler.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';

export async function registerSchedulerRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/scheduler/status', async () => services.getSchedulerStatus());

  app.post('/api/scheduler/start', async () => {
    await services.startAllBooks();
    return { ok: true };
  });

  app.post('/api/scheduler/pause', async () => {
    await services.pauseAllBooks();
    return { ok: true };
  });
}
```

- [x] **Step 6: Implement model routes**

Create `server/routes/models.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type { ModelSavePayload } from '../../src/shared/contracts.js';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';

function isModelSavePayload(value: unknown): value is ModelSavePayload {
  const candidate = value as Partial<ModelSavePayload> | null;
  return (
    Boolean(candidate) &&
    typeof candidate === 'object' &&
    typeof candidate.id === 'string' &&
    (candidate.provider === 'openai' || candidate.provider === 'anthropic') &&
    typeof candidate.modelName === 'string' &&
    typeof candidate.apiKey === 'string' &&
    typeof candidate.baseUrl === 'string' &&
    Boolean(candidate.config) &&
    typeof candidate.config === 'object'
  );
}

export async function registerModelRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/models', async () => services.modelConfigs.list());

  app.put<{ Params: { modelId: string } }>(
    '/api/models/:modelId',
    async (request, reply) => {
      if (!isModelSavePayload(request.body)) {
        return reply.status(400).send({ error: 'Invalid model payload' });
      }

      if (request.body.id !== request.params.modelId) {
        return reply.status(400).send({ error: 'Model id does not match route' });
      }

      services.modelConfigs.save(request.body);
      return { ok: true };
    }
  );

  app.post<{ Params: { modelId: string } }>(
    '/api/models/:modelId/test',
    async (request) => services.testModel(request.params.modelId)
  );
}
```

- [x] **Step 7: Implement settings routes**

Create `server/routes/settings.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { SHORT_CHAPTER_REVIEW_ENABLED_KEY } from '../../src/core/chapter-review.js';
import type { RuntimeServices } from '../../src/runtime/create-runtime-services.js';

function readValue(body: unknown) {
  if (
    body &&
    typeof body === 'object' &&
    'value' in body &&
    typeof body.value === 'string'
  ) {
    return body.value;
  }

  return null;
}

function validateSetting(key: string, value: string) {
  if (key === 'scheduler.concurrencyLimit') {
    const trimmed = value.trim();
    if (trimmed && (!/^\d+$/.test(trimmed) || Number(trimmed) < 1)) {
      return 'Concurrency limit must be a positive integer';
    }
  }

  if (
    key === SHORT_CHAPTER_REVIEW_ENABLED_KEY &&
    !['true', 'false'].includes(value)
  ) {
    return 'Short chapter review setting must be true or false';
  }

  return null;
}

export async function registerSettingsRoutes(
  app: FastifyInstance,
  services: RuntimeServices
) {
  app.get('/api/settings', async () => services.settings.list());

  app.get<{ Params: { key: string } }>(
    '/api/settings/:key',
    async (request) => ({
      key: request.params.key,
      value: services.settings.get(request.params.key),
    })
  );

  app.put<{ Params: { key: string } }>(
    '/api/settings/:key',
    async (request, reply) => {
      const value = readValue(request.body);
      if (value === null) {
        return reply.status(400).send({ error: 'Invalid setting payload' });
      }

      const validationError = validateSetting(request.params.key, value);
      if (validationError) {
        return reply.status(400).send({ error: validationError });
      }

      services.settings.set(request.params.key, value);

      if (request.params.key === 'scheduler.concurrencyLimit') {
        const trimmed = value.trim();
        services.setSchedulerConcurrencyLimit(trimmed ? Number(trimmed) : null);
      }

      return { ok: true };
    }
  );
}
```

- [x] **Step 8: Register scheduler, model, and settings routes**

Modify `server/main.ts` imports and registrations:

```ts
import { registerModelRoutes } from './routes/models.js';
import { registerSchedulerRoutes } from './routes/scheduler.js';
import { registerSettingsRoutes } from './routes/settings.js';
```

Register them after book routes and before event routes:

```ts
await registerSchedulerRoutes(app, services);
await registerModelRoutes(app, services);
await registerSettingsRoutes(app, services);
```

- [x] **Step 9: Run tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/server/scheduler-routes.test.ts tests/server/models-routes.test.ts tests/server/settings-routes.test.ts --reporter=dot
```

Expected: PASS.

- [x] **Step 10: Commit**

Run:

```bash
git add server/main.ts server/routes/scheduler.ts server/routes/models.ts server/routes/settings.ts tests/server/scheduler-routes.test.ts tests/server/models-routes.test.ts tests/server/settings-routes.test.ts
git commit -m "feat: add concrete runtime server routes"
```

---

### Task 4: Replace Renderer Invoke Transport With Concrete API Client

**Files:**
- Modify: `renderer/lib/story-weaver-http-client.ts`
- Create: `renderer/hooks/useStoryWeaverApi.ts`
- Delete: `renderer/hooks/useIpc.ts`
- Modify: `renderer/hooks/useBooksController.ts`
- Modify: `renderer/hooks/useProgress.ts`
- Modify: `renderer/hooks/useBookGenerationEvents.ts`
- Modify: `tests/renderer/http-transport.test.tsx`
- Modify: `tests/renderer/ipc-types.test.ts`

- [x] **Step 1: Rewrite HTTP transport tests for concrete methods**

Replace `tests/renderer/http-transport.test.tsx` with:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createHttpStoryWeaverClient } from '../../renderer/lib/story-weaver-http-client';
import { useStoryWeaverApi } from '../../renderer/hooks/useStoryWeaverApi';

function Probe() {
  const api = useStoryWeaverApi();

  void api.listBooks().then((books) => {
    document.body.dataset.bookCount = String(books.length);
  });

  return <div>available</div>;
}

function ExportProbe() {
  const api = useStoryWeaverApi();

  void api.exportBook('book-1', 'txt').then((message) => {
    document.body.dataset.exportMessage = message;
  });

  return <div>exporting</div>;
}

describe('browser HTTP transport', () => {
  it('uses concrete book routes even when the old Electron bridge exists', async () => {
    window.storyWeaver = {
      invoke: vi.fn(() => {
        throw new Error('old bridge should not be called');
      }),
      onProgress: vi.fn(),
      onBookGeneration: vi.fn(),
      onExecutionLog: vi.fn(),
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<Probe />);

    expect(screen.getByText('available')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.body.dataset.bookCount).toBe('0');
    });
    expect(fetchMock).toHaveBeenCalledWith(new URL('/api/books', window.location.href), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(window.storyWeaver.invoke).not.toHaveBeenCalled();
  });

  it('formats browser export responses with a download URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            filePath: '/tmp/story-weaver/exports/Book.txt',
            downloadUrl: '/api/exports/export-1',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    render(<ExportProbe />);

    await waitFor(() => {
      expect(document.body.dataset.exportMessage).toBe(
        '/tmp/story-weaver/exports/Book.txt（下载：/api/exports/export-1）'
      );
    });
  });

  it('uses an explicit API base URL for fetch and SSE endpoints', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const api = createHttpStoryWeaverClient({
      baseUrl: 'http://127.0.0.1:5174',
    });

    await api.listBooks();

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/api/books', 'http://127.0.0.1:5174'),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/renderer/http-transport.test.tsx --reporter=dot
```

Expected: FAIL because `useStoryWeaverApi` does not exist and the HTTP client still exports invoke-style behavior.

- [x] **Step 3: Implement concrete HTTP client**

Replace `renderer/lib/story-weaver-http-client.ts` with:

```ts
import type {
  BookCreatePayload,
  BookDetail,
  BookExportFormat,
  BookListItem,
  ModelSavePayload,
  SchedulerStatus,
} from '../../src/shared/contracts';

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
  exportBook: (bookId: string, format: BookExportFormat) => Promise<string>;
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

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function formatExportResponse(data: { filePath: string; downloadUrl: string }) {
  return `${data.filePath}（下载：${data.downloadUrl}）`;
}

function getQueryBaseUrl() {
  const value = new URL(window.location.href).searchParams.get('storyWeaverApi');
  return value || undefined;
}

function resolveBaseUrl(baseUrl?: string) {
  return baseUrl ?? getQueryBaseUrl() ?? window.location.origin;
}

async function requestJson<T>(
  baseUrl: string,
  method: HttpMethod,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `HTTP request failed with ${response.status}`;
    throw new Error(error);
  }

  return data as T;
}

function subscribeSse(
  baseUrl: string,
  endpoint: string,
  listener: (payload: unknown) => void
) {
  if (typeof EventSource === 'undefined') {
    return () => undefined;
  }

  const events = new EventSource(new URL(endpoint, baseUrl));
  events.onmessage = (event) => {
    listener(JSON.parse(event.data) as unknown);
  };

  return () => {
    events.close();
  };
}

export function createHttpStoryWeaverClient(options: { baseUrl?: string } = {}): StoryWeaverApi {
  const baseUrl = resolveBaseUrl(options.baseUrl);

  return {
    listBooks: () => requestJson(baseUrl, 'GET', '/api/books'),
    createBook: async (payload) => {
      const response = await requestJson<{ bookId: string }>(
        baseUrl,
        'POST',
        '/api/books',
        payload
      );
      return response.bookId;
    },
    getBookDetail: (bookId) =>
      requestJson(baseUrl, 'GET', `/api/books/${encodeURIComponent(bookId)}`),
    deleteBook: async (bookId) => {
      await requestJson(baseUrl, 'DELETE', `/api/books/${encodeURIComponent(bookId)}`);
    },
    startBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/start`);
    },
    pauseBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/pause`);
    },
    resumeBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/resume`);
    },
    restartBook: async (bookId) => {
      await requestJson(baseUrl, 'POST', `/api/books/${encodeURIComponent(bookId)}/restart`);
    },
    writeNextChapter: (bookId) =>
      requestJson(
        baseUrl,
        'POST',
        `/api/books/${encodeURIComponent(bookId)}/chapters/write-next`
      ),
    writeAllChapters: (bookId) =>
      requestJson(
        baseUrl,
        'POST',
        `/api/books/${encodeURIComponent(bookId)}/chapters/write-all`
      ),
    exportBook: async (bookId, format) => {
      const response = await requestJson<{ filePath: string; downloadUrl: string }>(
        baseUrl,
        'POST',
        `/api/books/${encodeURIComponent(bookId)}/exports`,
        { format }
      );
      return formatExportResponse(response);
    },
    getSchedulerStatus: () => requestJson(baseUrl, 'GET', '/api/scheduler/status'),
    startScheduler: async () => {
      await requestJson(baseUrl, 'POST', '/api/scheduler/start');
    },
    pauseScheduler: async () => {
      await requestJson(baseUrl, 'POST', '/api/scheduler/pause');
    },
    listModels: () => requestJson(baseUrl, 'GET', '/api/models'),
    saveModel: async (input) => {
      await requestJson(baseUrl, 'PUT', `/api/models/${encodeURIComponent(input.id)}`, input);
    },
    testModel: (modelId) =>
      requestJson(baseUrl, 'POST', `/api/models/${encodeURIComponent(modelId)}/test`),
    listSettings: () => requestJson(baseUrl, 'GET', '/api/settings'),
    getSetting: async (key) => {
      const response = await requestJson<{ key: string; value: string | null }>(
        baseUrl,
        'GET',
        `/api/settings/${encodeURIComponent(key)}`
      );
      return response.value;
    },
    setSetting: async (key, value) => {
      await requestJson(baseUrl, 'PUT', `/api/settings/${encodeURIComponent(key)}`, {
        value,
      });
    },
    onProgress: (listener) => subscribeSse(baseUrl, '/api/events/scheduler', listener),
    onBookGeneration: (listener) =>
      subscribeSse(baseUrl, '/api/events/book-generation', listener),
    onExecutionLog: (listener) =>
      subscribeSse(baseUrl, '/api/events/execution-logs', listener),
  };
}
```

- [x] **Step 4: Add concrete API hook**

Create `renderer/hooks/useStoryWeaverApi.ts`:

```ts
import { useMemo } from 'react';
import {
  createHttpStoryWeaverClient,
  type StoryWeaverApi,
} from '../lib/story-weaver-http-client';

export type { StoryWeaverApi };

export function useStoryWeaverApi(): StoryWeaverApi {
  return useMemo(() => createHttpStoryWeaverClient(), []);
}
```

- [x] **Step 5: Update hooks to use concrete API type**

Modify `renderer/hooks/useBooksController.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookListItem } from '../../src/shared/contracts';
import type { BookDetailData } from '../types/book-detail';
import type { StoryWeaverApi } from './useStoryWeaverApi';

function normalizeBookListItem(book: BookListItem): BookListItem {
  return {
    ...book,
    progress: book.progress ?? 0,
    completedChapters: book.completedChapters ?? 0,
    totalChapters: book.totalChapters ?? 0,
  };
}

export function useBooksController(api: StoryWeaverApi) {
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const selectedBookIdRef = useRef<string | null>(null);
  const [selectedBookDetail, setSelectedBookDetail] =
    useState<BookDetailData | null>(null);

  const loadBooks = useCallback(async () => {
    const nextBooks = await api.listBooks();
    const safeBooks = Array.isArray(nextBooks) ? nextBooks : [];
    setBooks(safeBooks.map(normalizeBookListItem));
  }, [api]);

  const loadBookDetail = useCallback(async (
    bookId: string,
    options?: { openView?: boolean; preserveExistingOnMissing?: boolean }
  ) => {
    setSelectedBookId(bookId);
    const detail = await api.getBookDetail(bookId);
    setSelectedBookDetail((currentDetail) => {
      if (detail) {
        return detail;
      }

      if (
        options?.preserveExistingOnMissing &&
        currentDetail?.book.id === bookId
      ) {
        return currentDetail;
      }

      return null;
    });

    return options?.openView ?? true;
  }, [api]);

  const clearSelectedBook = useCallback(() => {
    setSelectedBookId(null);
    setSelectedBookDetail(null);
  }, []);

  useEffect(() => {
    selectedBookIdRef.current = selectedBookId;
  }, [selectedBookId]);

  return {
    books,
    setBooks,
    selectedBookId,
    selectedBookIdRef,
    setSelectedBookId,
    selectedBookDetail,
    setSelectedBookDetail,
    loadBooks,
    loadBookDetail,
    clearSelectedBook,
  };
}
```

Modify `renderer/hooks/useProgress.ts`:

```ts
import { useEffect, useState } from 'react';
import type { SchedulerStatus } from '../../src/shared/contracts';
import { useStoryWeaverApi } from './useStoryWeaverApi';

const emptyStatus: SchedulerStatus = {
  runningBookIds: [],
  queuedBookIds: [],
  pausedBookIds: [],
  concurrencyLimit: null,
};

export function useProgress() {
  const api = useStoryWeaverApi();
  const [status, setStatus] = useState<SchedulerStatus>(emptyStatus);

  useEffect(() => {
    let isMounted = true;

    void api.getSchedulerStatus().then((payload) => {
      if (isMounted && payload) {
        setStatus(payload);
      }
    });

    const unsubscribe = api.onProgress((payload) => {
      setStatus(payload as SchedulerStatus);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [api]);

  return status;
}
```

- [x] **Step 6: Replace IPC type test with concrete API type test**

Rename `tests/renderer/ipc-types.test.ts` to `tests/renderer/api-types.test.ts` and replace contents with:

```ts
import type { StoryWeaverApi } from '../../renderer/hooks/useStoryWeaverApi';

function acceptsApi(api: StoryWeaverApi) {
  void api.listBooks().then((books) => books.at(0)?.id);
  void api.getBookDetail('book-1').then((detail) => detail?.book.id);
  void api.exportBook('book-1', 'txt').then((message) => message.length);
  void api.startScheduler();
  void api.setSetting('scheduler.concurrencyLimit', '2');
}

describe('StoryWeaverApi type surface', () => {
  it('exposes concrete methods instead of generic invoke', () => {
    expect(typeof acceptsApi).toBe('function');
  });
});
```

- [x] **Step 7: Run renderer transport tests to verify pass**

Run:

```bash
pnpm exec vitest run tests/renderer/http-transport.test.tsx tests/renderer/api-types.test.ts --reporter=dot
```

Expected: PASS.

- [x] **Step 8: Commit**

Run:

```bash
git add renderer/lib/story-weaver-http-client.ts renderer/hooks/useStoryWeaverApi.ts renderer/hooks/useBooksController.ts renderer/hooks/useProgress.ts tests/renderer/http-transport.test.tsx tests/renderer/api-types.test.ts
git rm renderer/hooks/useIpc.ts tests/renderer/ipc-types.test.ts
git commit -m "feat: add concrete renderer api client"
```

---

### Task 5: Migrate App Shell From Invoke Calls To Named Methods

**Files:**
- Modify: `renderer/App.tsx`
- Modify: `renderer/hooks/useBookGenerationEvents.ts`
- Modify: `tests/renderer/app-shell.test.tsx`
- Modify: `tests/renderer/renderer-entry.test.tsx`

- [x] **Step 1: Write failing app-shell expectation for concrete API**

In `tests/renderer/app-shell.test.tsx`, change the shared mock helper so it returns concrete methods instead of `invoke`. Use this object as the baseline:

```ts
function installApiMock(overrides: Partial<StoryWeaverApi> = {}) {
  const listeners = {
    progress: [] as Array<(payload: unknown) => void>,
    generation: [] as Array<(payload: unknown) => void>,
    logs: [] as Array<(payload: unknown) => void>,
  };

  const api: StoryWeaverApi = {
    listBooks: vi.fn(async () => []),
    createBook: vi.fn(async () => 'book-1'),
    getBookDetail: vi.fn(async () => null),
    deleteBook: vi.fn(async () => undefined),
    startBook: vi.fn(async () => undefined),
    pauseBook: vi.fn(async () => undefined),
    resumeBook: vi.fn(async () => undefined),
    restartBook: vi.fn(async () => undefined),
    writeNextChapter: vi.fn(async () => undefined),
    writeAllChapters: vi.fn(async () => ({
      completedChapters: 1,
      status: 'completed',
    })),
    exportBook: vi.fn(async () => '/tmp/story-weaver/book.txt'),
    getSchedulerStatus: vi.fn(async () => ({
      runningBookIds: [],
      queuedBookIds: [],
      pausedBookIds: [],
      concurrencyLimit: null,
    })),
    startScheduler: vi.fn(async () => undefined),
    pauseScheduler: vi.fn(async () => undefined),
    listModels: vi.fn(async () => []),
    saveModel: vi.fn(async () => undefined),
    testModel: vi.fn(async () => ({ ok: true, message: 'ok' })),
    listSettings: vi.fn(async () => []),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => undefined),
    onProgress: vi.fn((listener) => {
      listeners.progress.push(listener);
      return () => undefined;
    }),
    onBookGeneration: vi.fn((listener) => {
      listeners.generation.push(listener);
      return () => undefined;
    }),
    onExecutionLog: vi.fn((listener) => {
      listeners.logs.push(listener);
      return () => undefined;
    }),
    ...overrides,
  };

  vi.mocked(useStoryWeaverApi).mockReturnValue(api);

  return {
    api,
    emitExecutionLog: (payload: unknown) => {
      for (const listener of listeners.logs) {
        listener(payload);
      }
    },
    emitBookGeneration: (payload: unknown) => {
      for (const listener of listeners.generation) {
        listener(payload);
      }
    },
  };
}
```

Also replace a representative old assertion:

```ts
expect(api.getBookDetail).not.toHaveBeenCalledWith('book-1');
```

- [x] **Step 2: Run app shell tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx --reporter=dot
```

Expected: FAIL because `App.tsx` still imports `useIpc`, `ipcChannels`, and calls `invoke`.

- [x] **Step 3: Update `useBookGenerationEvents` to use concrete API**

Modify the type import and parameter name in `renderer/hooks/useBookGenerationEvents.ts`:

```ts
import type { StoryWeaverApi } from './useStoryWeaverApi';
```

Replace the input field and destructuring:

```ts
api: StoryWeaverApi;
```

```ts
const {
  api,
  selectedBookId,
  selectedBookIdRef,
  setSelectedBookDetail,
  loadBookDetail,
} = input;
```

Replace the subscription and dependency entry:

```ts
const unsubscribe = api.onBookGeneration((payload) => {
```

```ts
}, [api, loadBookDetail, selectedBookId, selectedBookIdRef, setSelectedBookDetail]);
```

- [x] **Step 4: Update `App.tsx` imports and top-level API variable**

In `renderer/App.tsx`, replace IPC imports:

```ts
import { useStoryWeaverApi } from './hooks/useStoryWeaverApi';
```

Remove:

```ts
import { ipcChannels } from '../src/shared/contracts';
import { useIpc } from './hooks/useIpc';
```

Inside `App`, replace:

```ts
const ipc = useIpc();
```

with:

```ts
const api = useStoryWeaverApi();
```

Then pass `api` into hooks:

```ts
} = useBooksController(api);

useBookGenerationEvents({
  api,
  selectedBookIdRef,
  setSelectedBookDetail,
  loadBookDetail,
});
```

- [x] **Step 5: Replace direct invoke calls in `App.tsx`**

Use this mapping in `renderer/App.tsx`:

```ts
const nextConfigs = await api.listModels();
const nextValue = await api.getSetting(SHORT_CHAPTER_REVIEW_ENABLED_KEY);
await api.startScheduler();
await api.pauseScheduler();
await api.resumeBook(selectedBookId);
await api.restartBook(selectedBookId);
await api.pauseBook(selectedBookId);
const filePath = await api.exportBook(selectedBookId, 'txt');
await api.deleteBook(selectedBookId);
const bookId = await api.createBook(input);
await api.startBook(bookId);
await api.saveModel(input);
const result = await api.testModel(input.id);
await api.setSetting('scheduler.concurrencyLimit', value);
await api.setSetting(SHORT_CHAPTER_REVIEW_ENABLED_KEY, value);
```

Replace the generic action handler type with:

```ts
type BookAction = {
  label: string;
  run: (bookId: string) => Promise<void>;
};
```

Use action entries like:

```ts
{
  label: '继续',
  run: (bookId) => api.resumeBook(bookId),
}
```

- [x] **Step 6: Run app shell tests to verify pass**

Run:

```bash
pnpm exec vitest run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx --reporter=dot
```

Expected: PASS after test mocks are updated to concrete API methods.

- [x] **Step 7: Search for remaining renderer command bus usage**

Run:

```bash
rg -n "useIpc|ipc\\.invoke|ipcChannels|window\\.storyWeaver|invoke\\(" renderer tests/renderer -S
```

Expected: no matches in renderer app code. Test files may contain only comments describing old behavior; remove those comments if they keep the match noisy.

- [x] **Step 8: Commit**

Run:

```bash
git add renderer/App.tsx renderer/hooks/useBookGenerationEvents.ts tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx
git commit -m "feat: migrate renderer to concrete api methods"
```

---

### Task 6: Make Electron A Server-Backed Shell

**Files:**
- Modify: `server/main.ts`
- Modify: `electron/main.ts`
- Delete: `electron/preload.cts`
- Delete: `electron/ipc/books.ts`
- Delete: `electron/ipc/logs.ts`
- Delete: `electron/ipc/models.ts`
- Delete: `electron/ipc/scheduler.ts`
- Delete: `electron/ipc/settings.ts`
- Modify: `tsconfig.node.json`
- Modify: `electron-builder.yml`
- Modify: `tests/core/dev-runtime-config.test.ts`

- [x] **Step 1: Write failing Electron/server config tests**

In `tests/core/dev-runtime-config.test.ts`, replace preload whitelist tests with:

```ts
it('does not register Electron business IPC handlers', () => {
  expect(electronMainSource).not.toContain('registerBookHandlers');
  expect(electronMainSource).not.toContain('registerSchedulerHandlers');
  expect(electronMainSource).not.toContain('registerModelHandlers');
  expect(electronMainSource).not.toContain('registerSettingsHandlers');
  expect(electronMainSource).not.toContain('registerLogHandlers');
  expect(electronMainSource).not.toContain('preload:');
});

it('loads the renderer through a local server URL', () => {
  expect(electronMainSource).toContain('startServer');
  expect(electronMainSource).toContain('storyWeaverApi');
  expect(electronMainSource).toContain('mainWindow.loadURL');
});

it('packages compiled server files with the Electron app', () => {
  expect(electronBuilderConfigSource).toContain('dist-server/**');
});

it('removes obsolete command bus source files', () => {
  expect(fs.existsSync(path.resolve(__dirname, '../../server/routes/invoke.ts'))).toBe(false);
  expect(fs.existsSync(path.resolve(__dirname, '../../server/channel-dispatch.ts'))).toBe(false);
  expect(fs.existsSync(path.resolve(__dirname, '../../electron/preload.cts'))).toBe(false);
});
```

- [x] **Step 2: Run config tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/core/dev-runtime-config.test.ts --reporter=dot
```

Expected: FAIL because Electron still imports/registers IPC, preload exists, and `dist-server/**` is not packaged.

- [x] **Step 3: Export reusable server starter**

In `server/main.ts`, add:

```ts
export async function startServer(options?: {
  rootDir?: string;
  staticDir?: string;
  host?: string;
  port?: number;
}) {
  const config = resolveServerConfig();
  const host = options?.host ?? config.host;
  const port = options?.port ?? config.port;
  const app = await buildServer({
    rootDir: options?.rootDir ?? config.rootDir,
    staticDir: options?.staticDir ?? config.staticDir,
  });

  await app.listen({ host, port });

  return {
    app,
    url: `http://${host}:${port}`,
  };
}
```

Change `main()` to:

```ts
async function main() {
  await startServer();
}
```

- [x] **Step 4: Replace Electron main with server-backed loading**

Modify `electron/main.ts` to remove all IPC imports and use:

```ts
import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
import { startServer } from '../server/main.js';

let server: Awaited<ReturnType<typeof startServer>> | null = null;

function appendApiBase(url: string, apiBase: string) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set('storyWeaverApi', apiBase);
  return nextUrl.toString();
}

async function ensureServer() {
  if (!server) {
    server = await startServer();
  }

  return server;
}

async function createWindow() {
  const runningServer = await ensureServer();
  const appIcon = nativeImage.createFromPath(
    path.join(app.getAppPath(), 'build/icon.png')
  );

  if (process.platform === 'darwin' && app.dock && !appIcon.isEmpty()) {
    app.dock.setIcon(appIcon);
  }

  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    title: 'Story Weaver',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 13 },
    backgroundColor: '#efe6d5',
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(
      appendApiBase(process.env.VITE_DEV_SERVER_URL, runningServer.url)
    );
    return;
  }

  await mainWindow.loadURL(runningServer.url);
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('before-quit', async () => {
  if (server) {
    await server.app.close();
    server = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

- [x] **Step 5: Delete Electron IPC and preload files**

Run:

```bash
git rm electron/preload.cts electron/ipc/books.ts electron/ipc/logs.ts electron/ipc/models.ts electron/ipc/scheduler.ts electron/ipc/settings.ts
```

- [x] **Step 6: Update configs for server-backed Electron**

Modify `tsconfig.node.json` include:

```json
"include": ["electron/**/*.ts", "server/**/*.ts", "src/runtime/**/*.ts", "vite.config.ts", "vitest.config.ts"]
```

Modify `electron-builder.yml` files:

```yaml
files:
  - dist/**
  - dist-electron/**
  - dist-server/**
  - drizzle/**
  - build/icon.png
```

- [x] **Step 7: Run config tests to verify pass**

Run:

```bash
pnpm exec vitest run tests/core/dev-runtime-config.test.ts --reporter=dot
```

Expected: PASS.

- [x] **Step 8: Commit**

Run:

```bash
git add server/main.ts electron/main.ts tsconfig.node.json electron-builder.yml tests/core/dev-runtime-config.test.ts
git rm electron/preload.cts electron/ipc/books.ts electron/ipc/logs.ts electron/ipc/models.ts electron/ipc/scheduler.ts electron/ipc/settings.ts
git commit -m "feat: make electron load server runtime"
```

---

### Task 7: Remove Generic Invoke Route And Channel Contracts

**Files:**
- Delete: `server/routes/invoke.ts`
- Delete: `server/channel-dispatch.ts`
- Modify: `server/main.ts`
- Modify: `src/shared/contracts.ts`
- Modify: `tests/server/invoke.test.ts`
- Modify: `tests/server/static.test.ts`
- Modify: `tests/server/events.test.ts`

- [x] **Step 1: Write failing deletion tests**

In `tests/server/static.test.ts`, add:

```ts
it('keeps health available when static serving is enabled', async () => {
  const staticDir = makeTempDir('story-weaver-static-');
  writeFileSync(
    path.join(staticDir, 'index.html'),
    '<!doctype html><title>Story Weaver SPA</title>',
    'utf8'
  );
  const server = await buildServer({
    rootDir: makeTempDir('story-weaver-static-root-'),
    staticDir,
  });

  try {
    const response = await server.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  } finally {
    await server.close();
  }
});
```

Replace `tests/server/invoke.test.ts` with `tests/server/runtime-lifecycle.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildServer } from '../../server/main';
import { createRuntimeServices } from '../../src/runtime/create-runtime-services';

const roots: string[] = [];

function makeRootDir() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'story-weaver-lifecycle-'));
  roots.push(rootDir);
  return rootDir;
}

describe('server runtime lifecycle', () => {
  afterEach(() => {
    for (const rootDir of roots.splice(0)) {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('closes the shared runtime when the Fastify server closes', async () => {
    const close = vi.fn();
    const server = await buildServer({
      rootDir: makeRootDir(),
      createRuntime: (input) => ({
        ...createRuntimeServices(input),
        close,
      }),
    });

    await server.close();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Run tests to verify they fail before deletion cleanup**

Run:

```bash
pnpm exec vitest run tests/server/static.test.ts tests/server/runtime-lifecycle.test.ts tests/core/dev-runtime-config.test.ts --reporter=dot
```

Expected: FAIL if obsolete files still exist or invoke tests still reference `/api/invoke`.

- [x] **Step 3: Remove invoke route registration and files**

In `server/main.ts`, remove:

```ts
import { registerInvokeRoutes } from './routes/invoke.js';
await registerInvokeRoutes(app, services, { exportsRegistry });
```

Then run:

```bash
git rm server/routes/invoke.ts server/channel-dispatch.ts tests/server/invoke.test.ts
git add tests/server/runtime-lifecycle.test.ts
```

- [x] **Step 4: Remove channel maps from shared contracts**

In `src/shared/contracts.ts`, remove the obsolete channel exports after all imports are gone: `ipcChannels`, `IpcChannel`, `ipcInvokeChannels`, `IpcInvokeChannel`, `IpcPayloadMap`, `IpcResponseMap`, and `assertIpcPayload`.

Keep domain DTOs and the concrete API aliases from Task 1.

- [x] **Step 5: Search for remaining generic command bus references**

Run:

```bash
rg -n "ipcChannels|IpcInvoke|IpcPayload|IpcResponse|assertIpcPayload|/api/invoke|channel-dispatch|registerInvokeRoutes|invoke\\(" . -g '!node_modules' -g '!docs/superpowers/plans/2026-05-01-concrete-server-api-runtime-implementation-plan.md'
```

Expected: no references in source or tests. References in historical docs can remain.

- [x] **Step 6: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run tests/server tests/core/ipc-contracts.test.ts tests/core/dev-runtime-config.test.ts --reporter=dot
```

Expected: PASS.

- [x] **Step 7: Commit**

Run:

```bash
git add server/main.ts src/shared/contracts.ts tests/server/static.test.ts tests/server/events.test.ts tests/core/dev-runtime-config.test.ts
git rm server/routes/invoke.ts server/channel-dispatch.ts tests/server/invoke.test.ts
git add tests/server/runtime-lifecycle.test.ts
git commit -m "refactor: remove generic invoke command bus"
```

---

### Task 8: Update Documentation And Full Verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `package.json`
- Modify: `scripts/smoke-browser-persistence.mjs`
- Create or modify: `scripts/smoke-electron-package.mjs`

- [x] **Step 1: Write failing smoke/config expectations**

In `tests/core/dev-runtime-config.test.ts`, update smoke expectations:

```ts
it('browser persistence smoke uses concrete server APIs', () => {
  expect(packageJson.scripts?.['smoke:browser-persistence']).toBe(
    'node scripts/smoke-browser-persistence.mjs'
  );
  expect(browserPersistenceSmokeSource).toContain('POST');
  expect(browserPersistenceSmokeSource).toContain('/api/books');
  expect(browserPersistenceSmokeSource).not.toContain('/api/invoke');
});

it('provides an automated Electron package smoke check for server artifacts', () => {
  expect(packageJson.scripts?.['smoke:electron-package']).toBe(
    'node scripts/smoke-electron-package.mjs'
  );
  expect(electronPackageSmokeSource).toContain('/dist-server/');
  expect(electronPackageSmokeSource).toContain('/dist-electron/');
  expect(electronPackageSmokeSource).toContain('/dist/index.html');
  expect(electronPackageSmokeSource).toContain('/drizzle/meta/_journal.json');
  expect(electronPackageSmokeSource).toContain('better_sqlite3.node');
});
```

- [x] **Step 2: Run config test to verify it fails**

Run:

```bash
pnpm exec vitest run tests/core/dev-runtime-config.test.ts --reporter=dot
```

Expected: FAIL until smoke scripts and docs are updated.

- [x] **Step 3: Update browser smoke script to use concrete APIs**

In `scripts/smoke-browser-persistence.mjs`, replace invoke helper calls with concrete fetch calls:

```js
async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `Request failed with ${response.status}`);
  }
  return body;
}

const createResult = await requestJson(baseUrl, '/api/books', {
  method: 'POST',
  body: JSON.stringify({
    idea: `Smoke persistence ${Date.now()}`,
    targetChapters: 1,
    wordsPerChapter: 800,
  }),
});

const books = await requestJson(baseUrl, '/api/books');
if (!books.some((book) => book.id === createResult.bookId)) {
  throw new Error('Created book was not returned by GET /api/books');
}
```

- [x] **Step 4: Update Electron package smoke script**

Create `scripts/smoke-electron-package.mjs` if it is missing. It should contain:

```js
import { execFileSync } from 'node:child_process';

const outputDir = '/tmp/story-weaver-package-smoke';
execFileSync('pnpm', [
  'exec',
  'electron-builder',
  '--dir',
  `--config.directories.output=${outputDir}`,
], { stdio: 'inherit' });

const appAsar = `${outputDir}/mac-arm64/Story Weaver.app/Contents/Resources/app.asar`;
const listing = execFileSync('pnpm', ['exec', 'asar', 'list', appAsar], {
  encoding: 'utf8',
});

for (const expected of [
  '/dist/index.html',
  '/dist-electron/',
  '/dist-server/',
  '/drizzle/meta/_journal.json',
  'better_sqlite3.node',
]) {
  if (!listing.includes(expected)) {
    throw new Error(`Missing packaged artifact: ${expected}`);
  }
}
```

Ensure `package.json` contains:

```json
"smoke:electron-package": "node scripts/smoke-electron-package.mjs"
```

- [x] **Step 5: Update `CLAUDE.md`**

Replace the Electron IPC architecture paragraph with:

```md
Renderer business calls use concrete local server APIs such as `GET /api/books`, `POST /api/books/:bookId/start`, and `PUT /api/settings/:key`. The renderer never calls Electron IPC for business behavior. In Electron, the main process starts the same local Fastify server and loads either Vite with a `storyWeaverApi` query parameter during development or the packaged server URL in production. Refreshing the frontend only reconnects HTTP/SSE clients; it does not close the runtime, pause the scheduler, or cancel generation.
```

- [x] **Step 6: Run focused verification**

Run:

```bash
pnpm exec vitest run tests/server tests/renderer/http-transport.test.tsx tests/renderer/app-shell.test.tsx tests/core/dev-runtime-config.test.ts --reporter=dot
pnpm run typecheck
pnpm run build
pnpm run smoke:browser-persistence
```

Expected: PASS for all commands.

- [x] **Step 7: Commit**

Run:

```bash
git add CLAUDE.md package.json scripts/smoke-browser-persistence.mjs scripts/smoke-electron-package.mjs tests/core/dev-runtime-config.test.ts
git commit -m "docs: document concrete server api runtime"
```

---

## Self-Review

**Spec coverage:** This plan covers concrete routes for books, scheduler, models, settings, events/static/exports, renderer concrete API methods, Electron server-only startup, deletion of Electron IPC and `/api/invoke`, packaging, docs, and smoke verification.

**Placeholder scan:** The plan avoids open-ended implementation instructions. Each task includes concrete files, test snippets, implementation snippets, commands, and expected outcomes.

**Type consistency:** The plan uses `BookCreatePayload`, `BookExportFormat`, `BookExportResponse`, `ModelSavePayload`, `SchedulerStatus`, `StoryWeaverApi`, and `RuntimeServices` consistently. `writeAllChapters` uses `{ completedChapters; status }`, matching the current runtime response.
