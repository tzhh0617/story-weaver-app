# Literary Sidebar Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire left sidebar menu into a restrained bookplate/study style while preserving existing navigation behavior.

**Architecture:** Keep the change local to the renderer shell. `AppSidebar` owns the sidebar markup and visual treatment; existing shadcn sidebar primitives keep accessibility and active-state attributes intact. Tests stay focused on the public contract: brand group, accessible navigation buttons, and active state.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, lucide-react, Vitest, Testing Library.

---

## File Structure

- Modify `renderer/components/app-sidebar.tsx`: update the sidebar container, brand block, and navigation row classes/markup.
- Modify `tests/renderer/app-shell.test.tsx`: update the existing brand/sidebar contract test to expect the new literary text lockup and unchanged accessible buttons.

## Task 1: Lock the Sidebar Contract With a Failing Test

**Files:**
- Modify: `tests/renderer/app-shell.test.tsx`

- [x] **Step 1: Update the existing safe-empty preview test**

Replace the brand assertion block in `renders a safe empty preview when Electron IPC is unavailable` with:

```tsx
expect(
  await screen.findByRole('group', { name: 'Story Weaver brand' })
).toBeInTheDocument();
expect(screen.getByText('Story Weaver')).toBeInTheDocument();
expect(screen.getByText('藏书工坊')).toBeInTheDocument();
expect(await screen.findByAltText('Story Weaver logo')).toHaveAttribute(
  'src',
  expect.stringContaining('story-weaver-logo-white')
);
expect(screen.getByRole('button', { name: '作品' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '设置' })).toBeInTheDocument();
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tests/renderer/app-shell.test.tsx -t "renders a safe empty preview"
```

Expected: FAIL because `Story Weaver` and `藏书工坊` are not currently rendered in the sidebar brand block.

## Task 2: Implement the Literary Sidebar Menu

**Files:**
- Modify: `renderer/components/app-sidebar.tsx`

- [x] **Step 1: Update the sidebar visual classes**

Keep the existing `AppView`, `navigationItems`, and `isLibraryView` logic. Replace only the JSX class treatment so the sidebar uses:

- a warmer, layered study-shell background
- a parchment bookplate-style brand block
- centered logo plus `Story Weaver` and `藏书工坊`
- bookmark-like navigation rows with a narrow active spine line
- seal-like icon marks

- [x] **Step 2: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec vitest run tests/renderer/app-shell.test.tsx -t "renders a safe empty preview"
```

Expected: PASS.

## Task 3: Regression Check the App Shell

**Files:**
- Test: `tests/renderer/app-shell.test.tsx`

- [x] **Step 1: Run the app shell suite**

Run:

```bash
pnpm exec vitest run ../tests/renderer/app-shell.test.tsx
```

Expected: PASS. Existing tests should still find accessible `作品` and `设置` buttons, and the `作品` button should remain active for library/detail/new-book views.

- [x] **Step 2: Review the final diff**

Run:

```bash
git diff -- renderer/components/app-sidebar.tsx tests/renderer/app-shell.test.tsx
```

Expected: In a dirty worktree, the reviewed hunk scope for this change is limited to sidebar visual markup/classes and the sidebar brand/navigation contract assertions.
