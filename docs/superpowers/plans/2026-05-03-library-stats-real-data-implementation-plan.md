# Library Stats Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the library home screen summary metrics show real business counts without changing the current layout.

**Architecture:** Keep the change renderer-only. Reuse the existing `books` and `scheduler` props already passed into `Library`, add a focused renderer test for the metric contract, then simplify the `完成` metric so all four cards are backed by real values.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

## File Structure

- Modify: `tests/renderer/library.test.tsx`
  Add a focused assertion for the four metric cards and remove tolerance for placeholder values.
- Modify: `renderer/pages/Library.tsx`
  Replace the hardcoded completion display with a real count while preserving the existing UI structure.

## Task 1: Lock The Metric Contract With A Failing Test

**Files:**
- Modify: `tests/renderer/library.test.tsx`
- Test: `tests/renderer/library.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test near the workspace stats coverage:

```tsx
  it('renders library stats from live business data instead of placeholders', () => {
    render(
      <Library
        books={[
          {
            id: 'book-1',
            title: '北境遗城',
            idea: '旧王朝复苏。',
            status: 'completed',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
          {
            id: 'book-2',
            title: '南海灯塔',
            idea: '灯塔记录每一场风暴。',
            status: 'paused',
            targetChapters: 500,
            wordsPerChapter: 2500,
            updatedAt: '2026-04-28T12:00:00.000Z',
            createdAt: '2026-04-28T10:00:00.000Z',
          },
        ]}
        scheduler={{
          runningBookIds: ['book-3', 'book-4'],
          queuedBookIds: ['book-5'],
          pausedBookIds: ['book-2', 'book-6', 'book-7'],
          concurrencyLimit: 3,
        }}
        onSelectBook={vi.fn()}
        onStartAll={vi.fn()}
        onPauseAll={vi.fn()}
      />
    );

    expect(screen.getByText('完成')).toBeInTheDocument();
    expect(screen.getByText('写作中')).toBeInTheDocument();
    expect(screen.getByText('排队')).toBeInTheDocument();
    expect(screen.getByText('已暂停')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('1/50')).toBeNull();
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm test -- --run tests/renderer/library.test.tsx
```

Expected: FAIL because `完成` still renders `1/50`.

- [ ] **Step 3: Implement the minimal renderer change**

Update the metric construction in `renderer/pages/Library.tsx`:

```tsx
  const shelfStats = [
    { label: '完成', value: completedCount },
    { label: '写作中', value: scheduler.runningBookIds.length },
    { label: '排队', value: scheduler.queuedBookIds.length },
    { label: '已暂停', value: scheduler.pausedBookIds.length },
  ];
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
pnpm test -- --run tests/renderer/library.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run a quick renderer safety check**

Run:

```bash
pnpm test -- --run tests/renderer/library.test.tsx tests/renderer/app-shell.test.tsx
```

Expected: PASS.
