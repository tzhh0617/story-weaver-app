# Creative Console Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Story Weaver renderer to a unified creative-console UI using Tailwind CSS and shadcn/ui while preserving existing writing workflows and tests.

**Architecture:** Add Tailwind and shadcn/ui as the renderer design system, define semantic theme tokens once, and then migrate shared primitives before retheming the four main pages. Keep Electron, IPC, and business logic intact; only change renderer styling structure and small UI-only interaction details needed for consistency.

**Tech Stack:** Electron, React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Radix primitives, Vitest, Testing Library

---

## File Structure

Create and keep these boundaries:

- `package.json`: add Tailwind and shadcn/ui dependencies plus setup scripts if needed.
- `tailwind.config.ts`: Tailwind theme extension, content globs, semantic color mapping.
- `postcss.config.js`: Tailwind PostCSS wiring for Vite.
- `components.json`: shadcn/ui configuration for paths, aliases, and styling base.
- `renderer/index.css`: new Tailwind entry with `@tailwind` directives, semantic CSS variables, and minimal global resets.
- `renderer/styles.css`: remove or drastically shrink legacy CSS after migration; keep only temporary compatibility if needed.
- `renderer/lib/utils.ts`: `cn` helper for shadcn/ui and local class composition.
- `renderer/components/ui/*`: shadcn/ui primitives (`button`, `input`, `textarea`, `select`, `card`, `badge`, `tabs`, `alert`, `separator`, `scroll-area`, `tooltip`).
- `renderer/components/BookCard.tsx`: restyle via Tailwind and shared primitives.
- `renderer/components/ChapterList.tsx`: restyle chapter list and status presentation.
- `renderer/components/ModelForm.tsx`: migrate form controls and selected/editing state layout.
- `renderer/components/ProgressBar.tsx`: convert to Tailwind token-driven progress display.
- `renderer/components/StatusBadge.tsx`: wrap `Badge` and semantic status tokens.
- `renderer/pages/Dashboard.tsx`: creative-console dashboard layout.
- `renderer/pages/NewBook.tsx`: writing task creation panel.
- `renderer/pages/Settings.tsx`: model/system configuration console.
- `renderer/pages/BookDetail.tsx`: single-book operations workspace with upgraded tabs and content cards.
- `tests/renderer/*.test.tsx`: update interaction and structural assertions only where styling migration changes semantics or DOM structure.

## Task 1: Install Tailwind And shadcn/ui Foundations

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `components.json`
- Create: `renderer/index.css`
- Create: `renderer/lib/utils.ts`
- Modify: `package.json`
- Modify: `renderer/main.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the failing integration test for the new CSS entry**

```tsx
// tests/renderer/app-shell.test.tsx
it('still renders the hero heading after the renderer style entry is swapped', async () => {
  installIpcMock(async (channel) => {
    switch (channel) {
      case 'book:list':
        return [];
      case 'model:list':
        return [];
      default:
        return null;
    }
  });

  render(<App />);

  expect(
    await screen.findByRole('heading', { name: 'AI Long-Form Fiction Studio' })
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted test before adding the new renderer CSS entry**

Run: `npm run test -- tests/renderer/app-shell.test.tsx`

Expected: PASS right now; after you change `renderer/main.tsx` to import a missing `renderer/index.css`, re-run and expect FAIL with a module resolution error for `./index.css`.

- [ ] **Step 3: Add Tailwind, PostCSS, shadcn config, and the renderer style entry**

```json
// package.json
{
  "devDependencies": {
    "tailwindcss": "^3.4.13",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2"
  }
}
```

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./renderer/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        border: 'hsl(var(--border))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        panel: '0 18px 48px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
```

```css
/* renderer/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 20% 96%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --border: 214 18% 85%;
    --primary: 199 89% 48%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 16% 93%;
    --muted-foreground: 215 16% 35%;
    --accent: 197 71% 73%;
    --accent-foreground: 222 47% 11%;
    --destructive: 0 72% 51%;
    --success: 142 71% 45%;
    --warning: 38 92% 50%;
    --radius: 1rem;
  }

  body {
    @apply bg-background text-foreground antialiased;
  }
}
```

```ts
// renderer/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```tsx
// renderer/main.tsx
import './index.css';
```

- [ ] **Step 4: Run the targeted renderer test and typecheck**

Run: `npm run test -- tests/renderer/app-shell.test.tsx && npm run typecheck`

Expected: PASS for the renderer test and TypeScript exits with code `0`.

- [ ] **Step 5: Commit the theme foundation**

```bash
git add package.json package-lock.json tailwind.config.ts postcss.config.js components.json renderer/index.css renderer/lib/utils.ts renderer/main.tsx
git commit -m "feat: add tailwind and shadcn foundation"
```

## Task 2: Add shadcn/ui Primitives And Semantic Theme Tokens

**Files:**
- Create: `renderer/components/ui/button.tsx`
- Create: `renderer/components/ui/input.tsx`
- Create: `renderer/components/ui/textarea.tsx`
- Create: `renderer/components/ui/select.tsx`
- Create: `renderer/components/ui/card.tsx`
- Create: `renderer/components/ui/badge.tsx`
- Create: `renderer/components/ui/tabs.tsx`
- Create: `renderer/components/ui/alert.tsx`
- Modify: `renderer/status-labels.ts`
- Modify: `renderer/styles.css`
- Test: `tests/renderer/status-badge.test.tsx`

- [ ] **Step 1: Write the failing badge test for semantic labels**

```tsx
// tests/renderer/status-badge.test.tsx
it('renders completed status inside a reusable badge surface', () => {
  render(<StatusBadge status="completed" />);

  const badge = screen.getByText('已完成');
  expect(badge.className).toMatch(/badge|inline-flex/);
});
```

- [ ] **Step 2: Run the badge test after removing the legacy-only implementation**

Run: `npm run test -- tests/renderer/status-badge.test.tsx`

Expected: FAIL once the current `StatusBadge` is replaced before the shared `Badge` primitive exists.

- [ ] **Step 3: Add the shared UI primitives and migrate the status badge**

```tsx
// renderer/components/ui/button.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-95',
        secondary: 'bg-muted text-foreground hover:bg-accent',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-white hover:brightness-95',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export function Button({
  className,
  variant,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
```

```tsx
// renderer/components/ui/badge.tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground',
        className
      )}
      {...props}
    />
  );
}
```

```tsx
// renderer/components/StatusBadge.tsx
import { Badge } from './ui/badge';
import { getStatusLabel } from '../status-labels';

export default function StatusBadge({ status }: { status: string }) {
  return <Badge className={`status-badge status-badge--${status}`}>{getStatusLabel(status)}</Badge>;
}
```

- [ ] **Step 4: Run the badge test and related renderer tests**

Run: `npm run test -- tests/renderer/status-badge.test.tsx tests/renderer/book-detail.test.tsx`

Expected: PASS for both test files.

- [ ] **Step 5: Commit the primitive layer**

```bash
git add renderer/components/ui renderer/components/StatusBadge.tsx renderer/status-labels.ts renderer/styles.css tests/renderer/status-badge.test.tsx
git commit -m "feat: add shared ui primitives"
```

## Task 3: Migrate Settings And NewBook To The New Form System

**Files:**
- Modify: `renderer/components/ModelForm.tsx`
- Modify: `renderer/pages/Settings.tsx`
- Modify: `renderer/pages/NewBook.tsx`
- Modify: `renderer/App.tsx`
- Test: `tests/renderer/settings.test.tsx`
- Test: `tests/renderer/new-book.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the failing test for selected-model editing and settings button states**

```tsx
// tests/renderer/settings.test.tsx
it('disables saving global settings when the value is unchanged or invalid', () => {
  render(
    <Settings
      onSaveModel={vi.fn()}
      onTestModel={vi.fn()}
      models={[]}
      onDeleteModel={vi.fn()}
      concurrencyLimit={1}
      onSaveSetting={vi.fn()}
    />
  );

  expect(screen.getByRole('button', { name: '保存设置' })).toBeDisabled();
});
```

```tsx
// tests/renderer/new-book.test.tsx
it('disables submit until the idea has content', () => {
  render(<NewBook onCreate={vi.fn()} />);

  expect(screen.getByRole('button', { name: '开始写作' })).toBeDisabled();
});
```

- [ ] **Step 2: Run the focused renderer tests**

Run: `npm run test -- tests/renderer/settings.test.tsx tests/renderer/new-book.test.tsx`

Expected: FAIL if the migrated form layer has not been implemented yet.

- [ ] **Step 3: Restyle and recompose Settings and NewBook with Tailwind/shadcn primitives**

```tsx
// renderer/pages/NewBook.tsx
export default function NewBook({ onCreate }: { onCreate: (input: { idea: string; targetWords: number }) => void }) {
  const [idea, setIdea] = useState('');
  const [targetWords, setTargetWords] = useState(500000);
  const canSubmit = idea.trim().length > 0;

  return (
    <Card className="border-border/70 bg-card/95 shadow-panel">
      <CardHeader>
        <CardTitle>新建作品</CardTitle>
        <CardDescription>输入故事钩子、核心冲突或主角目标。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Textarea value={idea} onChange={(event) => setIdea(event.target.value)} aria-label="IDEA" />
        <Input value={targetWords} onChange={(event) => setTargetWords(Number(event.target.value))} aria-label="目标字数" type="number" />
        <Button disabled={!canSubmit} onClick={() => onCreate({ idea, targetWords })}>开始写作</Button>
      </CardContent>
    </Card>
  );
}
```

```tsx
// renderer/pages/Settings.tsx
<Button type="button" variant="secondary" disabled={!canSaveSettings}>
  保存设置
</Button>
```

- [ ] **Step 4: Run the focused form tests and the shell test**

Run: `npm run test -- tests/renderer/settings.test.tsx tests/renderer/new-book.test.tsx tests/renderer/app-shell.test.tsx`

Expected: PASS for all three files.

- [ ] **Step 5: Commit the form migration**

```bash
git add renderer/components/ModelForm.tsx renderer/pages/Settings.tsx renderer/pages/NewBook.tsx renderer/App.tsx tests/renderer/settings.test.tsx tests/renderer/new-book.test.tsx tests/renderer/app-shell.test.tsx
git commit -m "feat: migrate settings and creation forms"
```

## Task 4: Migrate Dashboard To The Creative Console Layout

**Files:**
- Modify: `renderer/pages/Dashboard.tsx`
- Modify: `renderer/components/BookCard.tsx`
- Modify: `renderer/components/ProgressBar.tsx`
- Test: `tests/renderer/dashboard.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the failing dashboard test for richer empty and summary states**

```tsx
// tests/renderer/dashboard.test.tsx
it('shows an empty-state message when there are no books yet', () => {
  render(
    <Dashboard
      books={[]}
      scheduler={{
        runningBookIds: [],
        queuedBookIds: [],
        pausedBookIds: [],
        concurrencyLimit: 3,
      }}
    />
  );

  expect(screen.getByText('还没有作品，先创建第一本书。')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the dashboard and shell tests**

Run: `npm run test -- tests/renderer/dashboard.test.tsx tests/renderer/app-shell.test.tsx`

Expected: FAIL if the old dashboard structure still does not expose the new design semantics.

- [ ] **Step 3: Restyle dashboard and book cards**

```tsx
// renderer/pages/Dashboard.tsx
<section className="grid gap-6">
  <div className="grid gap-4 md:grid-cols-4">
    <Card>...</Card>
    <Card>...</Card>
    <Card>...</Card>
    <Card>...</Card>
  </div>
  <Card>
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>书架总览</CardTitle>
      <div className="flex gap-3">
        <Button disabled={!hasRunnableBooks}>全部开始</Button>
        <Button variant="secondary" disabled={!hasPausableBooks}>全部暂停</Button>
      </div>
    </CardHeader>
    <CardContent className="grid gap-4">
      {books.length === 0 ? <EmptyShelfState /> : <BookGrid />}
    </CardContent>
  </Card>
</section>
```

```tsx
// renderer/components/BookCard.tsx
<Card className="border-border/70 bg-card/95 shadow-panel">
  <CardHeader className="flex flex-row items-start justify-between">
    <CardTitle>{title}</CardTitle>
    <StatusBadge status={status} />
  </CardHeader>
  <CardContent className="grid gap-4">
    <ProgressBar value={progress} />
    <p className="text-sm text-muted-foreground">{`${completedChapters ?? 0}/${totalChapters} 章 · ${progress}%`}</p>
    <Button variant="secondary">查看详情</Button>
  </CardContent>
</Card>
```

- [ ] **Step 4: Run the dashboard-focused tests**

Run: `npm run test -- tests/renderer/dashboard.test.tsx tests/renderer/app-shell.test.tsx`

Expected: PASS for both files.

- [ ] **Step 5: Commit the dashboard migration**

```bash
git add renderer/pages/Dashboard.tsx renderer/components/BookCard.tsx renderer/components/ProgressBar.tsx tests/renderer/dashboard.test.tsx tests/renderer/app-shell.test.tsx
git commit -m "feat: migrate dashboard to creative console"
```

## Task 5: Migrate BookDetail To The Creative Console Workspace

**Files:**
- Modify: `renderer/pages/BookDetail.tsx`
- Modify: `renderer/components/ChapterList.tsx`
- Test: `tests/renderer/book-detail.test.tsx`
- Test: `tests/renderer/chapter-list.test.tsx`
- Test: `tests/renderer/app-shell.test.tsx`

- [ ] **Step 1: Write the failing detail test for explicit tab and action states**

```tsx
// tests/renderer/book-detail.test.tsx
it('disables export when no chapter content has been generated yet', () => {
  render(
    <BookDetail
      book={{ title: 'Book 1', status: 'building_outline', wordCount: 0 }}
      progress={{ phase: 'building_outline' }}
      chapters={[
        {
          id: '1-1',
          title: 'Chapter 1',
          wordCount: 0,
          status: 'queued',
          content: null,
          summary: null,
        },
      ]}
    />
  );

  expect(screen.getByRole('button', { name: '导出 TXT' })).toBeDisabled();
});
```

- [ ] **Step 2: Run the detail-focused tests before the migration is complete**

Run: `npm run test -- tests/renderer/book-detail.test.tsx tests/renderer/chapter-list.test.tsx tests/renderer/app-shell.test.tsx`

Expected: FAIL if any of the new tab states, empty states, or action guards are not implemented.

- [ ] **Step 3: Restyle BookDetail and ChapterList**

```tsx
// renderer/pages/BookDetail.tsx
<Card className="border-border/70 bg-card/95 shadow-panel">
  <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>...</div>
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary" disabled={!canPause}>暂停</Button>
      <Button disabled={!canResume}>恢复写作</Button>
      <Button variant="outline">重新开始</Button>
      <Button variant="outline" disabled={!canWrite}>写下一章</Button>
      <Button variant="outline" disabled={!canWrite}>连续写作</Button>
      <Button variant="secondary" disabled={!hasGeneratedContent}>导出 TXT</Button>
      <Button variant="secondary" disabled={!hasGeneratedContent}>导出 MD</Button>
      <Button variant="destructive">删除作品</Button>
    </div>
  </CardHeader>
  <CardContent className="grid gap-6">
    <Tabs defaultValue="outline">...</Tabs>
  </CardContent>
</Card>
```

```tsx
// renderer/components/ChapterList.tsx
<ul className="grid gap-3">
  {chapters.map((chapter) => (
    <li key={chapter.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/40 px-4 py-3">
      <span className="font-medium">{chapter.title}</span>
      <span className="text-sm text-muted-foreground">{`${chapter.wordCount} 字 · ${chapterStatusLabels[chapter.status]}`}</span>
    </li>
  ))}
</ul>
```

- [ ] **Step 4: Run the detail-related test set**

Run: `npm run test -- tests/renderer/book-detail.test.tsx tests/renderer/chapter-list.test.tsx tests/renderer/app-shell.test.tsx`

Expected: PASS for all three files.

- [ ] **Step 5: Commit the book detail migration**

```bash
git add renderer/pages/BookDetail.tsx renderer/components/ChapterList.tsx tests/renderer/book-detail.test.tsx tests/renderer/chapter-list.test.tsx tests/renderer/app-shell.test.tsx
git commit -m "feat: migrate book detail workspace"
```

## Task 6: Remove Legacy Renderer CSS And Finalize State Consistency

**Files:**
- Modify: `renderer/styles.css`
- Modify: `renderer/index.css`
- Test: `tests/renderer/*.test.tsx`

- [ ] **Step 1: Write the failing renderer assertion for the new selected-state semantics**

```tsx
// tests/renderer/settings.test.tsx
it('marks the selected saved model entry as pressed', () => {
  render(
    <Settings
      onSaveModel={vi.fn()}
      onTestModel={vi.fn()}
      models={[
        {
          id: 'deepseek:deepseek-chat',
          modelName: 'deepseek-chat',
          provider: 'deepseek',
        },
      ]}
      onDeleteModel={vi.fn()}
      concurrencyLimit={null}
      onSaveSetting={vi.fn()}
    />
  );

  fireEvent.click(screen.getByText('deepseek-chat · deepseek'));

  expect(screen.getByRole('button', { name: 'deepseek-chat · deepseek' })).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 2: Run the full renderer test suite**

Run: `npm run test -- tests/renderer/settings.test.tsx tests/renderer/dashboard.test.tsx tests/renderer/book-detail.test.tsx tests/renderer/new-book.test.tsx tests/renderer/app-shell.test.tsx`

Expected: Any remaining failures should expose state inconsistencies or DOM assumptions that still depend on the legacy CSS structure.

- [ ] **Step 3: Delete or minimize obsolete CSS selectors**

```css
/* renderer/styles.css */
/* Keep only temporary compatibility selectors that are still referenced.
   Move all current surface, button, input, badge, tab, card, and spacing rules
   into Tailwind classes or `renderer/index.css` base layers. */
```

```css
/* renderer/index.css */
@layer components {
  .empty-state-card {
    @apply rounded-2xl border border-dashed border-border bg-card/80 p-6 text-sm text-muted-foreground;
  }
}
```

- [ ] **Step 4: Run full verification**

Run: `npm run test && npm run typecheck && npm run build`

Expected: All tests pass, TypeScript exits with code `0`, and Vite/Electron builds complete successfully.

- [ ] **Step 5: Commit the final cleanup**

```bash
git add renderer/index.css renderer/styles.css renderer tests
git commit -m "feat: finalize creative console theme"
```

## Self-Review

### Spec Coverage

Covered requirements:

- Tailwind + shadcn/ui foundation: Task 1 and Task 2
- Theme tokens and shared primitives: Task 1 and Task 2
- Unified page migration: Task 3, Task 4, Task 5
- Empty/disabled/selected state normalization: Task 3 through Task 6
- Responsive, layered, console-style page presentation: Task 3 through Task 5

No gaps found against the current theme spec.

### Placeholder Scan

- No `TODO`, `TBD`, or “implement later” language in tasks
- Every task has explicit files, commands, and code examples
- No “similar to task above” shortcuts

### Type Consistency

- Shared renderer utility path is consistently `renderer/lib/utils.ts`
- Tailwind entry is consistently `renderer/index.css`
- Shared primitives are consistently under `renderer/components/ui`
- The four page migration tasks match the spec order: Settings, NewBook, Dashboard, BookDetail

Plan complete and saved to `docs/superpowers/plans/2026-04-28-creative-console-theme-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach? 
