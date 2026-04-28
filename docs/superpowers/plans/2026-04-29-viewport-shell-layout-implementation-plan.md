# Viewport Shell Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left sidebar fill the viewport while the right workspace scrolls internally.

**Architecture:** Keep the layout contract in `App.tsx`, where the root `SidebarProvider` defines the viewport shell and the right `main` element becomes the scroll container. `AppSidebar` keeps its current visual design and only contributes full-height, non-shrinking sidebar sizing. Static renderer layout tests protect this contract.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest.

---

## File Structure

- Modify `renderer/App.tsx`: change shell classes from page-scroll layout to viewport-shell layout.
- Modify `renderer/components/app-sidebar.tsx`: ensure the sidebar is `h-svh` and `shrink-0`.
- Modify `tests/renderer/layout-constraints.test.ts`: add a shell scroll contract test and preserve paper background expectations.

## Task 1: Add Layout Contract Test

**Files:**
- Modify: `tests/renderer/layout-constraints.test.ts`

- [x] **Step 1: Write the failing test**

Add this test in `describe('renderer layout constraints', () => { ... })`:

```ts
it('uses a fixed viewport shell with right-side internal scrolling', () => {
  const appSource = fs.readFileSync(path.join(rendererRoot, 'App.tsx'), 'utf8');
  const sidebarSource = fs.readFileSync(
    path.join(rendererRoot, 'components/app-sidebar.tsx'),
    'utf8'
  );

  expect(appSource).toContain('h-svh overflow-hidden');
  expect(appSource).toContain('min-w-0 flex-1 overflow-hidden');
  expect(appSource).toContain('h-svh overflow-y-auto');
  expect(appSource).not.toContain('min-h-screen w-full p-5');
  expect(sidebarSource).toContain('h-svh shrink-0');
});
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/renderer/layout-constraints.test.ts -t "fixed viewport shell"
```

Expected: FAIL because `App.tsx` does not yet contain the viewport shell classes and still contains the old `min-h-screen w-full p-5` main layout.

## Task 2: Implement Viewport Shell Layout

**Files:**
- Modify: `renderer/App.tsx`
- Modify: `renderer/components/app-sidebar.tsx`

- [x] **Step 1: Update shell classes**

Change the root `SidebarProvider` class to include:

```tsx
className="app-paper-background h-svh overflow-hidden"
```

Change `SidebarInset` to include:

```tsx
className="app-paper-background min-w-0 flex-1 overflow-hidden"
```

Change `main` from the page-scroll layout to:

```tsx
<main className="h-svh overflow-y-auto w-full p-5">
```

Keep the existing inner grid and all page rendering logic unchanged.

- [x] **Step 2: Update sidebar sizing classes**

In `renderer/components/app-sidebar.tsx`, make the `Sidebar` class include both:

```tsx
h-svh shrink-0
```

Keep the current literary sidebar visual classes unchanged.

- [x] **Step 3: Run focused layout test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/renderer/layout-constraints.test.ts -t "fixed viewport shell"
```

Expected: PASS.

## Task 3: Regression And Browser Verification

**Files:**
- Test: `tests/renderer/layout-constraints.test.ts`
- Test: `tests/renderer/app-shell.test.tsx`

- [x] **Step 1: Run layout and app shell tests**

Run:

```bash
pnpm exec vitest run tests/renderer/layout-constraints.test.ts tests/renderer/app-shell.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [x] **Step 3: Verify in browser**

Open or reload `http://localhost:5173/` and confirm:

- the left sidebar fills the viewport height
- the right content area scrolls internally
- no body-level horizontal overflow appears
- the existing paper background remains visible
