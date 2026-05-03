# React Router Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the renderer's in-component view switching with `react-router-dom` routes so the Electron app can navigate by URL while preserving current behavior.

**Architecture:** Wrap the renderer with `HashRouter`, keep `App` as the main orchestration shell, and move view selection from `currentView` state to route matching plus imperative navigation. Reuse existing page components and data-loading hooks, only changing the navigation seams between the sidebar, the library, new-book creation, book detail, logs, and settings.

**Tech Stack:** React 19, Vite, Electron renderer, `react-router-dom`, Vitest, Testing Library

---

### Task 1: Install the router dependency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the failing dependency usage context**

```ts
// renderer/main.tsx will import HashRouter from 'react-router-dom'
// renderer/App.tsx will import Navigate, Route, Routes, useLocation, useNavigate, useParams
```

- [ ] **Step 2: Install the dependency**

Run: `pnpm add react-router-dom`
Expected: `package.json` and `pnpm-lock.yaml` include `react-router-dom`

- [ ] **Step 3: Verify install state**

Run: `pnpm ls react-router-dom`
Expected: one installed `react-router-dom` entry under `story-weaver-app`

### Task 2: Write failing route-driven shell tests

**Files:**
- Modify: `tests/renderer/app-shell.test.tsx`
- Modify: `tests/renderer/renderer-entry.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it('opens settings when the current route is /settings', async () => {
  window.history.replaceState({}, '', '/#/settings');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '设置' })).toBeInTheDocument();
});

it('opens logs when the current route is /logs', async () => {
  window.history.replaceState({}, '', '/#/logs');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '写作动态' })).toBeInTheDocument();
});

it('opens the new-book workspace when the current route is /books/new', async () => {
  window.history.replaceState({}, '', '/#/books/new');
  render(<App />);
  expect(await screen.findByRole('heading', { name: '新建作品' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `pnpm exec vitest run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx`
Expected: FAIL because `App` is not yet mounted inside a router / route state is ignored

- [ ] **Step 3: Add a reusable router-aware render helper in tests if needed**

```tsx
function renderApp() {
  return render(<App />);
}
```

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm exec vitest run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx`
Expected: still FAIL, but with route expectations now in place

### Task 3: Wrap the renderer entry with HashRouter

**Files:**
- Modify: `renderer/main.tsx`
- Test: `tests/renderer/renderer-entry.test.tsx`

- [ ] **Step 1: Implement the minimal entry change**

```tsx
import { HashRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: Run renderer entry test**

Run: `pnpm exec vitest run tests/renderer/renderer-entry.test.tsx`
Expected: PASS

### Task 4: Move App shell navigation to routes

**Files:**
- Modify: `renderer/App.tsx`
- Modify: `renderer/components/app-sidebar.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the route constants and route-matching helpers inside `renderer/App.tsx`**

```tsx
const libraryRoute = '/';
const newBookRoute = '/books/new';
const logsRoute = '/logs';
const settingsRoute = '/settings';

function getSidebarView(pathname: string): AppView {
  if (pathname === settingsRoute) return 'settings';
  if (pathname === logsRoute) return 'logs';
  return 'library';
}
```

- [ ] **Step 2: Replace `currentView` state with router hooks**

```tsx
const navigate = useNavigate();
const location = useLocation();
const currentView = getSidebarView(location.pathname);
```

- [ ] **Step 3: Add a nested route reader for `/books/:bookId` and sync selected detail loading**

```tsx
function BookDetailRouteGate({ onOpen }: { onOpen: (bookId: string) => void }) {
  const { bookId } = useParams();

  useEffect(() => {
    if (bookId) {
      void onOpen(bookId);
    }
  }, [bookId, onOpen]);

  return null;
}
```

- [ ] **Step 4: Update navigation callbacks to push routes instead of mutating view state**

```tsx
onSelectBook={(bookId) => {
  void loadBookDetail(bookId, { openView: false });
  navigate(`/books/${bookId}`);
}}
onCreateBook={() => navigate('/books/new')}
onBackToLibrary={() => navigate('/')}
onSelectView={(view) => navigate(view === 'logs' ? '/logs' : view === 'settings' ? '/settings' : '/')}
```

- [ ] **Step 5: Render page content with `Routes` and a redirect fallback**

```tsx
<Routes>
  <Route path="/" element={<Library ... />} />
  <Route path="/books/new" element={<NewBook ... />} />
  <Route path="/books/:bookId" element={selectedBookDetail ? <BookDetail ... /> : null} />
  <Route path="/logs" element={<Logs ... />} />
  <Route path="/settings" element={<Settings ... />} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

- [ ] **Step 6: Keep delete and missing-book flows on valid routes**

```tsx
onDelete={async () => {
  await runSelectedBookAction({ ... });
  navigate('/');
}}

if (!books.length && location.pathname.startsWith('/books/')) {
  navigate('/', { replace: true });
}
```

- [ ] **Step 7: Run the focused shell tests**

Run: `pnpm exec vitest run tests/renderer/app-shell.test.tsx`
Expected: PASS

### Task 5: Verify the router integration end to end for impacted renderer code

**Files:**
- Modify: `tests/renderer/app-shell.test.tsx` (if any expectation text needs router-safe helpers)

- [ ] **Step 1: Run the targeted renderer suite**

Run: `pnpm exec vitest run tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx`
Expected: PASS

- [ ] **Step 2: Run typecheck for the project**

Run: `pnpm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml renderer/main.tsx renderer/App.tsx renderer/components/app-sidebar.tsx tests/renderer/app-shell.test.tsx tests/renderer/renderer-entry.test.tsx docs/superpowers/plans/2026-05-03-react-router-integration.md
git commit -m "feat: add renderer react router navigation"
```
