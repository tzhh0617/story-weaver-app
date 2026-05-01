# Monorepo Frontend/Backend Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Story Weaver into explicit `@story-weaver/frontend`, `@story-weaver/backend`, and `@story-weaver/shared` workspace packages while preserving browser mode and the Electron desktop app.

**Architecture:** `packages/shared` exposes runtime-neutral API contracts and pure shared setting helpers. `packages/backend` owns Fastify, runtime services, core story generation, AI providers, SQLite repositories, migrations, exports, and mock services. `packages/frontend` owns the React/Vite UI and HTTP/SSE client. Electron imports only the backend server entry and loads the frontend through Vite or backend-served static files.

**Tech Stack:** pnpm workspaces, TypeScript, Vite, React, Fastify, Electron, SQLite, Vitest, Testing Library.

---

## File Structure

- Create: `pnpm-workspace.yaml` with `packages/*`.
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/contracts.ts`, `packages/shared/src/settings.ts`, `packages/shared/src/index.ts`.
- Create: `packages/backend/package.json`, `packages/backend/tsconfig.json`, `packages/backend/src/**`.
- Create: `packages/frontend/package.json`, `packages/frontend/tsconfig.json`, `packages/frontend/vite.config.ts`, `packages/frontend/src/**`.
- Modify: `package.json` root scripts to call package scripts.
- Modify: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.server.json`, `vitest.config.ts` to use workspace aliases.
- Modify: `electron/main.ts` to import `startServer` from `@story-weaver/backend`.
- Modify: `electron-builder.yml` to package `packages/frontend/dist`, `packages/backend/dist`, and backend migration files.
- Modify: `scripts/smoke-browser-persistence.mjs`, `scripts/smoke-electron-package.mjs` paths for new build output.
- Modify: tests under `tests/**` to import from package names.
- Delete after migration: root `renderer/`, root `server/`, root `src/`, root `vite.config.ts` if package-level Vite config fully replaces it.

---

### Task 1: Add Workspace Skeleton And Boundary Tests

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`
- Create: `tests/architecture/import-boundaries.test.ts`

- [ ] **Step 1: Write the failing import-boundary tests**

Create `tests/architecture/import-boundaries.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const rootDir = path.resolve(__dirname, '../..');

function listTrackedSourceFiles() {
  const output = execFileSync('git', ['ls-files'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx|cts|mts)$/.test(file))
    .filter((file) => !file.startsWith('dist'))
    .filter((file) => !file.startsWith('dist-electron'))
    .filter((file) => !file.startsWith('dist-server'));
}

function importsIn(file: string) {
  const source = readFileSync(path.join(rootDir, file), 'utf8');
  const matches = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g
  );

  return [...matches].map((match) => match[1] ?? '');
}

describe('workspace import boundaries', () => {
  it('has explicit frontend, backend, and shared package roots', () => {
    expect(existsSync(path.join(rootDir, 'packages/frontend'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'packages/backend'))).toBe(true);
    expect(existsSync(path.join(rootDir, 'packages/shared'))).toBe(true);
  });

  it('keeps frontend from importing backend internals', () => {
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('packages/frontend/'))
      .flatMap((file) =>
        importsIn(file)
          .filter(
            (specifier) =>
              specifier === '@story-weaver/backend' ||
              specifier.startsWith('@story-weaver/backend/') ||
              specifier.includes('/packages/backend/') ||
              specifier.includes('../../backend/')
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('keeps shared runtime neutral', () => {
    const forbidden = [
      '@story-weaver/backend',
      '@story-weaver/frontend',
      'node:',
      'better-sqlite3',
      'electron',
      'fastify',
      'react',
    ];
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('packages/shared/'))
      .flatMap((file) =>
        importsIn(file)
          .filter((specifier) =>
            forbidden.some(
              (blocked) =>
                specifier === blocked || specifier.startsWith(`${blocked}/`)
            )
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('keeps backend from importing frontend', () => {
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('packages/backend/'))
      .flatMap((file) =>
        importsIn(file)
          .filter(
            (specifier) =>
              specifier === '@story-weaver/frontend' ||
              specifier.startsWith('@story-weaver/frontend/') ||
              specifier.includes('/packages/frontend/') ||
              specifier.includes('../../frontend/')
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });

  it('keeps electron from importing frontend source files', () => {
    const offenders = listTrackedSourceFiles()
      .filter((file) => file.startsWith('electron/'))
      .flatMap((file) =>
        importsIn(file)
          .filter(
            (specifier) =>
              specifier === '@story-weaver/frontend' ||
              specifier.startsWith('@story-weaver/frontend/') ||
              specifier.includes('/packages/frontend/src') ||
              specifier.includes('../packages/frontend/src')
          )
          .map((specifier) => `${file} -> ${specifier}`)
      );

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the boundary test and verify red**

Run:

```bash
pnpm exec vitest run tests/architecture/import-boundaries.test.ts --reporter=dot
```

Expected: FAIL because `packages/frontend`, `packages/backend`, and `packages/shared` do not exist yet.

- [ ] **Step 3: Add workspace metadata**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

Modify root `package.json` scripts to prepare for package builds without changing behavior yet:

```json
{
  "scripts": {
    "dev": "concurrently -k \"pnpm run dev:renderer\" \"pnpm run dev:electron\"",
    "dev:web": "concurrently -k \"pnpm run dev:renderer\" \"pnpm run dev:server\"",
    "dev:renderer": "vite --strictPort",
    "dev:server": "pnpm rebuild better-sqlite3 && tsx server/main.ts",
    "dev:electron": "pnpm run build:electron && electron-rebuild -f -w better-sqlite3 && wait-on tcp:5173 && VITE_DEV_SERVER_URL=http://localhost:5173 electron .",
    "start:server": "pnpm rebuild better-sqlite3 && node dist-server/server/main.js",
    "start:web": "pnpm run build && pnpm run start:server",
    "build": "pnpm run build:renderer && pnpm run build:electron && pnpm run build:server",
    "build:renderer": "vite build",
    "build:electron": "tsc -p tsconfig.node.json",
    "build:server": "tsc -p tsconfig.server.json",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.server.json",
    "test": "pnpm rebuild better-sqlite3 && vitest run",
    "test:watch": "vitest",
    "smoke:browser-persistence": "node scripts/smoke-browser-persistence.mjs",
    "smoke:electron-package": "node scripts/smoke-electron-package.mjs",
    "package": "pnpm run build && electron-builder"
  }
}
```

This step intentionally preserves existing commands. Later tasks switch each command to package paths after packages exist.

- [ ] **Step 4: Verify current tests still run**

Run:

```bash
pnpm exec vitest run tests/architecture/import-boundaries.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS or a boundary-test pass with no package files yet. Typecheck remains unchanged.

- [ ] **Step 5: Commit**

Run:

```bash
git add pnpm-workspace.yaml package.json tsconfig.json vitest.config.ts tests/architecture/import-boundaries.test.ts
git commit -m "chore: add workspace boundary guard"
```

---

### Task 2: Extract The Shared Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/contracts.ts`
- Create: `packages/shared/src/settings.ts`
- Create: `packages/shared/src/index.ts`
- Modify: `src/core/chapter-review.ts`
- Modify: `tsconfig.json`
- Modify: `tsconfig.node.json`
- Modify: `tsconfig.server.json`
- Modify: `vitest.config.ts`
- Modify: shared-type imports in `renderer/**`, `server/**`, `src/**`, and `tests/**`
- Test: `tests/core/chapter-review.test.ts`
- Test: `tests/core/ipc-contracts.test.ts`
- Test: `tests/architecture/import-boundaries.test.ts`

- [ ] **Step 1: Write the failing shared setting contract test**

Modify `tests/core/chapter-review.test.ts` so pure setting helpers come from shared and generation behavior remains backend-owned:

```ts
import {
  parseBooleanSetting,
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';
import { shouldRewriteShortChapter } from '../../src/core/chapter-review';

describe('short chapter review settings', () => {
  it('parses and serializes boolean setting values through shared helpers', () => {
    expect(SHORT_CHAPTER_REVIEW_ENABLED_KEY).toBe('writing.shortChapterReviewEnabled');
    expect(parseBooleanSetting(null)).toBe(true);
    expect(parseBooleanSetting('false')).toBe(false);
    expect(parseBooleanSetting('true')).toBe(true);
    expect(serializeBooleanSetting(false)).toBe('false');
    expect(serializeBooleanSetting(true)).toBe('true');
  });

  it('detects drafts that are far below the requested chapter length', () => {
    expect(
      shouldRewriteShortChapter({
        enabled: true,
        content: '短章',
        wordsPerChapter: 1200,
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run focused tests and verify red**

Run:

```bash
pnpm exec vitest run tests/core/chapter-review.test.ts tests/architecture/import-boundaries.test.ts --reporter=dot
```

Expected: FAIL because `@story-weaver/shared/settings` does not exist.

- [ ] **Step 3: Create the shared package**

Create `packages/shared/package.json`:

```json
{
  "name": "@story-weaver/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./contracts": {
      "types": "./dist/contracts.d.ts",
      "import": "./dist/contracts.js"
    },
    "./settings": {
      "types": "./dist/settings.d.ts",
      "import": "./dist/settings.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Move the contents of `src/shared/contracts.ts` into `packages/shared/src/contracts.ts`.

Create `packages/shared/src/settings.ts`:

```ts
export const SHORT_CHAPTER_REVIEW_ENABLED_KEY =
  'writing.shortChapterReviewEnabled';

export function parseBooleanSetting(value: string | null) {
  return value === null ? true : value !== 'false';
}

export function serializeBooleanSetting(value: boolean) {
  return value ? 'true' : 'false';
}
```

Create `packages/shared/src/index.ts`:

```ts
export * from './contracts.js';
export * from './settings.js';
```

- [ ] **Step 4: Keep backend generation behavior in `chapter-review`**

Modify `src/core/chapter-review.ts`:

```ts
export {
  parseBooleanSetting,
  serializeBooleanSetting,
  SHORT_CHAPTER_REVIEW_ENABLED_KEY,
} from '@story-weaver/shared/settings';

export function countEffectiveWords(content: string) {
  return content
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：“”‘’（）《》【】—…,.!?;:'"()[\]\-]/g, '')
    .length;
}

export function shouldRewriteShortChapter(input: {
  enabled: boolean;
  content: string;
  wordsPerChapter: number;
}) {
  if (!input.enabled) {
    return false;
  }

  return countEffectiveWords(input.content) < input.wordsPerChapter * 0.55;
}
```

If the existing threshold differs, preserve the existing threshold and only move the setting helpers.

- [ ] **Step 5: Add workspace aliases for shared**

Modify root `tsconfig.json` paths:

```json
"paths": {
  "@/*": ["renderer/*"],
  "@story-weaver/shared": ["packages/shared/src/index.ts"],
  "@story-weaver/shared/*": ["packages/shared/src/*"]
}
```

Modify `tsconfig.node.json` and `tsconfig.server.json` with the same shared path aliases and `baseUrl: "."`.

Modify `vitest.config.ts`:

```ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, 'renderer'),
    '@story-weaver/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
    '@story-weaver/shared/contracts': path.resolve(__dirname, 'packages/shared/src/contracts.ts'),
    '@story-weaver/shared/settings': path.resolve(__dirname, 'packages/shared/src/settings.ts'),
  },
},
```

- [ ] **Step 6: Update shared imports**

Replace imports from `src/shared/contracts` with `@story-weaver/shared/contracts`.

Replace frontend imports from `src/core/chapter-review` with `@story-weaver/shared/settings` where they only use:

```ts
parseBooleanSetting
serializeBooleanSetting
SHORT_CHAPTER_REVIEW_ENABLED_KEY
```

Keep backend imports of `shouldRewriteShortChapter` pointing to `src/core/chapter-review` until backend is moved in Task 3.

- [ ] **Step 7: Verify shared extraction**

Run:

```bash
pnpm exec vitest run tests/core/chapter-review.test.ts tests/core/ipc-contracts.test.ts tests/architecture/import-boundaries.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add packages/shared src/core/chapter-review.ts tsconfig.json tsconfig.node.json tsconfig.server.json vitest.config.ts renderer server src tests
git commit -m "refactor: extract shared contracts package"
```

---

### Task 3: Move Backend Code Into `packages/backend`

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/tsconfig.json`
- Move: `server/**` to `packages/backend/src/**`
- Move: `src/core/**` to `packages/backend/src/core/**`
- Move: `src/models/**` to `packages/backend/src/models/**`
- Move: `src/mock/**` to `packages/backend/src/mock/**`
- Move: `src/runtime/**` to `packages/backend/src/runtime/**`
- Move: `src/storage/**` to `packages/backend/src/storage/**`
- Move: `src/utils/**` to `packages/backend/src/utils/**`
- Modify: backend internal imports
- Modify: root `tsconfig.server.json`
- Modify: root `vitest.config.ts`
- Modify: tests importing backend internals

- [ ] **Step 1: Write the failing backend package import test**

Modify `tests/server/health.test.ts` or create `tests/server/backend-package.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '@story-weaver/backend';

describe('backend package entry', () => {
  it('exports the Fastify server builder', async () => {
    const server = await buildServer();

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
});
```

- [ ] **Step 2: Run focused backend package test and verify red**

Run:

```bash
pnpm exec vitest run tests/server/backend-package.test.ts --reporter=dot
```

Expected: FAIL because `@story-weaver/backend` does not exist.

- [ ] **Step 3: Create backend package metadata**

Create `packages/backend/package.json`:

```json
{
  "name": "@story-weaver/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./main": {
      "types": "./dist/main.d.ts",
      "import": "./dist/main.js"
    },
    "./runtime/create-runtime-services": {
      "types": "./dist/runtime/create-runtime-services.d.ts",
      "import": "./dist/runtime/create-runtime-services.js"
    },
    "./core/*": {
      "types": "./dist/core/*.d.ts",
      "import": "./dist/core/*.js"
    },
    "./models/*": {
      "types": "./dist/models/*.d.ts",
      "import": "./dist/models/*.js"
    },
    "./mock/*": {
      "types": "./dist/mock/*.d.ts",
      "import": "./dist/mock/*.js"
    },
    "./storage/*": {
      "types": "./dist/storage/*.d.ts",
      "import": "./dist/storage/*.js"
    }
  },
  "scripts": {
    "dev": "pnpm rebuild better-sqlite3 && tsx src/main.ts",
    "build": "tsc -p tsconfig.json",
    "start": "pnpm rebuild better-sqlite3 && node dist/main.js",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@story-weaver/shared": "workspace:*"
  }
}
```

Keep runtime dependencies in the root package during the first move. They can be moved into package-level dependencies after the package split is green.

Create `packages/backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": "../..",
    "types": ["node"],
    "paths": {
      "@story-weaver/shared": ["packages/shared/src/index.ts"],
      "@story-weaver/shared/*": ["packages/shared/src/*"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Move backend files**

Use `git mv`:

```bash
mkdir -p packages/backend/src
git mv server/config.ts packages/backend/src/config.ts
git mv server/export-registry.ts packages/backend/src/export-registry.ts
git mv server/main.ts packages/backend/src/main.ts
git mv server/routes packages/backend/src/routes
git mv src/core packages/backend/src/core
git mv src/models packages/backend/src/models
git mv src/mock packages/backend/src/mock
git mv src/runtime packages/backend/src/runtime
git mv src/storage packages/backend/src/storage
git mv src/utils packages/backend/src/utils
```

Create `packages/backend/src/index.ts`:

```ts
export { buildServer, startServer } from './main.js';
export type { RuntimeServices } from './runtime/create-runtime-services.js';
```

- [ ] **Step 5: Update backend imports**

In `packages/backend/src/routes/*.ts`, replace:

```ts
../../src/shared/contracts.js
../../src/runtime/create-runtime-services.js
../../src/core/chapter-review.js
```

with:

```ts
@story-weaver/shared/contracts
../runtime/create-runtime-services.js
../core/chapter-review.js
```

In moved backend modules, replace imports from `../shared/contracts.js` with:

```ts
import type { ... } from '@story-weaver/shared/contracts';
```

Update `packages/backend/src/runtime/create-runtime-services.ts` to import `buildAppPaths` from the local backend path if `paths.ts` remains backend-owned:

```ts
import { buildAppPaths } from '../shared/paths.js';
```

If `src/shared/paths.ts` was moved into backend, place it at `packages/backend/src/shared/paths.ts`.

- [ ] **Step 6: Update test imports for backend internals**

Replace test imports:

```ts
../../src/core/
../../src/storage/
../../src/models/
../../src/mock/
../../src/runtime/
../../server/main
```

with package imports:

```ts
@story-weaver/backend/core/
@story-weaver/backend/storage/
@story-weaver/backend/models/
@story-weaver/backend/mock/
@story-weaver/backend/runtime/create-runtime-services
@story-weaver/backend
```

For files that import specific route helpers, prefer public `buildServer` tests instead of route internals.

- [ ] **Step 7: Add backend aliases for tests and root typecheck**

Modify `vitest.config.ts` aliases:

```ts
'@story-weaver/backend': path.resolve(__dirname, 'packages/backend/src/index.ts'),
'@story-weaver/backend/main': path.resolve(__dirname, 'packages/backend/src/main.ts'),
'@story-weaver/backend/core': path.resolve(__dirname, 'packages/backend/src/core/index.ts'),
'@story-weaver/backend/core/': path.resolve(__dirname, 'packages/backend/src/core/'),
'@story-weaver/backend/storage/': path.resolve(__dirname, 'packages/backend/src/storage/'),
'@story-weaver/backend/models/': path.resolve(__dirname, 'packages/backend/src/models/'),
'@story-weaver/backend/mock/': path.resolve(__dirname, 'packages/backend/src/mock/'),
'@story-weaver/backend/runtime/create-runtime-services': path.resolve(__dirname, 'packages/backend/src/runtime/create-runtime-services.ts'),
```

If Vitest does not match trailing slash aliases for subpaths, use the Vite alias array form:

```ts
alias: [
  { find: '@story-weaver/backend', replacement: path.resolve(__dirname, 'packages/backend/src/index.ts') },
  { find: /^@story-weaver\/backend\/(.*)$/, replacement: path.resolve(__dirname, 'packages/backend/src/$1') },
]
```

Modify root `tsconfig.json` paths:

```json
"@story-weaver/backend": ["packages/backend/src/index.ts"],
"@story-weaver/backend/*": ["packages/backend/src/*"]
```

Modify `tsconfig.server.json` include:

```json
"include": ["packages/backend/src/**/*.ts"]
```

- [ ] **Step 8: Verify backend move**

Run:

```bash
pnpm exec vitest run tests/server/backend-package.test.ts tests/server/books-routes.test.ts tests/runtime/create-runtime-services.test.ts tests/storage/database.test.ts --reporter=dot
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add packages/backend tests package.json tsconfig.json tsconfig.server.json vitest.config.ts
git add -u server src
git commit -m "refactor: move backend logic into workspace package"
```

---

### Task 4: Move Frontend Code Into `packages/frontend`

**Files:**
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Move: `renderer/**` to `packages/frontend/src/**`
- Move: `vite.config.ts` to `packages/frontend/vite.config.ts`
- Modify: frontend imports and aliases
- Modify: `tests/renderer/**`
- Modify: `vitest.config.ts`
- Modify: root `tsconfig.json`

- [ ] **Step 1: Write the failing frontend package test**

Modify `tests/renderer/renderer-entry.test.tsx` or create `tests/renderer/frontend-package.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import App from '@story-weaver/frontend/App';

describe('frontend package entry', () => {
  it('exports the React app from the frontend package', () => {
    render(<App />);

    expect(document.body.textContent).toContain('Story Weaver');
  });
});
```

If rendering `App` requires a full API mock, use the existing renderer test setup that mocks `useStoryWeaverApi`, and assert a stable app shell label already used by existing tests.

- [ ] **Step 2: Run focused frontend package test and verify red**

Run:

```bash
pnpm exec vitest run tests/renderer/frontend-package.test.tsx --reporter=dot
```

Expected: FAIL because `@story-weaver/frontend/App` does not exist.

- [ ] **Step 3: Create frontend package metadata**

Create `packages/frontend/package.json`:

```json
{
  "name": "@story-weaver/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./App": "./src/App.tsx",
    "./main": "./src/main.tsx",
    "./*": "./src/*"
  },
  "scripts": {
    "dev": "vite --config vite.config.ts --strictPort",
    "build": "vite build --config vite.config.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@story-weaver/shared": "workspace:*"
  }
}
```

Create `packages/frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"],
    "paths": {
      "@/*": ["src/*"],
      "@story-weaver/shared": ["../shared/src/index.ts"],
      "@story-weaver/shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Move frontend files**

Run:

```bash
mkdir -p packages/frontend
git mv renderer packages/frontend/src
git mv vite.config.ts packages/frontend/vite.config.ts
```

Modify `packages/frontend/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  base: './',
  root: path.resolve(__dirname, 'src'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@story-weaver/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@story-weaver/shared/contracts': path.resolve(
        __dirname,
        '../shared/src/contracts.ts'
      ),
      '@story-weaver/shared/settings': path.resolve(
        __dirname,
        '../shared/src/settings.ts'
      ),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5174',
    },
  },
});
```

- [ ] **Step 5: Update frontend imports**

Within `packages/frontend/src`, replace imports from:

```ts
../../src/shared/contracts
../src/shared/contracts
../src/core/chapter-review
```

with:

```ts
@story-weaver/shared/contracts
@story-weaver/shared/settings
```

Keep UI aliases as `@/...`; package Vite and TypeScript configs now point `@` to `packages/frontend/src`.

- [ ] **Step 6: Update root config for frontend package**

Modify root `tsconfig.json`:

```json
"paths": {
  "@/*": ["packages/frontend/src/*"],
  "@story-weaver/frontend/*": ["packages/frontend/src/*"],
  "@story-weaver/shared": ["packages/shared/src/index.ts"],
  "@story-weaver/shared/*": ["packages/shared/src/*"],
  "@story-weaver/backend": ["packages/backend/src/index.ts"],
  "@story-weaver/backend/*": ["packages/backend/src/*"]
},
"include": [
  "packages/frontend/src",
  "packages/shared/src",
  "packages/backend/src",
  "tests",
  "vitest.config.ts",
  "tailwind.config.ts"
]
```

Modify `vitest.config.ts` alias array:

```ts
alias: [
  { find: '@', replacement: path.resolve(__dirname, 'packages/frontend/src') },
  { find: /^@story-weaver\/frontend\/(.*)$/, replacement: path.resolve(__dirname, 'packages/frontend/src/$1') },
  { find: '@story-weaver/shared', replacement: path.resolve(__dirname, 'packages/shared/src/index.ts') },
  { find: /^@story-weaver\/shared\/(.*)$/, replacement: path.resolve(__dirname, 'packages/shared/src/$1') },
  { find: '@story-weaver/backend', replacement: path.resolve(__dirname, 'packages/backend/src/index.ts') },
  { find: /^@story-weaver\/backend\/(.*)$/, replacement: path.resolve(__dirname, 'packages/backend/src/$1') },
]
```

- [ ] **Step 7: Update renderer tests**

Replace imports from:

```ts
../../renderer/
../renderer/
@/
```

with the stable package paths where tests import package entry points:

```ts
@story-weaver/frontend/
```

Keep `@/` only for frontend-internal test imports when the alias is configured to `packages/frontend/src`.

- [ ] **Step 8: Verify frontend move**

Run:

```bash
pnpm exec vitest run tests/renderer/frontend-package.test.tsx tests/renderer/app-shell.test.tsx tests/renderer/http-transport.test.tsx tests/architecture/import-boundaries.test.ts --reporter=dot
pnpm run typecheck
pnpm --filter @story-weaver/frontend build
```

Expected: PASS, and frontend output appears under `packages/frontend/dist`.

- [ ] **Step 9: Commit**

Run:

```bash
git add packages/frontend tests package.json tsconfig.json vitest.config.ts
git add -u renderer vite.config.ts
git commit -m "refactor: move frontend into workspace package"
```

---

### Task 5: Switch Root Scripts And Electron To Package Entries

**Files:**
- Modify: `package.json`
- Modify: `electron/main.ts`
- Modify: `tsconfig.node.json`
- Modify: `electron-builder.yml`
- Modify: `scripts/smoke-browser-persistence.mjs`
- Modify: `scripts/smoke-electron-package.mjs`
- Test: `tests/electron/runtime-mock-fallback.test.ts`
- Test: `tests/server/static.test.ts`

- [ ] **Step 1: Write failing Electron backend import test**

Modify `tests/electron/runtime-mock-fallback.test.ts` so runtime imports come from the backend package:

```ts
import { DEFAULT_MOCK_MODEL_ID } from '@story-weaver/backend/models/runtime-mode';
import { countStoryCharacters } from '@story-weaver/backend/core/story-constraints';
import type { RuntimeServices } from '@story-weaver/backend/runtime/create-runtime-services';
```

If the test dynamically imports the runtime, change it to:

```ts
const runtimeModule = await import('@story-weaver/backend/runtime/create-runtime-services');
```

- [ ] **Step 2: Run focused Electron/backend tests and verify red if aliases are incomplete**

Run:

```bash
pnpm exec vitest run tests/electron/runtime-mock-fallback.test.ts tests/server/static.test.ts --reporter=dot
```

Expected: FAIL only if package aliases or static paths are incomplete.

- [ ] **Step 3: Update root scripts**

Modify root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently -k \"pnpm run dev:frontend\" \"pnpm run dev:electron\"",
    "dev:web": "concurrently -k \"pnpm run dev:frontend\" \"pnpm run dev:backend\"",
    "dev:frontend": "pnpm --filter @story-weaver/frontend dev",
    "dev:backend": "pnpm --filter @story-weaver/backend dev",
    "dev:electron": "pnpm run build:electron && electron-rebuild -f -w better-sqlite3 && wait-on tcp:5173 && VITE_DEV_SERVER_URL=http://localhost:5173 electron .",
    "start:server": "pnpm --filter @story-weaver/backend start",
    "start:web": "pnpm run build && pnpm run start:server",
    "build": "pnpm run build:shared && pnpm run build:frontend && pnpm run build:backend && pnpm run build:electron",
    "build:shared": "pnpm --filter @story-weaver/shared build",
    "build:frontend": "pnpm --filter @story-weaver/frontend build",
    "build:backend": "pnpm --filter @story-weaver/backend build",
    "build:electron": "tsc -p tsconfig.node.json",
    "typecheck": "pnpm --filter @story-weaver/shared typecheck && pnpm --filter @story-weaver/frontend typecheck && pnpm --filter @story-weaver/backend typecheck && tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.json",
    "test": "pnpm rebuild better-sqlite3 && vitest run",
    "test:watch": "vitest",
    "smoke:browser-persistence": "node scripts/smoke-browser-persistence.mjs",
    "smoke:electron-package": "node scripts/smoke-electron-package.mjs",
    "package": "pnpm run build && electron-builder"
  }
}
```

If `backend` typecheck depends on built shared declarations, keep `build:shared` before backend build and typecheck.

- [ ] **Step 4: Update Electron server import and static directory**

Modify `electron/main.ts`:

```ts
import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'node:path';
import { startServer } from '@story-weaver/backend';
```

Update `ensureServer()` static directory:

```ts
server = await startServer({
  port: 0,
  staticDir: path.join(app.getAppPath(), 'packages/frontend/dist'),
});
```

If packaged `app.asar` stores the frontend dist at a flattened path chosen in `electron-builder.yml`, use the exact packaged path from that file and keep this path aligned with the smoke test.

- [ ] **Step 5: Update Electron TypeScript config**

Modify `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist-electron",
    "baseUrl": ".",
    "types": ["node"],
    "paths": {
      "@story-weaver/backend": ["packages/backend/src/index.ts"],
      "@story-weaver/backend/*": ["packages/backend/src/*"],
      "@story-weaver/shared": ["packages/shared/src/index.ts"],
      "@story-weaver/shared/*": ["packages/shared/src/*"]
    }
  },
  "include": ["electron/**/*.ts"]
}
```

- [ ] **Step 6: Update Electron packaging**

Modify `electron-builder.yml`:

```yaml
appId: com.storyweaver.desktop
productName: Story Weaver
files:
  - packages/frontend/dist/**
  - packages/backend/dist/**
  - packages/backend/package.json
  - packages/shared/dist/**
  - packages/shared/package.json
  - dist-electron/**
  - drizzle/**
  - build/icon.png
mac:
  category: public.app-category.productivity
  icon: build/icon.icns
win:
  icon: build/icon.ico
directories:
  output: release
```

If backend runtime expects migrations under `drizzle/`, keep root `drizzle/**` packaged until a later migration moves drizzle files into `packages/backend`.

- [ ] **Step 7: Update smoke scripts**

In `scripts/smoke-browser-persistence.mjs`, replace references to:

```js
dist
dist-server/server/main.js
```

with:

```js
packages/frontend/dist
packages/backend/dist/main.js
```

In `scripts/smoke-electron-package.mjs`, update `asar list` assertions from:

```text
^/(dist|dist-electron|dist-server|drizzle)(/|$)
```

to:

```text
^/(packages/frontend/dist|packages/backend/dist|packages/shared/dist|dist-electron|drizzle)(/|$)
```

Keep the native `better_sqlite3.node` assertion unchanged unless electron-builder output changes.

- [ ] **Step 8: Verify scripts and Electron config**

Run:

```bash
pnpm exec vitest run tests/electron/runtime-mock-fallback.test.ts tests/server/static.test.ts tests/architecture/import-boundaries.test.ts --reporter=dot
pnpm run typecheck
pnpm run build
```

Expected: PASS. Build output exists at `packages/shared/dist`, `packages/backend/dist`, `packages/frontend/dist`, and `dist-electron`.

- [ ] **Step 9: Commit**

Run:

```bash
git add package.json electron/main.ts tsconfig.node.json electron-builder.yml scripts tests
git commit -m "chore: wire workspace packages into runtime scripts"
```

---

### Task 6: Remove Legacy Root Ownership And Update Documentation

**Files:**
- Delete: empty root `src/`, `server/`, `renderer/` directories if any remain
- Delete: root `vite.config.ts` if replaced by `packages/frontend/vite.config.ts`
- Modify: `CLAUDE.md`
- Modify: `tests/architecture/import-boundaries.test.ts`
- Modify: any remaining imports found by `rg`

- [ ] **Step 1: Write the failing legacy path test**

Extend `tests/architecture/import-boundaries.test.ts`:

```ts
it('does not keep application source in legacy root directories', () => {
  const legacySources = listTrackedSourceFiles().filter(
    (file) =>
      file.startsWith('src/') ||
      file.startsWith('server/') ||
      file.startsWith('renderer/')
  );

  expect(legacySources).toEqual([]);
});
```

- [ ] **Step 2: Run boundary tests and verify red if legacy paths remain**

Run:

```bash
pnpm exec vitest run tests/architecture/import-boundaries.test.ts --reporter=dot
```

Expected: FAIL if any tracked application source remains under `src/`, `server/`, or `renderer/`.

- [ ] **Step 3: Remove or relocate legacy files**

Run:

```bash
rg "from ['\\\"](\\.\\./)*src/|from ['\\\"](\\.\\./)*server/|from ['\\\"](\\.\\./)*renderer/" -n
rg "src/|server/|renderer/" package.json tsconfig.json tsconfig.node.json tsconfig.server.json vitest.config.ts electron-builder.yml scripts tests CLAUDE.md
```

For each result:

- Replace `src/shared` imports with `@story-weaver/shared`.
- Replace `src/core`, `src/storage`, `src/models`, `src/runtime`, `src/mock`, and `server` imports with `@story-weaver/backend`.
- Replace `renderer` imports with `@story-weaver/frontend` or `@` when inside frontend code.
- Replace build paths with `packages/frontend/dist` and `packages/backend/dist`.

Delete empty legacy directories after `git mv` has removed tracked files.

- [ ] **Step 4: Update `CLAUDE.md` architecture documentation**

Replace the architecture section with:

```md
## Architecture

This is a pnpm workspace with explicit frontend, backend, and shared packages.

### Frontend (`packages/frontend`)
- React 19 + Vite + Tailwind + shadcn/ui.
- Owns UI, pages, hooks, assets, and HTTP/SSE client code.
- May import `@story-weaver/shared`.
- Must not import `@story-weaver/backend`.

### Backend (`packages/backend`)
- Fastify local API server for browser and Electron modes.
- Owns story core, runtime services, model providers, mock services, SQLite storage, exports, and route validation.
- May import `@story-weaver/shared`.

### Shared (`packages/shared`)
- Runtime-neutral API contracts, public view types, and pure setting helpers.
- Must not import frontend, backend, Node-only, or browser-only modules.

### Electron (`electron`)
- Desktop shell.
- Starts `@story-weaver/backend` locally and loads the Vite dev URL or packaged frontend static URL.
- Does not contain business IPC handlers.
```

Also update command documentation to the root scripts from Task 5.

- [ ] **Step 5: Verify no legacy imports remain**

Run:

```bash
rg "from ['\\\"](\\.\\./)*src/|from ['\\\"](\\.\\./)*server/|from ['\\\"](\\.\\./)*renderer/" -n
pnpm exec vitest run tests/architecture/import-boundaries.test.ts --reporter=dot
pnpm run typecheck
```

Expected: `rg` returns no source-import matches. Boundary tests and typecheck pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add CLAUDE.md tests package.json tsconfig.json tsconfig.node.json tsconfig.server.json vitest.config.ts electron-builder.yml scripts
git add -u src server renderer vite.config.ts
git commit -m "docs: document workspace package architecture"
```

---

### Task 7: Full Regression Verification

**Files:**
- Modify only files needed to fix regressions found by verification.

- [ ] **Step 1: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 2: Run all tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm run build
```

Expected: PASS. Outputs:

- `packages/shared/dist`
- `packages/backend/dist`
- `packages/frontend/dist`
- `dist-electron`

- [ ] **Step 4: Run browser persistence smoke**

Run:

```bash
pnpm run smoke:browser-persistence
```

Expected: PASS. The script creates a temp data directory, starts the built backend, creates a book via `POST /api/books`, verifies SQLite persistence, stops the server, and removes temp data.

- [ ] **Step 5: Run Electron package smoke**

Run:

```bash
rm -rf /tmp/story-weaver-package-smoke
pnpm run smoke:electron-package
rm -rf /tmp/story-weaver-package-smoke
```

Expected: PASS. The package contains frontend dist, backend dist, shared dist, Electron output, migrations, and the native `better-sqlite3` binary.

- [ ] **Step 6: Fix verification failures with TDD**

For each failure:

1. Add or narrow a failing regression test that captures the behavior.
2. Run the focused test and confirm it fails for the expected reason.
3. Implement the smallest fix.
4. Re-run the focused test.
5. Re-run the relevant broader command from Steps 1-5.

- [ ] **Step 7: Final commit**

Run:

```bash
git status --short
git add package.json pnpm-workspace.yaml packages electron tests scripts CLAUDE.md tsconfig.json tsconfig.node.json tsconfig.server.json vitest.config.ts electron-builder.yml
git add -u
git commit -m "refactor: split app into frontend backend shared packages"
```

---

## Self-Review Checklist

- Spec coverage: The plan creates `frontend`, `backend`, and `shared` packages, preserves Electron, preserves browser mode, updates build/test/smoke workflows, and adds import-boundary tests.
- Package boundaries: Frontend can import shared only; backend can import shared only; shared is runtime-neutral; Electron imports backend only.
- Behavior preservation: API routes, SQLite persistence, scheduler/runtime lifecycle, model fallback, and exports are guarded by existing tests and smoke scripts.
- TDD coverage: Each major migration starts with a failing or guarding test before implementation.
- Completeness: Each task lists concrete files, commands, expected outcomes, and code snippets needed for implementation.
