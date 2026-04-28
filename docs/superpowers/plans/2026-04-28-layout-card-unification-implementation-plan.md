# Layout Card Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Story Weaver's layout cards across settings, new-book, book-detail, and standalone model-form surfaces without flattening the distinct visual treatment of content cards.

**Architecture:** Keep the base `Card` primitive generic, then add a dedicated layout-card styling contract in `renderer/components/ui/card.tsx` for page-level containers. Migrate page shells and detail panels to that contract, and protect the new design with layout constraint tests plus focused renderer regression tests.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest, Testing Library

---

## File Structure

- Modify: `renderer/components/ui/card.tsx`
  - Keep the generic `Card` primitive intact.
  - Export layout-card class helpers for shared page-container styling.
- Modify: `renderer/pages/Settings.tsx`
  - Replace bespoke layout card shell classes with the shared layout-card contract.
- Modify: `renderer/pages/NewBook.tsx`
  - Convert the intro panel and form shell to the shared layout-card language.
- Modify: `renderer/pages/BookDetail.tsx`
  - Rework the page header and `DetailSection` panels to use the shared layout-card classes.
- Modify: `renderer/components/ModelForm.tsx`
  - Make `variant="card"` use the same layout-card surface while leaving `variant="inline"` neutral.
- Modify: `tests/renderer/layout-constraints.test.ts`
  - Add source-level guardrails so layout containers use the shared layout-card contract instead of page-local ad hoc shells.
- Modify: `tests/renderer/new-book.test.tsx`
  - Add assertions that the intro and form shells expose the shared layout-card classes.
- Modify: `tests/renderer/book-detail.test.tsx`
  - Add assertions that the detail page uses the shared layout-card shell for the header and sections.
- Modify: `tests/renderer/settings.test.tsx`
  - Add assertions that settings cards no longer rely on hover shadow escalation and instead use the shared layout-card contract.

---

### Task 1: Define The Shared Layout-Card Contract

**Files:**
- Modify: `renderer/components/ui/card.tsx`
- Modify: `tests/renderer/layout-constraints.test.ts`

- [ ] **Step 1: Write the failing layout constraint test**

Add a source-level test that requires `card.tsx` to export a shared layout-card class contract and that key layout pages consume it. Extend `tests/renderer/layout-constraints.test.ts` with something like:

```ts
it('routes layout containers through the shared layout-card contract', () => {
  const cardSource = fs.readFileSync(path.join(rendererRoot, 'components/ui/card.tsx'), 'utf8');
  const settingsSource = fs.readFileSync(path.join(rendererRoot, 'pages/Settings.tsx'), 'utf8');
  const newBookSource = fs.readFileSync(path.join(rendererRoot, 'pages/NewBook.tsx'), 'utf8');
  const bookDetailSource = fs.readFileSync(path.join(rendererRoot, 'pages/BookDetail.tsx'), 'utf8');
  const modelFormSource = fs.readFileSync(
    path.join(rendererRoot, 'components/ModelForm.tsx'),
    'utf8'
  );

  expect(cardSource).toContain('export const layoutCardClassName');
  expect(cardSource).toContain('export const layoutCardHeaderClassName');
  expect(settingsSource).toContain('layoutCardClassName');
  expect(newBookSource).toContain('layoutCardClassName');
  expect(bookDetailSource).toContain('layoutCardClassName');
  expect(modelFormSource).toContain('layoutCardClassName');
});
```

- [ ] **Step 2: Run the layout constraint test and verify it fails**

Run:

```bash
pnpm vitest run tests/renderer/layout-constraints.test.ts --reporter=dot
```

Expected: FAIL because `layoutCardClassName` and `layoutCardHeaderClassName` are not exported or used yet.

- [ ] **Step 3: Add the shared layout-card helpers in `card.tsx`**

Update `renderer/components/ui/card.tsx` so it keeps the default card primitive and exports reusable layout-card helpers:

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

export const layoutCardClassName =
  "overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/95 text-card-foreground shadow-[0_12px_30px_rgba(36,28,18,0.06)] ring-1 ring-foreground/[0.03]"

export const layoutCardHeaderClassName =
  "border-b border-border/60 bg-gradient-to-br from-background via-card to-muted/30"

export const layoutCardMutedSectionClassName =
  "rounded-[1.15rem] border border-border/65 bg-card/95 px-5 py-5 shadow-[0_10px_24px_rgba(36,28,18,0.05)] ring-1 ring-foreground/[0.025]"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
```

Keep `CardHeader`, `CardContent`, `CardTitle`, and `CardDescription` generic so content cards such as `EmptyState` do not inherit the layout-card styling by accident.

- [ ] **Step 4: Re-run the layout constraint test**

Run:

```bash
pnpm vitest run tests/renderer/layout-constraints.test.ts --reporter=dot
```

Expected: still FAIL, but now only because the page files have not switched to the shared helpers yet.

- [ ] **Step 5: Commit the shared contract**

```bash
git add renderer/components/ui/card.tsx tests/renderer/layout-constraints.test.ts
git commit -m "feat: add shared layout card style contract"
```

---

### Task 2: Migrate Settings, New Book, And Model Form Layout Cards

**Files:**
- Modify: `renderer/pages/Settings.tsx`
- Modify: `renderer/pages/NewBook.tsx`
- Modify: `renderer/components/ModelForm.tsx`
- Modify: `tests/renderer/settings.test.tsx`
- Modify: `tests/renderer/new-book.test.tsx`

- [ ] **Step 1: Write the failing renderer tests for the shared layout-card usage**

Extend the focused renderer tests so they lock the layout surfaces to the shared classes.

In `tests/renderer/settings.test.tsx`, add:

```ts
it('uses the shared layout card shell for each settings block', () => {
  render(
    <Settings
      onSaveModel={vi.fn()}
      onTestModel={vi.fn()}
      models={[]}
      concurrencyLimit={null}
      onSaveSetting={vi.fn()}
    />
  );

  for (const block of screen.getAllByRole('listitem')) {
    expect(block.className).toContain('rounded-[1.35rem]');
    expect(block.className).toContain('ring-1');
    expect(block.className).not.toContain('hover:shadow');
  }
});
```

In `tests/renderer/new-book.test.tsx`, add:

```ts
it('renders the intro and form shells with the shared layout card treatment', () => {
  render(<NewBook onCreate={vi.fn()} />);

  expect(screen.getByTestId('new-book-intro-panel').className).toContain('rounded-[1.35rem]');
  expect(screen.getByTestId('new-book-form-panel').className).toContain('ring-1');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
pnpm vitest run tests/renderer/settings.test.tsx tests/renderer/new-book.test.tsx --reporter=dot
```

Expected: FAIL because the components do not yet expose the shared layout-card classes or test ids.

- [ ] **Step 3: Migrate `Settings`, `NewBook`, and `ModelForm` to the shared layout-card contract**

Update `renderer/pages/Settings.tsx` to import and use the shared helpers:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  layoutCardClassName,
  layoutCardHeaderClassName,
} from '../components/ui/card';

const settingCardClass = `mb-5 break-inside-avoid ${layoutCardClassName}`;
```

Use the header helper directly:

```tsx
<CardHeader className={layoutCardHeaderClassName}>
```

Update `renderer/pages/NewBook.tsx` so both the top intro shell and main form card use the same layout-card language:

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  layoutCardClassName,
  layoutCardHeaderClassName,
} from '../components/ui/card';

<div
  data-testid="new-book-intro-panel"
  className={`${layoutCardClassName} px-5 py-5`}
>
```

```tsx
<Card
  data-testid="new-book-form-panel"
  className={layoutCardClassName}
>
  <CardHeader className={`${layoutCardHeaderClassName} lg:border-b-0 lg:border-r`}>
```

Update `renderer/components/ModelForm.tsx` so the standalone card variant uses the same container shell:

```tsx
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  layoutCardClassName,
} from './ui/card';

className={
  isInline
    ? 'grid gap-5'
    : `grid gap-5 ${layoutCardClassName} p-6`
}
```

Do not add hover motion or heavier shadow escalation. `variant="inline"` should remain unchanged apart from inheriting spacing from its parent card content.

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
pnpm vitest run tests/renderer/settings.test.tsx tests/renderer/new-book.test.tsx --reporter=dot
```

Expected: PASS.

- [ ] **Step 5: Commit the migrated layout cards**

```bash
git add \
  renderer/pages/Settings.tsx \
  renderer/pages/NewBook.tsx \
  renderer/components/ModelForm.tsx \
  tests/renderer/settings.test.tsx \
  tests/renderer/new-book.test.tsx
git commit -m "feat: unify settings and new-book layout cards"
```

---

### Task 3: Migrate Book Detail Panels And Finish Regression Coverage

**Files:**
- Modify: `renderer/pages/BookDetail.tsx`
- Modify: `tests/renderer/book-detail.test.tsx`
- Modify: `tests/renderer/layout-constraints.test.ts`

- [ ] **Step 1: Write the failing book-detail layout regression test**

Extend `tests/renderer/book-detail.test.tsx` with a new assertion:

```ts
it('uses the shared layout card treatment for the page shell and detail sections', () => {
  render(
    <BookDetail
      book={{ title: 'Book 1', status: 'writing', wordCount: 12000 }}
      chapters={[]}
    />
  );

  expect(screen.getByTestId('book-detail-header').className).toContain('rounded-[1.35rem]');
  expect(screen.getByTestId('book-detail-header').className).toContain('ring-1');
  expect(screen.getByTestId('book-detail-empty-outline').className).toContain('border-dashed');
});
```

If the `DetailSection` helper does not yet expose a stable hook, add one or add a source-level assertion in `layout-constraints.test.ts` that checks for `layoutCardMutedSectionClassName` usage inside `BookDetail.tsx`.

- [ ] **Step 2: Run the focused book-detail and constraint tests**

Run:

```bash
pnpm vitest run tests/renderer/book-detail.test.tsx tests/renderer/layout-constraints.test.ts --reporter=dot
```

Expected: FAIL because `BookDetail` does not yet expose the shared layout-card classes or stable test ids.

- [ ] **Step 3: Migrate `BookDetail` to the shared layout-card contract**

Update the page imports:

```tsx
import {
  layoutCardClassName,
  layoutCardMutedSectionClassName,
} from '../components/ui/card';
```

Apply the shared layout-card shell to the top header:

```tsx
<header
  data-testid="book-detail-header"
  className={`grid gap-5 px-5 py-5 ${layoutCardClassName}`}
>
```

Update `DetailSection` to reuse the quieter inner-section helper:

```tsx
function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={layoutCardMutedSectionClassName}>
      <div className="mb-4 border-b border-border/70 pb-3">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}
```

Keep `DetailEmpty` visually lighter and dashed so empty states do not visually compete with actual content panels.

- [ ] **Step 4: Run the renderer regression suite for the affected pages**

Run:

```bash
pnpm vitest run \
  tests/renderer/book-detail.test.tsx \
  tests/renderer/settings.test.tsx \
  tests/renderer/new-book.test.tsx \
  tests/renderer/layout-constraints.test.ts \
  --reporter=dot
```

Expected: PASS.

- [ ] **Step 5: Run the renderer production build**

Run:

```bash
pnpm run build:renderer
```

Expected: Vite build succeeds and emits the renderer bundle without Tailwind class compilation errors.

- [ ] **Step 6: Commit the final layout-card unification**

```bash
git add \
  renderer/pages/BookDetail.tsx \
  tests/renderer/book-detail.test.tsx \
  tests/renderer/layout-constraints.test.ts
git commit -m "feat: unify book detail layout cards"
```

---

## Self-Review

### Spec coverage

- Shared layout-card contract for page-level containers: covered by Task 1.
- Keep layout cards static and avoid hover-heavy shadows: covered by Task 2 through the settings test and the shared helper contract.
- Migrate `Settings`, `NewBook`, `BookDetail`, and `ModelForm(card)`: covered by Tasks 2 and 3.
- Leave `BookCard`, `EmptyState`, and `ChapterList` alone: preserved by limiting the file list and keeping `Card` itself generic.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each test step includes an exact command and expected failure/pass condition.
- Each code step includes the concrete code shape to add or change.

### Type consistency

- The shared helper names stay consistent across all tasks:
  - `layoutCardClassName`
  - `layoutCardHeaderClassName`
  - `layoutCardMutedSectionClassName`

---

Plan complete and saved to `docs/superpowers/plans/2026-04-28-layout-card-unification-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
