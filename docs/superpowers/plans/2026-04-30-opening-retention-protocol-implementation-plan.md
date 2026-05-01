# Opening Retention Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-five-chapters opening retention protocol to the existing narrative generation, routing, audit, and Book Detail surfaces.

**Architecture:** Reuse the current narrative control loop. Add a focused helper for opening retention phase text, feed it into chapter-card and tension-budget prompts, strengthen the `design_opening` route, make audit decisions chapter-aware for the first three chapters, and show the selected opening phase in the existing context panel.

**Tech Stack:** TypeScript, Vitest, React Testing Library, React 19, Tailwind, Electron app core modules.

---

## File Structure

- Create `src/core/narrative/opening-retention.ts`
  - Owns the first-five-chapter protocol constants and small formatting helpers.
  - Exports `getOpeningRetentionPhase`, `buildOpeningRetentionProtocolLines`, and `buildOpeningRetentionContextLines`.

- Modify `src/core/narrative/prompts.ts`
  - Imports opening retention helper.
  - Adds protocol text to `buildChapterCardPrompt` and `buildTensionBudgetPrompt`.

- Modify `src/core/story-router/router.ts`
  - Adds `chapter-goal` and `pacing-audit` to `design_opening`.

- Modify `src/core/narrative/audit.ts`
  - Adds an optional `context` parameter to `decideAuditAction`.
  - Applies stricter first-three-chapter flatness thresholds.

- Modify `src/core/book-service.ts`
  - Passes current chapter index into `decideAuditAction`.
  - Adds opening retention context to the route plan text for chapters 1-5.

- Modify `renderer/pages/BookDetail.tsx`
  - Shows a compact opening retention section for selected chapters 1-5.

- Modify tests:
  - `tests/core/narrative-prompts.test.ts`
  - `tests/core/story-router.test.ts`
  - `tests/core/narrative-audit-state-checkpoint.test.ts`
  - `tests/renderer/book-detail.test.tsx`

---

### Task 1: Opening Retention Prompt Helper

**Files:**
- Create: `src/core/narrative/opening-retention.ts`
- Modify: `src/core/narrative/prompts.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Add these tests to `tests/core/narrative-prompts.test.ts` inside the `describe('narrative prompts', () => { ... })` block:

```ts
  it('injects the opening retention protocol into chapter card prompts', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '题材：命运悬疑。',
      volumePlansText: '第一卷：旧页初鸣，1-20章。',
    });

    expect(prompt).toContain('Opening Retention Protocol');
    expect(prompt).toContain('Chapter 1: abnormal entry');
    expect(prompt).toContain('Chapter 2: rising cost');
    expect(prompt).toContain('Chapter 3: irreversible entry');
    expect(prompt).toContain('Chapter 4: first clear reward');
    expect(prompt).toContain('Chapter 5: long-term hostility');
  });

  it('injects the opening tension curve into tension budget prompts', () => {
    const prompt = buildTensionBudgetPrompt({
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: 'theme: freedom requires cost',
      volumePlansText: 'Volume 1: chapters 1-20',
      chapterCardsText: 'Chapter 1: must change',
    });

    expect(prompt).toContain('Opening Retention Protocol');
    expect(prompt).toContain('Recommended opening pressure curve');
    expect(prompt).toContain('medium -> high -> peak -> medium/high -> high');
    expect(prompt).toContain('Do not solve all opening questions by chapter 5');
  });

  it('compresses opening retention guidance for short books', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 3,
      bibleSummary: '题材：短篇悬疑。',
      volumePlansText: '第一卷：1-3章。',
    });

    expect(prompt).toContain('Compressed opening retention for short books');
    expect(prompt).toContain('Chapter 1 still performs abnormal entry');
    expect(prompt).toContain('The final available opening chapter performs irreversible entry');
  });
```

- [ ] **Step 2: Run prompt tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts
```

Expected: FAIL. The new assertions should fail because prompts do not yet contain `Opening Retention Protocol`.

- [ ] **Step 3: Create the opening retention helper**

Create `src/core/narrative/opening-retention.ts`:

```ts
export type OpeningRetentionPhase = {
  chapterIndex: number;
  label: string;
  englishLabel: string;
  requiredEffect: string;
};

export const OPENING_RETENTION_PHASES: OpeningRetentionPhase[] = [
  {
    chapterIndex: 1,
    label: '异常入场',
    englishLabel: 'abnormal entry',
    requiredEffect:
      'Start with abnormality, desire, conflict, danger, or an unanswered question within the opening paragraphs.',
  },
  {
    chapterIndex: 2,
    label: '问题变贵',
    englishLabel: 'rising cost',
    requiredEffect:
      'Make the chapter 1 problem visibly more expensive through status loss, relationship strain, resource cost, or danger.',
  },
  {
    chapterIndex: 3,
    label: '不可逆入局',
    englishLabel: 'irreversible entry',
    requiredEffect:
      'Force a choice that makes the protagonist unable to return to the old safe life.',
  },
  {
    chapterIndex: 4,
    label: '首次明确回报',
    englishLabel: 'first clear reward',
    requiredEffect:
      'Give the reader a breakthrough, truth, upgrade, ally, or partial victory, but attach a side effect.',
  },
  {
    chapterIndex: 5,
    label: '长线敌意',
    englishLabel: 'long-term hostility',
    requiredEffect:
      'Reveal that a larger hostile force, unresolved mystery, or long-term pressure is now aimed at the protagonist.',
  },
];

export function getOpeningRetentionPhase(chapterIndex: number) {
  return (
    OPENING_RETENTION_PHASES.find(
      (phase) => phase.chapterIndex === chapterIndex
    ) ?? null
  );
}

export function buildOpeningRetentionProtocolLines(input: {
  targetChapters: number;
}) {
  const lines = [
    'Opening Retention Protocol:',
    'For the first five chapters, treat opening retention as stricter than normal chapter pacing.',
    'Chapter 1: abnormal entry. Pull the protagonist out of ordinary life through abnormality, desire, conflict, danger, or an unanswered question.',
    'Chapter 2: rising cost. Make the opening problem visibly more expensive and harder to dismiss.',
    'Chapter 3: irreversible entry. Force a choice that prevents return to the old safe life.',
    'Chapter 4: first clear reward. Give a breakthrough, truth, upgrade, ally, identity, or partial victory with a side effect.',
    'Chapter 5: long-term hostility. Convert short hooks into a durable hostile force, mystery, or long-term pressure.',
    'Recommended opening pressure curve: medium -> high -> peak -> medium/high -> high.',
    'Do not solve all opening questions by chapter 5; answer one question while creating a larger one.',
  ];

  if (input.targetChapters < 5) {
    lines.push(
      'Compressed opening retention for short books:',
      'Chapter 1 still performs abnormal entry.',
      'The final available opening chapter performs irreversible entry.',
      'Any middle opening chapter performs rising cost or first clear reward.'
    );
  }

  return lines;
}

export function buildOpeningRetentionContextLines(chapterIndex: number) {
  const phase = getOpeningRetentionPhase(chapterIndex);

  if (!phase) {
    return [];
  }

  return [
    'Opening retention phase:',
    `Current opening phase: chapter ${phase.chapterIndex} - ${phase.label} (${phase.englishLabel})`,
    `Required opening effect: ${phase.requiredEffect}`,
  ];
}
```

- [ ] **Step 4: Inject helper output into narrative prompts**

Modify `src/core/narrative/prompts.ts`.

Add the import:

```ts
import { buildOpeningRetentionProtocolLines } from './opening-retention.js';
```

In `buildChapterCardPrompt`, add these lines after the existing chapter-card requirements:

```ts
    ...buildOpeningRetentionProtocolLines({
      targetChapters: input.targetChapters,
    }),
```

In `buildTensionBudgetPrompt`, add these lines after the existing anti-repetition pressure rules:

```ts
    ...buildOpeningRetentionProtocolLines({
      targetChapters: input.targetChapters,
    }),
```

- [ ] **Step 5: Run prompt tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/narrative/opening-retention.ts src/core/narrative/prompts.ts tests/core/narrative-prompts.test.ts
git commit -m "feat: add opening retention prompt protocol"
```

---

### Task 2: Opening Route and Write Context

**Files:**
- Modify: `src/core/story-router/router.ts`
- Modify: `src/core/story-router/prompt-rules.ts`
- Modify: `src/core/book-service.ts`
- Test: `tests/core/story-router.test.ts`

- [ ] **Step 1: Write failing route tests**

Add this test to `tests/core/story-router.test.ts`:

```ts
  it('routes opening design through chapter goal and pacing audit', () => {
    const plan = routeStoryTask({
      taskType: 'design_opening',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    expect(plan.requiredSkills.map((skill) => skill.id)).toEqual([
      'story-structure',
      'chapter-goal',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'genre-pattern',
      'pacing-audit',
    ]);
  });
```

Extend the existing `formats route plans for prompt injection` test:

```ts
    expect(text).toContain('Opening Retention');
```

- [ ] **Step 2: Run router tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/core/story-router.test.ts
```

Expected: FAIL. The `design_opening` route does not include `chapter-goal` or `pacing-audit`, and formatted route plans do not include opening retention text.

- [ ] **Step 3: Add opening skills to the route**

Modify `src/core/story-router/router.ts` so `design_opening.required` is:

```ts
  design_opening: {
    required: [
      'story-structure',
      'chapter-goal',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'genre-pattern',
      'pacing-audit',
    ],
    optional: [],
  },
```

- [ ] **Step 4: Add optional opening context to formatted route text**

Modify `src/core/story-router/types.ts`.

Add this property to `StoryRoutePlan`:

```ts
  openingRetentionLines?: string[];
```

Modify `src/core/story-router/router.ts` to keep returning no opening lines by default:

```ts
    openingRetentionLines: [],
```

Modify `src/core/story-router/prompt-rules.ts` by importing the helper:

```ts
import { buildOpeningRetentionProtocolLines } from '../narrative/opening-retention.js';
```

Then add an opening section before `Warnings` in `formatStoryRoutePlanForPrompt`:

```ts
    ...renderSection(
      'Opening Retention',
      plan.openingRetentionLines?.length
        ? plan.openingRetentionLines
        : buildOpeningRetentionProtocolLines({ targetChapters: 5 })
    ),
    '',
```

- [ ] **Step 5: Add current-chapter opening context in write flow**

Modify `src/core/book-service.ts`.

Add the import:

```ts
import { buildOpeningRetentionContextLines } from './narrative/opening-retention.js';
```

After `const storyRoutePlan = routeStoryTask({ ... })`, add:

```ts
      const openingRetentionLines = buildOpeningRetentionContextLines(
        nextChapter.chapterIndex
      );
      const routePlanText = formatStoryRoutePlanForPrompt({
        ...storyRoutePlan,
        openingRetentionLines,
      });
```

Remove the old line:

```ts
      const routePlanText = formatStoryRoutePlanForPrompt(storyRoutePlan);
```

- [ ] **Step 6: Run router tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/core/story-router.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/core/story-router/router.ts src/core/story-router/types.ts src/core/story-router/prompt-rules.ts src/core/book-service.ts tests/core/story-router.test.ts
git commit -m "feat: add opening retention route context"
```

---

### Task 3: Chapter-Aware Opening Audit Decisions

**Files:**
- Modify: `src/core/narrative/audit.ts`
- Modify: `src/core/book-service.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`

- [ ] **Step 1: Write failing audit decision tests**

Add these tests to the `describe('narrative audit helpers', () => { ... })` block in `tests/core/narrative-audit-state-checkpoint.test.ts`:

```ts
  it('revises first-three chapters when hook strength is below opening retention threshold', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 80,
              choicePressure: 75,
              consequenceVisibility: 80,
              irreversibleChange: 80,
              hookStrength: 79,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 1 }
      )
    ).toBe('revise');
  });

  it('keeps later chapters on regular flatness thresholds', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 80,
              choicePressure: 75,
              consequenceVisibility: 80,
              irreversibleChange: 80,
              hookStrength: 79,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 8 }
      )
    ).toBe('accept');
  });

  it('rewrites first-three chapters with flat chapter issues', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 86,
          decision: 'accept',
          issues: [
            {
              type: 'flat_chapter',
              severity: 'major',
              evidence: '有事件但没有选择、代价或变化。',
              fixInstruction: '重写为有可见选择和不可逆变化的开篇章。',
            },
          ],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 75,
              choicePressure: 75,
              consequenceVisibility: 80,
              irreversibleChange: 80,
              hookStrength: 82,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 3 }
      )
    ).toBe('rewrite');
  });
```

- [ ] **Step 2: Run audit tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: FAIL. `decideAuditAction` does not accept the chapter context yet.

- [ ] **Step 3: Add chapter-aware audit rules**

Modify `src/core/narrative/audit.ts`:

```ts
import type { AuditDecision, NarrativeAudit } from './types.js';

type AuditActionContext = {
  chapterIndex?: number | null;
};

function isOpeningStrictChapter(chapterIndex?: number | null) {
  return typeof chapterIndex === 'number' && chapterIndex >= 1 && chapterIndex <= 3;
}

export function decideAuditAction(
  audit: NarrativeAudit,
  context: AuditActionContext = {}
): AuditDecision {
  if (audit.issues.some((issue) => issue.severity === 'blocker')) {
    return 'rewrite';
  }

  if (
    isOpeningStrictChapter(context.chapterIndex) &&
    audit.issues.some((issue) => issue.type === 'flat_chapter')
  ) {
    return 'rewrite';
  }

  const flatness = audit.scoring.flatness;
  if (flatness) {
    const flatnessAverage =
      (flatness.conflictEscalation +
        flatness.choicePressure +
        flatness.consequenceVisibility +
        flatness.irreversibleChange +
        flatness.hookStrength) /
      5;

    if (flatnessAverage < 60) return 'rewrite';

    if (isOpeningStrictChapter(context.chapterIndex)) {
      if (
        flatness.hookStrength < 80 ||
        flatness.choicePressure < 70 ||
        flatness.irreversibleChange < 75 ||
        audit.issues.some((issue) => issue.type === 'soft_hook')
      ) {
        return 'revise';
      }
    }

    if (
      flatness.choicePressure < 60 ||
      flatness.consequenceVisibility < 60 ||
      flatness.irreversibleChange < 70
    ) {
      return 'revise';
    }
  }

  if (!audit.passed || audit.score < 80) {
    return audit.score < 60 ? 'rewrite' : 'revise';
  }
  if (audit.issues.some((issue) => issue.severity === 'major')) {
    return 'revise';
  }
  return audit.decision === 'rewrite' || audit.decision === 'revise'
    ? audit.decision
    : 'accept';
}
```

- [ ] **Step 4: Pass chapter index from book service**

Modify the audit action line in `src/core/book-service.ts`:

```ts
        const auditAction = decideAuditAction(audit, {
          chapterIndex: nextChapter.chapterIndex,
        });
```

- [ ] **Step 5: Run audit tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run related book service tests**

Run:

```bash
pnpm exec vitest run tests/core/book-service.test.ts tests/core/narrative-book-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/narrative/audit.ts src/core/book-service.ts tests/core/narrative-audit-state-checkpoint.test.ts
git commit -m "feat: tighten opening chapter audit rules"
```

---

### Task 4: Book Detail Opening Retention Panel

**Files:**
- Modify: `renderer/pages/BookDetail.tsx`
- Test: `tests/renderer/book-detail.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

Add this test to `tests/renderer/book-detail.test.tsx`:

```tsx
  it('shows opening retention guidance for selected opening chapters', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        narrative={{
          chapterTensionBudgets: [
            {
              bookId: 'book-1',
              volumeIndex: 1,
              chapterIndex: 1,
              pressureLevel: 'medium',
              dominantTension: 'mystery',
              requiredTurn: '旧页主动回应林牧。',
              forcedChoice: '隐藏旧页或求助。',
              costToPay: '失去安全感。',
              irreversibleChange: '林牧开始追查。',
              readerQuestion: '为什么偏偏是林牧？',
              hookPressure: '有人知道旧页在他手里。',
              flatnessRisks: ['不要解释开局。'],
            },
          ],
        }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: '第一章正文',
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('开篇留存')).toBeInTheDocument();
    expect(within(contextPanel).getByText('第 1 章 · 异常入场')).toBeInTheDocument();
    expect(within(contextPanel).getByText('读者问题')).toBeInTheDocument();
    expect(within(contextPanel).getByText('为什么偏偏是林牧？')).toBeInTheDocument();
    expect(within(contextPanel).getByText('章末压力')).toBeInTheDocument();
    expect(within(contextPanel).getByText('有人知道旧页在他手里。')).toBeInTheDocument();
  });

  it('does not show opening retention guidance after chapter five', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-6',
            volumeIndex: 1,
            chapterIndex: 6,
            title: 'Chapter 6',
            wordCount: 1200,
            status: 'done',
            content: '第六章正文',
          },
        ]}
      />
    );

    expect(screen.getByLabelText('上下文面板')).not.toHaveTextContent('开篇留存');
  });
```

- [ ] **Step 2: Run renderer tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/renderer/book-detail.test.tsx
```

Expected: FAIL. The Book Detail page does not render an opening retention section.

- [ ] **Step 3: Add opening retention helpers to Book Detail**

Modify `renderer/pages/BookDetail.tsx`.

Add this near the existing label constants:

```ts
const openingRetentionLabels: Record<number, string> = {
  1: '异常入场',
  2: '问题变贵',
  3: '不可逆入局',
  4: '首次明确回报',
  5: '长线敌意',
};

function getOpeningRetentionLabel(chapterIndex?: number | null) {
  if (typeof chapterIndex !== 'number') {
    return null;
  }

  return openingRetentionLabels[chapterIndex] ?? null;
}
```

Add this component after `TensionBudgetSection`:

```tsx
function OpeningRetentionSection({
  chapterIndex,
  budget,
}: {
  chapterIndex: number;
  budget: ChapterTensionBudgetView | null;
}) {
  const label = getOpeningRetentionLabel(chapterIndex);

  if (!label) {
    return null;
  }

  return (
    <DetailSection title="开篇留存">
      <div className="grid gap-3">
        <p className="text-xs font-semibold text-foreground">
          {`第 ${chapterIndex} 章 · ${label}`}
        </p>
        {budget ? (
          <dl className="grid gap-2">
            <div>
              <dt className="text-xs font-semibold text-foreground">读者问题</dt>
              <dd>{budget.readerQuestion}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">章末压力</dt>
              <dd>{budget.hookPressure}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">代价</dt>
              <dd>{budget.costToPay}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">不可逆变化</dt>
              <dd>{budget.irreversibleChange}</dd>
            </div>
          </dl>
        ) : (
          <p>等待张力预算生成后显示读者问题、代价和章末压力。</p>
        )}
      </div>
    </DetailSection>
  );
}
```

In the component body, add:

```ts
  const selectedOpeningRetentionLabel = getOpeningRetentionLabel(
    selectedChapter?.chapterIndex
  );
```

Update `hasOutlineTabContent` to include:

```ts
      Boolean(selectedOpeningRetentionLabel) ||
```

In the outline tab content before `StoryRouteSection`, render:

```tsx
                      {selectedChapter?.chapterIndex &&
                      selectedOpeningRetentionLabel ? (
                        <OpeningRetentionSection
                          chapterIndex={selectedChapter.chapterIndex}
                          budget={selectedTensionBudget}
                        />
                      ) : null}
```

- [ ] **Step 4: Run renderer tests to verify they pass**

Run:

```bash
pnpm exec vitest run tests/renderer/book-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run renderer test subset**

Run:

```bash
pnpm exec vitest run tests/renderer/book-detail.test.tsx tests/renderer/layout-constraints.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add renderer/pages/BookDetail.tsx tests/renderer/book-detail.test.tsx
git commit -m "feat: show opening retention context"
```

---

### Task 5: Final Verification

**Files:**
- No new files.
- Verifies all changed modules together.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/story-router.test.ts tests/core/narrative-audit-state-checkpoint.test.ts tests/renderer/book-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Review git diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: clean working tree if every task was committed, or only intended uncommitted final tweaks.

---

## Self-Review

- Spec coverage: The plan covers prompt generation, current-chapter context, `design_opening` routing, stricter first-three-chapter audit decisions, and Book Detail opening guidance.
- Placeholder scan: No TBD, TODO, “implement later”, or unspecified test steps remain.
- Type consistency: `openingRetentionLines` is optional on `StoryRoutePlan`, route formatting handles missing values, and `decideAuditAction` remains backward compatible through a default context parameter.
