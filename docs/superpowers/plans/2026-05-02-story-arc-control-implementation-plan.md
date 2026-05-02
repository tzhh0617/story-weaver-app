# Story Arc Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend generation and audit guardrails so titles stay compelling, openings hook while entering the mainline, chapters do not drift, and endings hook with convergence.

**Architecture:** Add one compact story arc protocol helper to narrative prompts, strengthen the existing opening retention protocol, extend audit issue types and decision rules, and align the story router guidance. The first implementation uses existing stored fields and avoids frontend or database changes.

**Tech Stack:** TypeScript, pnpm workspace, Vitest, backend narrative core, story-router prompt injection.

---

## File Structure

- Modify `packages/backend/src/core/narrative/prompts.ts`: add `buildStoryArcControlProtocolLines()` and inject it into planning, drafting, auditing, and revision prompts.
- Modify `packages/backend/src/core/narrative/opening-retention.ts`: add title-promise and mainline-entry language to first-five-chapter guidance.
- Modify `packages/backend/src/core/narrative/types.ts`: extend `AuditIssueType`.
- Modify `packages/backend/src/core/narrative/audit.ts`: revise or rewrite when new story arc issues appear.
- Modify `packages/backend/src/core/story-router/registry.ts`: align route-plan rules and red flags with the protocol.
- Modify `tests/core/narrative-prompts.test.ts`: test prompt injection and opening retention wording.
- Modify `tests/core/narrative-audit-state-checkpoint.test.ts`: test decision behavior for new audit issues.
- Modify `tests/core/story-router.test.ts`: test route-plan guidance.

## Task 1: Add Story Arc Control Prompt Protocol

**Files:**
- Modify: `packages/backend/src/core/narrative/prompts.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [ ] **Step 1: Write failing prompt protocol tests**

Add this test inside `describe('narrative prompts', () => { ... })` in `tests/core/narrative-prompts.test.ts`:

```ts
  it('injects story arc control into planning, drafting, audit, and revision prompts', () => {
    const biblePrompt = buildNarrativeBiblePrompt({
      title: '命簿旧债',
      idea: '一个修复命簿的人发现自己的家族被命运删除。',
      targetChapters: 80,
      wordsPerChapter: 2200,
    });
    const volumePrompt = buildVolumePlanPrompt({
      title: '命簿旧债',
      targetChapters: 80,
      bibleSummary: '主线：命簿旧债必须偿还。',
      viralStoryProtocol: viralProtocol,
    });
    const cardPrompt = buildChapterCardPrompt({
      title: '命簿旧债',
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '主线：命簿旧债必须偿还。',
      volumePlansText: '第一卷：旧债初鸣，1-20章。',
      viralStoryProtocol: viralProtocol,
    });
    const tensionPrompt = buildTensionBudgetPrompt({
      title: '命簿旧债',
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '主线：命簿旧债必须偿还。',
      volumePlansText: '第一卷：旧债初鸣，1-20章。',
      chapterCardsText: 'Chapter 1: 旧债入场。',
      viralStoryProtocol: viralProtocol,
    });
    const draftPrompt = buildNarrativeDraftPrompt({
      title: '命簿旧债',
      idea: '旧案复仇',
      wordsPerChapter: 2500,
      commandContext: 'Chapter Mission: 林牧必须发现旧债代价。',
      viralStoryProtocol: viralProtocol,
      chapterIndex: 2,
    });
    const auditPrompt = buildChapterAuditPrompt({
      draft: '林牧发现旧债，却没有选择或后果。',
      auditContext: 'Chapter Mission: 旧债入局。',
      viralStoryProtocol: viralProtocol,
      chapterIndex: 2,
    });
    const revisionPrompt = buildRevisionPrompt({
      originalPrompt: draftPrompt,
      draft: '林牧发现旧债，却没有选择或后果。',
      issues: [
        {
          type: 'pacing_problem',
          severity: 'major',
          evidence: '章节离开旧债主线。',
          fixInstruction: '让旧债造成具体选择和代价。',
        },
      ],
    });

    for (const prompt of [
      biblePrompt,
      volumePrompt,
      cardPrompt,
      tensionPrompt,
      draftPrompt,
      auditPrompt,
      revisionPrompt,
    ]) {
      expect(prompt).toContain('Story Arc Control Protocol');
      expect(prompt).toContain('Title Promise Control');
      expect(prompt).toContain('Mainline Control');
      expect(prompt).toContain('Ending Control');
    }
    expect(auditPrompt).toContain('weak_title_promise');
    expect(auditPrompt).toContain('mainline_drift');
    expect(auditPrompt).toContain('loose_ending');
    expect(auditPrompt).toContain('unearned_hook');
  });
```

- [ ] **Step 2: Run the prompt test and confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts
```

Expected: FAIL because the prompts do not contain `Story Arc Control Protocol` and `mainline_drift` is not in the audit issue enum string yet.

- [ ] **Step 3: Implement the prompt protocol helper**

In `packages/backend/src/core/narrative/prompts.ts`, add this helper near the existing `renderBookTitlePlanningLines()` helper:

```ts
function buildStoryArcControlProtocolLines() {
  return [
    'Story Arc Control Protocol:',
    'Title Promise Control: Treat the title as a reader promise. Planning and prose must repeatedly pay it through genre signal, conflict, world rules, and chapter hooks.',
    'Opening Control: Chapters 1-5 must combine retention pressure with title-promise payoff and mainline entry.',
    'Mainline Control: Every chapter must create visible movement in the main thread, or a justified complication that changes the central question.',
    'Ending Control: Chapter endings must create earned forward pressure from a choice, cost, reveal, or consequence. Volume endings must pay a stage promise and upgrade the long-term question. The full story ending must resolve the central dramatic question and ending state.',
  ];
}
```

Inject `...buildStoryArcControlProtocolLines(),` into:

```ts
buildNarrativeBiblePrompt()
buildVolumePlanPrompt()
buildChapterCardPrompt()
buildTensionBudgetPrompt()
buildNarrativeDraftPrompt()
buildChapterAuditPrompt()
buildRevisionPrompt()
```

In `buildChapterAuditPrompt()`, replace the issue enum line with the same content plus the four new issues:

```ts
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward, flat_chapter, weak_choice_pressure, missing_consequence, soft_hook, repeated_tension_pattern, weak_reader_promise, unclear_desire, missing_payoff, payoff_without_cost, generic_trope, weak_reader_question, stale_hook_engine, weak_title_promise, mainline_drift, loose_ending, unearned_hook.',
```

Add these audit questions after the flatness questions:

```ts
    'Story arc questions: Does this chapter pay or sharpen the title promise? Can the reader describe the mainline movement after the chapter? Is the ending pressure earned by this chapter events? Does the ending both point forward and preserve convergence?',
```

- [ ] **Step 4: Run the prompt test and confirm it passes**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add packages/backend/src/core/narrative/prompts.ts tests/core/narrative-prompts.test.ts
git commit -m "feat: add story arc prompt protocol"
```

## Task 2: Strengthen Opening Retention With Title Promise And Mainline Entry

**Files:**
- Modify: `packages/backend/src/core/narrative/opening-retention.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [ ] **Step 1: Write failing opening-retention tests**

Extend the existing `injects the opening retention protocol into chapter card prompts` test in `tests/core/narrative-prompts.test.ts` with:

```ts
    expect(prompt).toContain('make the title promise visible');
    expect(prompt).toContain('show that it belongs to the mainline');
    expect(prompt).toContain('locks the story onto the main thread');
```

Extend the existing `compresses opening retention guidance for short books` test with:

```ts
    expect(prompt).toContain('chapter 1 creates the title promise');
    expect(prompt).toContain('final available opening chapter creates irreversible mainline entry');
```

- [ ] **Step 2: Run the prompt test and confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts
```

Expected: FAIL because the existing opening retention wording does not mention title promise or mainline entry.

- [ ] **Step 3: Update opening retention phase effects**

In `packages/backend/src/core/narrative/opening-retention.ts`, update `OPENING_RETENTION_PHASES` required effects to:

```ts
    requiredEffect:
      'Start with abnormality, desire, conflict, danger, or an unanswered question within the opening paragraphs, and make the title promise visible.',
```

```ts
    requiredEffect:
      'Make the chapter 1 problem visibly more expensive through status loss, relationship strain, resource cost, or danger, and show that it belongs to the mainline.',
```

```ts
    requiredEffect:
      'Force a choice that makes the protagonist unable to return to the old safe life and locks the story onto the main thread.',
```

```ts
    requiredEffect:
      'Give the reader a breakthrough, truth, upgrade, ally, or partial victory, but attach a side effect that keeps the title promise alive.',
```

```ts
    requiredEffect:
      'Reveal that a larger hostile force, unresolved mystery, or long-term pressure is now aimed at the protagonist and can sustain the mainline.',
```

Update `buildOpeningRetentionProtocolLines()` chapter lines to match those effects, and replace the compressed short-book lines with:

```ts
      'Chapter 1 still performs abnormal entry and chapter 1 creates the title promise.',
      'The final available opening chapter performs irreversible entry and final available opening chapter creates irreversible mainline entry.',
```

- [ ] **Step 4: Run the prompt test and confirm it passes**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add packages/backend/src/core/narrative/opening-retention.ts tests/core/narrative-prompts.test.ts
git commit -m "feat: strengthen opening retention arc control"
```

## Task 3: Enforce Story Arc Audit Decisions

**Files:**
- Modify: `packages/backend/src/core/narrative/types.ts`
- Modify: `packages/backend/src/core/narrative/audit.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`

- [ ] **Step 1: Write failing audit-decision tests**

Add these tests inside `describe('narrative audit helpers', () => { ... })` in `tests/core/narrative-audit-state-checkpoint.test.ts`:

```ts
  it('rewrites blocker mainline drift', () => {
    const audit = {
      passed: false,
      score: 78,
      decision: 'revise' as const,
      issues: [
        {
          type: 'mainline_drift' as const,
          severity: 'blocker' as const,
          evidence: '整章离开命簿旧债主线。',
          fixInstruction: '重写为围绕旧债选择推进。',
        },
      ],
      scoring: {
        characterLogic: 90,
        mainlineProgress: 20,
        relationshipChange: 80,
        conflictDepth: 80,
        worldRuleCost: 80,
        threadManagement: 20,
        pacingReward: 80,
        themeAlignment: 80,
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '',
      },
    };

    expect(decideAuditAction(audit)).toBe('rewrite');
  });

  it('revises major loose endings and unearned hooks', () => {
    const baseAudit = {
      passed: true,
      score: 92,
      decision: 'accept' as const,
      issues: [],
      scoring: {
        characterLogic: 90,
        mainlineProgress: 90,
        relationshipChange: 90,
        conflictDepth: 90,
        worldRuleCost: 90,
        threadManagement: 90,
        pacingReward: 90,
        themeAlignment: 90,
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '',
      },
    };

    expect(
      decideAuditAction({
        ...baseAudit,
        issues: [
          {
            type: 'loose_ending' as const,
            severity: 'major' as const,
            evidence: '章末只是停住，没有收束也没有具体压力。',
            fixInstruction: '用本章代价制造下一步压力。',
          },
        ],
      })
    ).toBe('revise');

    expect(
      decideAuditAction({
        ...baseAudit,
        issues: [
          {
            type: 'unearned_hook' as const,
            severity: 'major' as const,
            evidence: '章末突然抛出陌生敌人。',
            fixInstruction: '让钩子来自本章揭示或选择。',
          },
        ],
      })
    ).toBe('revise');
  });

  it('revises opening chapters with weak title promise', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 90,
          decision: 'accept',
          issues: [
            {
              type: 'weak_title_promise',
              severity: 'minor',
              evidence: '第一章没有体现命簿旧债。',
              fixInstruction: '让异常入场直接触碰标题承诺。',
            },
          ],
          scoring: {
            characterLogic: 90,
            mainlineProgress: 90,
            relationshipChange: 90,
            conflictDepth: 90,
            worldRuleCost: 90,
            threadManagement: 90,
            pacingReward: 90,
            themeAlignment: 90,
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 5 }
      )
    ).toBe('revise');
  });
```

- [ ] **Step 2: Run the audit tests and confirm they fail**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: FAIL because `AuditIssueType` does not include the new issue names and `decideAuditAction()` does not enforce them.

- [ ] **Step 3: Extend `AuditIssueType`**

In `packages/backend/src/core/narrative/types.ts`, append the new issue names to `AuditIssueType`:

```ts
  | 'weak_title_promise'
  | 'mainline_drift'
  | 'loose_ending'
  | 'unearned_hook';
```

- [ ] **Step 4: Update audit decision rules**

In `packages/backend/src/core/narrative/audit.ts`, add this helper near `isOpeningStrictChapter()`:

```ts
function isOpeningControlChapter(chapterIndex?: number | null) {
  return typeof chapterIndex === 'number' && chapterIndex >= 1 && chapterIndex <= 5;
}
```

Add these checks after the blocker check and before viral scoring:

```ts
  if (hasIssue(audit, 'mainline_drift')) {
    const driftIssue = audit.issues.find((issue) => issue.type === 'mainline_drift');
    if (driftIssue?.severity === 'blocker') return 'rewrite';
  }

  if (
    audit.issues.some(
      (issue) =>
        issue.severity === 'major' &&
        (issue.type === 'mainline_drift' ||
          issue.type === 'loose_ending' ||
          issue.type === 'unearned_hook')
    )
  ) {
    return 'revise';
  }

  if (
    isOpeningControlChapter(context.chapterIndex) &&
    (hasIssue(audit, 'weak_title_promise') || hasIssue(audit, 'mainline_drift'))
  ) {
    return 'revise';
  }
```

- [ ] **Step 5: Run the audit tests and confirm they pass**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add packages/backend/src/core/narrative/types.ts packages/backend/src/core/narrative/audit.ts tests/core/narrative-audit-state-checkpoint.test.ts
git commit -m "feat: enforce story arc audit issues"
```

## Task 4: Align Story Router Guidance

**Files:**
- Modify: `packages/backend/src/core/story-router/registry.ts`
- Test: `tests/core/story-router.test.ts`

- [ ] **Step 1: Write failing route-plan tests**

Extend `it('routes chapter writing through structure, chapter goal, character, hook, and audit skills', ...)` in `tests/core/story-router.test.ts` with:

```ts
    expect(plan.checklist).toContain('主线必须产生可描述位移，不能只停留在设定或背景。');
    expect(plan.checklist).toContain('结尾钩子必须由本章 mustChange、代价、揭示或强制选择触发。');
    expect(plan.checklist).toContain('标题承诺和读者承诺必须进入场景行动。');
```

Extend `it('formats route plans for prompt injection', ...)` with:

```ts
    expect(text).toContain('主线必须产生可描述位移');
    expect(text).toContain('结尾钩子必须由本章');
    expect(text).toContain('主线漂移');
    expect(text).toContain('结尾松散');
    expect(text).toContain('空悬钩子');
```

- [ ] **Step 2: Run the router test and confirm it fails**

Run:

```bash
pnpm exec vitest run tests/core/story-router.test.ts
```

Expected: FAIL because the route plan does not include the new story arc guidance yet.

- [ ] **Step 3: Update story router skill rules**

In `packages/backend/src/core/story-router/registry.ts`, update the listed skill arrays:

For `story-structure.promptRules`, add:

```ts
      '主线必须产生可描述位移，不能只停留在设定或背景。',
```

For `story-structure.redFlags`, add:

```ts
      '主线漂移到与 centralDramaticQuestion 无关的事件。',
```

For `chapter-goal.promptRules`, add:

```ts
      '结尾钩子必须由本章 mustChange、代价、揭示或强制选择触发。',
```

For `hook-technique.promptRules`, add:

```ts
      '钩子必须由具体后果产生，不能只抛出空悬疑问。',
```

For `hook-technique.redFlags`, add:

```ts
      '空悬钩子没有来自本章事件的因果支撑。',
      '结尾松散，只停住或总结，没有收束也没有下一步压力。',
```

For `viral-promise.promptRules`, add:

```ts
      '标题承诺和读者承诺必须进入场景行动。',
```

For `red-flag-audit.redFlags`, add:

```ts
      '主线漂移。',
      '结尾松散。',
      '空悬钩子。',
```

- [ ] **Step 4: Run the router test and confirm it passes**

Run:

```bash
pnpm exec vitest run tests/core/story-router.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add packages/backend/src/core/story-router/registry.ts tests/core/story-router.test.ts
git commit -m "feat: align story router arc guidance"
```

## Task 5: Final Verification

**Files:**
- Verify all modified files from Tasks 1-4.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/story-router.test.ts tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: no output. If documentation or generated files changed from commands above, inspect them and either commit intentional changes or remove generated artifacts that are not part of the feature.
