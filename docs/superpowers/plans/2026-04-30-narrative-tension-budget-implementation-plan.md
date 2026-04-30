# Narrative Tension Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a first-version narrative tension budget loop so each generated chapter carries explicit pressure, choice, cost, irreversible change, and anti-flatness audit checks.

**Architecture:** Extend the existing narrative control loop instead of adding a parallel writing pipeline. `createAiOutlineService` generates `ChapterTensionBudget[]` after chapter cards, storage persists them by book/chapter, `buildNarrativeCommandContext` injects the current budget into draft and audit context, and `decideAuditAction` uses optional flatness scores to revise or rewrite weak chapters.

**Tech Stack:** TypeScript, Vitest, better-sqlite3, existing Electron main/runtime wiring, existing mock story services.

---

## File Structure

- Modify `src/core/narrative/types.ts`: add tension budget enums/types and optional `NarrativeAudit.scoring.flatness`.
- Modify `src/core/types.ts`: add `chapterTensionBudgets?: ChapterTensionBudget[]` to `OutlineBundle`.
- Modify `src/core/narrative/prompts.ts`: add `buildTensionBudgetPrompt`; update draft and audit prompts with budget/flatness instructions.
- Modify `src/core/narrative/validation.ts`: add `validateTensionBudgets`.
- Modify `src/core/narrative/context.ts`: accept optional compact tension budget and render it into the command context.
- Modify `src/core/narrative/audit.ts`: use optional flatness scoring in `decideAuditAction`.
- Modify `src/core/ai-outline.ts`: generate, validate, and return tension budgets after chapter cards.
- Create `src/storage/chapter-tension-budgets.ts`: repository for CRUD/list operations.
- Modify `src/storage/migrations.ts`: create `chapter_tension_budgets`.
- Modify `src/storage/database.ts`: instantiate and expose the new repository.
- Modify `src/storage/books.ts`: clear/delete `chapter_tension_budgets` with book cleanup.
- Modify `src/core/book-service.ts`: save budgets during outline build, load current budget for chapter writing, include budgets in detail narrative payload.
- Modify `electron/runtime.ts`: wire repository into `createBookService`.
- Modify `src/mock/story-services.ts`: return deterministic budgets and flatness audit scoring.
- Modify tests under `tests/core`, `tests/storage`, and `tests/electron` to cover generation, context, audit, storage, and wiring.

## Task 1: Core Types And Validation

**Files:**
- Modify: `src/core/narrative/types.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/narrative/validation.ts`
- Test: `tests/core/narrative-validation.test.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`

- [x] **Step 1: Write failing validation tests**

Add these imports in `tests/core/narrative-validation.test.ts`:

```ts
import {
  validateChapterCards,
  validateNarrativeBible,
  validateTensionBudgets,
  validateVolumePlans,
} from '../../src/core/narrative/validation';
import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeBible,
  VolumePlan,
} from '../../src/core/narrative/types';
```

Append:

```ts
function validTensionBudget(chapterIndex: number): ChapterTensionBudget {
  return {
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex,
    pressureLevel: chapterIndex % 3 === 0 ? 'high' : 'medium',
    dominantTension:
      chapterIndex % 3 === 0
        ? 'moral_choice'
        : chapterIndex % 2 === 0
          ? 'relationship'
          : 'mystery',
    requiredTurn: `第 ${chapterIndex} 章出现不可忽视的局势转向。`,
    forcedChoice: `林牧必须在公开线索和保护同伴之间选择。`,
    costToPay: `林牧失去一段可验证的记忆。`,
    irreversibleChange: `林牧无法再回到旁观者身份。`,
    readerQuestion: `真正操纵命簿的人是谁？`,
    hookPressure: `章末出现更危险的命簿记录。`,
    flatnessRisks: ['不要用解释代替冲突。'],
  };
}

describe('validateTensionBudgets', () => {
  it('accepts one complete budget per chapter', () => {
    expect(
      validateTensionBudgets([validTensionBudget(1), validTensionBudget(2)], {
        targetChapters: 2,
      })
    ).toEqual({ valid: true, issues: [] });
  });

  it('rejects missing budget and blank required fields', () => {
    const budget = {
      ...validTensionBudget(1),
      requiredTurn: '',
      costToPay: '',
      irreversibleChange: '',
      hookPressure: '',
      flatnessRisks: [],
    };

    const result = validateTensionBudgets([budget], { targetChapters: 2 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Tension budget 2 must exist.');
    expect(result.issues).toContain('Tension budget 1 must include requiredTurn.');
    expect(result.issues).toContain('Tension budget 1 must include costToPay.');
    expect(result.issues).toContain(
      'Tension budget 1 must include irreversibleChange.'
    );
    expect(result.issues).toContain('Tension budget 1 must include hookPressure.');
    expect(result.issues).toContain(
      'Tension budget 1 must include at least one flatnessRisk.'
    );
  });

  it('rejects more than three repeated dominant tension values', () => {
    const budgets = [1, 2, 3, 4].map((chapterIndex) => ({
      ...validTensionBudget(chapterIndex),
      dominantTension: 'mystery' as const,
    }));

    const result = validateTensionBudgets(budgets, { targetChapters: 4 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Tension budgets must not repeat dominantTension mystery for more than 3 consecutive chapters.'
    );
  });

  it('rejects three consecutive low-pressure chapters', () => {
    const budgets = [1, 2, 3].map((chapterIndex) => ({
      ...validTensionBudget(chapterIndex),
      pressureLevel: 'low' as const,
    }));

    const result = validateTensionBudgets(budgets, { targetChapters: 3 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Tension budgets must include medium or higher pressure within every 3 chapters.'
    );
  });
});
```

- [x] **Step 2: Write failing audit decision tests**

Append in `tests/core/narrative-audit-state-checkpoint.test.ts`:

```ts
it('rewrites drafts with very low flatness average', () => {
  expect(
    decideAuditAction({
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
          conflictEscalation: 50,
          choicePressure: 55,
          consequenceVisibility: 50,
          irreversibleChange: 55,
          hookStrength: 50,
        },
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '',
      },
    })
  ).toBe('rewrite');
});

it('revises drafts with weak choice pressure even when the total audit score is acceptable', () => {
  expect(
    decideAuditAction({
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
          conflictEscalation: 75,
          choicePressure: 55,
          consequenceVisibility: 80,
          irreversibleChange: 80,
          hookStrength: 80,
        },
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '',
      },
    })
  ).toBe('revise');
});
```

- [x] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/narrative-validation.test.ts tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: FAIL because `ChapterTensionBudget`, `validateTensionBudgets`, and `scoring.flatness` do not exist.

- [x] **Step 4: Add core types**

In `src/core/narrative/types.ts`, add:

```ts
export type TensionPressureLevel = 'low' | 'medium' | 'high' | 'peak';

export type DominantTension =
  | 'danger'
  | 'desire'
  | 'relationship'
  | 'mystery'
  | 'moral_choice'
  | 'deadline'
  | 'status_loss'
  | 'resource_cost';
```

Extend `AuditIssueType`:

```ts
  | 'missing_reader_reward'
  | 'flat_chapter'
  | 'weak_choice_pressure'
  | 'missing_consequence'
  | 'soft_hook'
  | 'repeated_tension_pattern';
```

Add after `ChapterRelationshipAction`:

```ts
export type ChapterTensionBudget = {
  bookId: string;
  volumeIndex: number;
  chapterIndex: number;
  pressureLevel: TensionPressureLevel;
  dominantTension: DominantTension;
  requiredTurn: string;
  forcedChoice: string;
  costToPay: string;
  irreversibleChange: string;
  readerQuestion: string;
  hookPressure: string;
  flatnessRisks: string[];
};

export type FlatnessScoring = {
  conflictEscalation: number;
  choicePressure: number;
  consequenceVisibility: number;
  irreversibleChange: number;
  hookStrength: number;
};
```

Extend `NarrativeAudit.scoring`:

```ts
    themeAlignment: number;
    flatness?: FlatnessScoring;
```

In `src/core/types.ts`, import `ChapterTensionBudget` and extend `OutlineBundle`:

```ts
  chapterTensionBudgets?: ChapterTensionBudget[];
```

- [x] **Step 5: Add validation**

In `src/core/narrative/validation.ts`, import `ChapterTensionBudget` and add:

```ts
export function validateTensionBudgets(
  budgets: ChapterTensionBudget[],
  input: { targetChapters: number }
): ValidationResult {
  const issues: string[] = [];
  const sorted = [...budgets].sort((left, right) => left.chapterIndex - right.chapterIndex);
  let repeatedTensionCount = 0;
  let previousDominantTension: string | null = null;

  for (let index = 0; index < input.targetChapters; index += 1) {
    const expectedChapter = index + 1;
    const budget = sorted[index];

    if (!budget || budget.chapterIndex !== expectedChapter) {
      issues.push(`Tension budget ${expectedChapter} must exist.`);
      continue;
    }

    if (isBlank(budget.requiredTurn)) {
      issues.push(`Tension budget ${expectedChapter} must include requiredTurn.`);
    }
    if (isBlank(budget.costToPay)) {
      issues.push(`Tension budget ${expectedChapter} must include costToPay.`);
    }
    if (isBlank(budget.irreversibleChange)) {
      issues.push(`Tension budget ${expectedChapter} must include irreversibleChange.`);
    }
    if (isBlank(budget.hookPressure)) {
      issues.push(`Tension budget ${expectedChapter} must include hookPressure.`);
    }
    if (!Array.isArray(budget.flatnessRisks) || budget.flatnessRisks.length === 0) {
      issues.push(
        `Tension budget ${expectedChapter} must include at least one flatnessRisk.`
      );
    }

    if (budget.dominantTension === previousDominantTension) {
      repeatedTensionCount += 1;
    } else {
      previousDominantTension = budget.dominantTension;
      repeatedTensionCount = 1;
    }
    if (repeatedTensionCount > 3) {
      issues.push(
        `Tension budgets must not repeat dominantTension ${budget.dominantTension} for more than 3 consecutive chapters.`
      );
    }
  }

  for (let index = 0; index <= sorted.length - 3; index += 1) {
    const window = sorted.slice(index, index + 3);
    if (window.length === 3 && window.every((budget) => budget.pressureLevel === 'low')) {
      issues.push(
        'Tension budgets must include medium or higher pressure within every 3 chapters.'
      );
      break;
    }
  }

  return result([...new Set(issues)]);
}
```

- [x] **Step 6: Update audit decision**

In `src/core/narrative/audit.ts`, insert after the blocker check:

```ts
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
    if (
      flatness.choicePressure < 60 ||
      flatness.consequenceVisibility < 60 ||
      flatness.irreversibleChange < 70
    ) {
      return 'revise';
    }
  }
```

- [x] **Step 7: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run tests/core/narrative-validation.test.ts tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/core/narrative/types.ts src/core/types.ts src/core/narrative/validation.ts src/core/narrative/audit.ts tests/core/narrative-validation.test.ts tests/core/narrative-audit-state-checkpoint.test.ts
git commit -m "feat: add narrative tension budget types"
```

## Task 2: Prompts And Command Context

**Files:**
- Modify: `src/core/narrative/prompts.ts`
- Modify: `src/core/narrative/context.ts`
- Test: `tests/core/narrative-prompts.test.ts`
- Test: `tests/core/narrative-context.test.ts`

- [x] **Step 1: Write failing prompt tests**

Append in `tests/core/narrative-prompts.test.ts`:

```ts
it('builds a tension budget prompt with anti-flatness requirements', () => {
  const prompt = buildTensionBudgetPrompt({
    bookId: 'book-1',
    targetChapters: 3,
    bibleSummary: 'theme: freedom requires cost',
    volumePlansText: 'Volume 1: chapters 1-3',
    chapterCardsText: 'Chapter 1: must change',
  });

  expect(prompt).toContain('Create tension budgets');
  expect(prompt).toContain('forcedChoice');
  expect(prompt).toContain('costToPay');
  expect(prompt).toContain('irreversibleChange');
  expect(prompt).toContain('hookPressure');
  expect(prompt).toContain('Do not assign the same dominantTension');
});

it('asks audits to score flatness', () => {
  const prompt = buildChapterAuditPrompt({
    draft: '林牧翻开旧页。',
    auditContext: 'Tension Budget: forcedChoice=保密或求助',
  });

  expect(prompt).toContain('flatness');
  expect(prompt).toContain('choice');
  expect(prompt).toContain('consequence');
  expect(prompt).toContain('ending create forward pressure');
});
```

Update the import list to include `buildTensionBudgetPrompt`.

- [x] **Step 2: Write failing context tests**

Append in `tests/core/narrative-context.test.ts`:

```ts
it('includes tension budget in the command context', () => {
  const result = buildNarrativeCommandContext({
    bible: {
      themeQuestion: '人能否摆脱命运？',
      themeAnswerDirection: '自由需要承担代价。',
      voiceGuide: '紧凑中文网文。',
    },
    chapterCard: {
      title: '旧页',
      plotFunction: '开局。',
      externalConflict: '宗门追捕。',
      internalConflict: '林牧想保密却需要求助。',
      relationshipChange: '林牧欠下同伴人情。',
      worldRuleUsedOrTested: 'record-cost',
      informationReveal: '命簿会吞记忆。',
      readerReward: 'truth',
      endingHook: '碎页浮现林家姓名。',
      mustChange: '林牧从逃避变为主动追查。',
      forbiddenMoves: [],
    },
    tensionBudget: {
      pressureLevel: 'high',
      dominantTension: 'moral_choice',
      requiredTurn: '胜利会伤害同伴。',
      forcedChoice: '保住证据，或救下同伴。',
      costToPay: '失去同伴信任。',
      irreversibleChange: '林牧无法继续旁观。',
      readerQuestion: '谁安排了这次选择？',
      hookPressure: '章末出现更坏记录。',
      flatnessRisks: ['不要用解释代替冲突。'],
    },
    hardContinuity: [],
    characterPressures: [],
    relationshipActions: [],
    threadActions: [],
    worldRules: [],
    recentSummaries: [],
    previousChapterEnding: null,
  });

  expect(result).toContain('Tension Budget:');
  expect(result).toContain('pressureLevel: high');
  expect(result).toContain('forcedChoice: 保住证据，或救下同伴。');
  expect(result).toContain('Flatness Risks:');
  expect(result).toContain('不要用解释代替冲突。');
});

it('preserves tension budget when context is trimmed', () => {
  const result = buildNarrativeCommandContext({
    bible: {
      themeQuestion: '人能否摆脱命运？',
      themeAnswerDirection: '自由需要承担代价。',
      voiceGuide: '紧凑中文网文。',
    },
    chapterCard: {
      title: '旧页',
      plotFunction: '开局。',
      externalConflict: '宗门追捕。',
      internalConflict: '林牧想保密却需要求助。',
      relationshipChange: '林牧欠下同伴人情。',
      worldRuleUsedOrTested: 'record-cost',
      informationReveal: '命簿会吞记忆。',
      readerReward: 'truth',
      endingHook: '碎页浮现林家姓名。',
      mustChange: '林牧从逃避变为主动追查。',
      forbiddenMoves: [],
    },
    tensionBudget: {
      pressureLevel: 'high',
      dominantTension: 'moral_choice',
      requiredTurn: '胜利会伤害同伴。',
      forcedChoice: '保住证据，或救下同伴。',
      costToPay: '失去同伴信任。',
      irreversibleChange: '林牧无法继续旁观。',
      readerQuestion: '谁安排了这次选择？',
      hookPressure: '章末出现更坏记录。',
      flatnessRisks: ['不要用解释代替冲突。'],
    },
    hardContinuity: ['x'.repeat(1000)],
    characterPressures: ['x'.repeat(1000)],
    relationshipActions: ['x'.repeat(1000)],
    threadActions: ['x'.repeat(1000)],
    worldRules: ['x'.repeat(1000)],
    recentSummaries: ['x'.repeat(1000)],
    previousChapterEnding: 'x'.repeat(1000),
    maxCharacters: 900,
  });

  expect(result).toContain('Tension Budget:');
  expect(result).toContain('mustChange: 林牧从逃避变为主动追查。');
  expect(result.length).toBeLessThanOrEqual(900);
});
```

- [x] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts
```

Expected: FAIL because `buildTensionBudgetPrompt` and `tensionBudget` context support do not exist.

- [x] **Step 4: Implement prompt changes**

In `src/core/narrative/prompts.ts`, add:

```ts
export function buildTensionBudgetPrompt(input: {
  bookId: string;
  targetChapters: number;
  bibleSummary: string;
  volumePlansText: string;
  chapterCardsText: string;
}) {
  return [
    'Create tension budgets for a long-form Chinese web novel.',
    'Return valid JSON only: an array of chapter tension budget objects.',
    `Book id: ${input.bookId}`,
    `Target chapters: ${input.targetChapters}`,
    `Narrative bible summary:\n${input.bibleSummary}`,
    `Volume plans:\n${input.volumePlansText}`,
    `Chapter cards:\n${input.chapterCardsText}`,
    'Each chapter must include volumeIndex, chapterIndex, pressureLevel, dominantTension, requiredTurn, forcedChoice, costToPay, irreversibleChange, readerQuestion, hookPressure, flatnessRisks.',
    'pressureLevel must be low, medium, high, or peak.',
    'dominantTension must be danger, desire, relationship, mystery, moral_choice, deadline, status_loss, or resource_cost.',
    'Do not assign the same dominantTension to more than three consecutive chapters.',
    'Low pressure chapters must still include visible internal, relational, informational, or thematic movement.',
    'Peak chapters should align with volume turns, major payoffs, betrayals, failures, or irreversible decisions.',
  ].join('\n');
}
```

Update `buildNarrativeDraftPrompt` hard requirements:

```ts
    'Hard requirements: complete mustChange, fulfill the Tension Budget when provided, make forcedChoice visible through action, make costToPay visible before the chapter ends, preserve forbiddenMoves, show world-rule cost when a rule is used, and make relationship changes visible through action.',
```

Update `buildChapterAuditPrompt`:

```ts
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward, flat_chapter, weak_choice_pressure, missing_consequence, soft_hook, repeated_tension_pattern.',
    'Also audit flatness with scoring.flatness: conflictEscalation, choicePressure, consequenceVisibility, irreversibleChange, hookStrength.',
    'Flatness questions: Did the chapter escalate, turn, or meaningfully redirect conflict? Did the POV character face a visible choice? Was a cost paid or consequence made visible? Did the ending create forward pressure? Did the chapter repeat the same tension pattern without new effect?',
```

- [x] **Step 5: Implement context changes**

In `src/core/narrative/context.ts`, add:

```ts
type CompactTensionBudget = {
  pressureLevel: string;
  dominantTension: string;
  requiredTurn: string;
  forcedChoice: string;
  costToPay: string;
  irreversibleChange: string;
  readerQuestion: string;
  hookPressure: string;
  flatnessRisks: string[];
};
```

Add `tensionBudget?: CompactTensionBudget | null;` to the input type.

Build `tensionBudgetLines` before `requiredTail`:

```ts
  const tensionBudgetLines = input.tensionBudget
    ? [
        'Tension Budget:',
        `pressureLevel: ${input.tensionBudget.pressureLevel}`,
        `dominantTension: ${input.tensionBudget.dominantTension}`,
        `requiredTurn: ${input.tensionBudget.requiredTurn}`,
        `forcedChoice: ${input.tensionBudget.forcedChoice}`,
        `costToPay: ${input.tensionBudget.costToPay}`,
        `irreversibleChange: ${input.tensionBudget.irreversibleChange}`,
        `readerQuestion: ${input.tensionBudget.readerQuestion}`,
        `hookPressure: ${input.tensionBudget.hookPressure}`,
        'Flatness Risks:',
        ...input.tensionBudget.flatnessRisks,
      ]
    : [];
```

Include it in `requiredTail` before `Chapter Mission`:

```ts
  const requiredTail = [
    ...tensionBudgetLines,
    'Chapter Mission:',
```

- [x] **Step 6: Run tests to verify pass**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/narrative/prompts.ts src/core/narrative/context.ts tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts
git commit -m "feat: add tension budget prompts"
```

## Task 3: AI Outline Generation

**Files:**
- Modify: `src/core/ai-outline.ts`
- Test: `tests/core/ai-outline.test.ts`

- [x] **Step 1: Write failing test**

Add a test in `tests/core/ai-outline.test.ts` that feeds four model responses: bible, volume plans, chapter cards, tension budgets.

```ts
it('generates tension budgets after chapter cards', async () => {
  const responses = [
    JSON.stringify(validNarrativeBible()),
    JSON.stringify([
      {
        volumeIndex: 1,
        title: '命簿初鸣',
        chapterStart: 1,
        chapterEnd: 1,
        roleInStory: '建立追查目标。',
        mainPressure: '宗门追捕。',
        promisedPayoff: '发现账簿碎页。',
        characterArcMovement: '林牧开始信任同伴。',
        relationshipMovement: '师徒裂痕出现。',
        worldExpansion: '展示命簿代价。',
        endingTurn: '碎页指向师父。',
      },
    ]),
    JSON.stringify({
      cards: [
        {
          volumeIndex: 1,
          chapterIndex: 1,
          title: '旧页',
          plotFunction: '开局。',
          povCharacterId: 'lin-mu',
          externalConflict: '宗门追捕。',
          internalConflict: '林牧想保密却需要求助。',
          relationshipChange: '林牧欠下同伴人情。',
          worldRuleUsedOrTested: 'record-cost',
          informationReveal: '命簿会吞记忆。',
          readerReward: 'truth',
          endingHook: '碎页浮现林家姓名。',
          mustChange: '林牧从逃避变为主动追查。',
          forbiddenMoves: [],
        },
      ],
    }),
    JSON.stringify([
      {
        volumeIndex: 1,
        chapterIndex: 1,
        pressureLevel: 'high',
        dominantTension: 'moral_choice',
        requiredTurn: '胜利会伤害同伴。',
        forcedChoice: '保住证据，或救下同伴。',
        costToPay: '失去同伴信任。',
        irreversibleChange: '林牧无法继续旁观。',
        readerQuestion: '谁安排了这次选择？',
        hookPressure: '章末出现更坏记录。',
        flatnessRisks: ['不要用解释代替冲突。'],
      },
    ]),
  ];
  const generateText = vi.fn().mockImplementation(async () => ({
    text: responses.shift() ?? '',
  }));
  const service = createAiOutlineService({
    registry: { languageModel: () => ({}) },
    generateText,
  });

  const result = await service.generateFromIdea({
    bookId: 'book-1',
    idea: '命簿修复师追查家族旧案。',
    targetChapters: 1,
    wordsPerChapter: 2000,
    modelId: 'model-1',
  });

  expect(result.chapterTensionBudgets).toEqual([
    {
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      pressureLevel: 'high',
      dominantTension: 'moral_choice',
      requiredTurn: '胜利会伤害同伴。',
      forcedChoice: '保住证据，或救下同伴。',
      costToPay: '失去同伴信任。',
      irreversibleChange: '林牧无法继续旁观。',
      readerQuestion: '谁安排了这次选择？',
      hookPressure: '章末出现更坏记录。',
      flatnessRisks: ['不要用解释代替冲突。'],
    },
  ]);
  expect(generateText).toHaveBeenCalledTimes(4);
});
```

If the file has existing helpers with different names, reuse the existing `validNarrativeBible` helper or create one in the test with the same complete shape used by current tests.

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/ai-outline.test.ts
```

Expected: FAIL because outline generation does not call `buildTensionBudgetPrompt`.

- [x] **Step 3: Add rendering helper and generation**

In `src/core/ai-outline.ts`, import:

```ts
  buildTensionBudgetPrompt,
```

and:

```ts
  validateTensionBudgets,
```

and `ChapterTensionBudget`.

Add:

```ts
function chapterCardsText(cards: ChapterCard[]) {
  return cards
    .map(
      (card) =>
        `Chapter ${card.chapterIndex}: ${card.title}; function=${card.plotFunction}; mustChange=${card.mustChange}; readerReward=${card.readerReward}; endingHook=${card.endingHook}`
    )
    .join('\n');
}
```

After `cardValidation` passes:

```ts
        const generatedTensionBudgets = parseJsonObject<
          Array<Omit<ChapterTensionBudget, 'bookId'> & { bookId?: string }>
        >(
          (
            await deps.generateText({
              model,
              prompt: buildTensionBudgetPrompt({
                bookId: input.bookId,
                targetChapters: input.targetChapters,
                bibleSummary: bibleSummary(narrativeBible),
                volumePlansText: volumePlansText(volumePlans),
                chapterCardsText: chapterCardsText(chapterCards),
              }),
            })
          ).text
        );
        const chapterTensionBudgets = generatedTensionBudgets.map((budget) => ({
          ...budget,
          bookId: input.bookId,
        })) as ChapterTensionBudget[];
        const tensionBudgetValidation = validateTensionBudgets(chapterTensionBudgets, {
          targetChapters: input.targetChapters,
        });
        if (!tensionBudgetValidation.valid) {
          throw new Error(
            `Invalid tension budgets: ${tensionBudgetValidation.issues.join('; ')}`
          );
        }
```

Return `chapterTensionBudgets`.

- [x] **Step 4: Run test to verify pass**

Run:

```bash
pnpm exec vitest run tests/core/ai-outline.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/ai-outline.ts tests/core/ai-outline.test.ts
git commit -m "feat: generate chapter tension budgets"
```

## Task 4: Storage Repository And Migration

**Files:**
- Create: `src/storage/chapter-tension-budgets.ts`
- Modify: `src/storage/migrations.ts`
- Modify: `src/storage/database.ts`
- Modify: `src/storage/books.ts`
- Test: `tests/storage/narrative-schema.test.ts`

- [x] **Step 1: Write failing storage tests**

Append in `tests/storage/narrative-schema.test.ts`:

```ts
it('creates chapter tension budget table', () => {
  const db = createTestDatabase();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => (row as { name: string }).name);

  expect(tables).toContain('chapter_tension_budgets');
});

it('round-trips chapter tension budgets', () => {
  const db = createTestDatabase();
  const repository = createChapterTensionBudgetRepository(db);

  repository.upsertMany([
    {
      bookId: 'book-1',
      volumeIndex: 1,
      chapterIndex: 1,
      pressureLevel: 'high',
      dominantTension: 'moral_choice',
      requiredTurn: '胜利会伤害同伴。',
      forcedChoice: '保住证据，或救下同伴。',
      costToPay: '失去同伴信任。',
      irreversibleChange: '林牧无法继续旁观。',
      readerQuestion: '谁安排了这次选择？',
      hookPressure: '章末出现更坏记录。',
      flatnessRisks: ['不要用解释代替冲突。'],
    },
  ]);

  expect(repository.getByChapter('book-1', 1, 1)).toMatchObject({
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex: 1,
    pressureLevel: 'high',
    dominantTension: 'moral_choice',
    flatnessRisks: ['不要用解释代替冲突。'],
  });
  expect(repository.listByBook('book-1')).toHaveLength(1);

  repository.clearByBook('book-1');
  expect(repository.listByBook('book-1')).toEqual([]);
});
```

Add import:

```ts
import { createChapterTensionBudgetRepository } from '../../src/storage/chapter-tension-budgets';
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts
```

Expected: FAIL because the repository/table do not exist.

- [x] **Step 3: Add migration**

In `src/storage/migrations.ts`, after `chapter_relationship_actions`, add:

```sql
  CREATE TABLE IF NOT EXISTS chapter_tension_budgets (
    book_id TEXT NOT NULL,
    volume_index INTEGER NOT NULL,
    chapter_index INTEGER NOT NULL,
    pressure_level TEXT NOT NULL,
    dominant_tension TEXT NOT NULL,
    required_turn TEXT NOT NULL,
    forced_choice TEXT NOT NULL,
    cost_to_pay TEXT NOT NULL,
    irreversible_change TEXT NOT NULL,
    reader_question TEXT NOT NULL,
    hook_pressure TEXT NOT NULL,
    flatness_risks_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (book_id, volume_index, chapter_index),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
```

- [x] **Step 4: Create repository**

Create `src/storage/chapter-tension-budgets.ts`:

```ts
import type { Database as SqliteDatabase } from 'better-sqlite3';
import type { ChapterTensionBudget } from '../core/narrative/types.js';

type TensionBudgetRow = Omit<ChapterTensionBudget, 'flatnessRisks'> & {
  flatnessRisksJson: string;
};

function mapBudget(row: TensionBudgetRow): ChapterTensionBudget {
  return {
    ...row,
    flatnessRisks: JSON.parse(row.flatnessRisksJson) as string[],
  };
}

export function createChapterTensionBudgetRepository(db: SqliteDatabase) {
  function upsert(budget: ChapterTensionBudget) {
    db.prepare(
      `
        INSERT INTO chapter_tension_budgets (
          book_id, volume_index, chapter_index, pressure_level, dominant_tension,
          required_turn, forced_choice, cost_to_pay, irreversible_change,
          reader_question, hook_pressure, flatness_risks_json, updated_at
        )
        VALUES (
          @bookId, @volumeIndex, @chapterIndex, @pressureLevel, @dominantTension,
          @requiredTurn, @forcedChoice, @costToPay, @irreversibleChange,
          @readerQuestion, @hookPressure, @flatnessRisksJson, @updatedAt
        )
        ON CONFLICT(book_id, volume_index, chapter_index) DO UPDATE SET
          pressure_level = excluded.pressure_level,
          dominant_tension = excluded.dominant_tension,
          required_turn = excluded.required_turn,
          forced_choice = excluded.forced_choice,
          cost_to_pay = excluded.cost_to_pay,
          irreversible_change = excluded.irreversible_change,
          reader_question = excluded.reader_question,
          hook_pressure = excluded.hook_pressure,
          flatness_risks_json = excluded.flatness_risks_json,
          updated_at = excluded.updated_at
      `
    ).run({
      ...budget,
      flatnessRisksJson: JSON.stringify(budget.flatnessRisks),
      updatedAt: new Date().toISOString(),
    });
  }

  function selectBudgets(bookId: string, extraWhere = '', params: unknown[] = []) {
    return db
      .prepare(
        `
          SELECT
            book_id AS bookId,
            volume_index AS volumeIndex,
            chapter_index AS chapterIndex,
            pressure_level AS pressureLevel,
            dominant_tension AS dominantTension,
            required_turn AS requiredTurn,
            forced_choice AS forcedChoice,
            cost_to_pay AS costToPay,
            irreversible_change AS irreversibleChange,
            reader_question AS readerQuestion,
            hook_pressure AS hookPressure,
            flatness_risks_json AS flatnessRisksJson
          FROM chapter_tension_budgets
          WHERE book_id = ?
          ${extraWhere}
          ORDER BY volume_index ASC, chapter_index ASC
        `
      )
      .all(bookId, ...params) as TensionBudgetRow[];
  }

  return {
    upsert,

    upsertMany(budgets: ChapterTensionBudget[]) {
      for (const budget of budgets) upsert(budget);
    },

    getByChapter(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterTensionBudget | null {
      const [row] = selectBudgets(
        bookId,
        'AND volume_index = ? AND chapter_index = ?',
        [volumeIndex, chapterIndex]
      );

      return row ? mapBudget(row) : null;
    },

    listByBook(bookId: string): ChapterTensionBudget[] {
      return selectBudgets(bookId).map(mapBudget);
    },

    clearByBook(bookId: string) {
      db.prepare('DELETE FROM chapter_tension_budgets WHERE book_id = ?').run(bookId);
    },

    deleteByBook(bookId: string) {
      db.prepare('DELETE FROM chapter_tension_budgets WHERE book_id = ?').run(bookId);
    },
  };
}
```

- [x] **Step 5: Wire database and cleanup**

In `src/storage/database.ts`, import and expose:

```ts
import { createChapterTensionBudgetRepository } from './chapter-tension-budgets.js';
```

Add to returned repositories:

```ts
chapterTensionBudgets: createChapterTensionBudgetRepository(db),
```

In `src/storage/books.ts`, include `chapter_tension_budgets` in any table cleanup arrays near other chapter/narrative tables.

- [x] **Step 6: Run storage tests**

Run:

```bash
pnpm exec vitest run tests/storage/narrative-schema.test.ts tests/storage/books.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/storage/chapter-tension-budgets.ts src/storage/migrations.ts src/storage/database.ts src/storage/books.ts tests/storage/narrative-schema.test.ts
git commit -m "feat: persist chapter tension budgets"
```

## Task 5: Book Service Integration

**Files:**
- Modify: `src/core/book-service.ts`
- Modify: `electron/runtime.ts`
- Test: `tests/core/narrative-book-service.test.ts`
- Test: `tests/electron/runtime-mock-fallback.test.ts`

- [x] **Step 1: Write failing book-service tests**

In `tests/core/narrative-book-service.test.ts`, extend the existing outline bundle fixture with:

```ts
chapterTensionBudgets: [
  {
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex: 1,
    pressureLevel: 'high',
    dominantTension: 'moral_choice',
    requiredTurn: '胜利会伤害同伴。',
    forcedChoice: '保住证据，或救下同伴。',
    costToPay: '失去同伴信任。',
    irreversibleChange: '林牧无法继续旁观。',
    readerQuestion: '谁安排了这次选择？',
    hookPressure: '章末出现更坏记录。',
    flatnessRisks: ['不要用解释代替冲突。'],
  },
],
```

Add a mock repository to the dependency fixture:

```ts
const chapterTensionBudgets = {
  upsertMany: vi.fn(),
  getByChapter: vi.fn().mockReturnValue({
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex: 1,
    pressureLevel: 'high',
    dominantTension: 'moral_choice',
    requiredTurn: '胜利会伤害同伴。',
    forcedChoice: '保住证据，或救下同伴。',
    costToPay: '失去同伴信任。',
    irreversibleChange: '林牧无法继续旁观。',
    readerQuestion: '谁安排了这次选择？',
    hookPressure: '章末出现更坏记录。',
    flatnessRisks: ['不要用解释代替冲突。'],
  }),
  listByBook: vi.fn().mockReturnValue([]),
};
```

Add assertions to the existing narrative planning test:

```ts
expect(chapterTensionBudgets.upsertMany).toHaveBeenCalledWith([
  expect.objectContaining({
    bookId: 'book-1',
    chapterIndex: 1,
    dominantTension: 'moral_choice',
  }),
]);
```

Add an assertion to the chapter writing test:

```ts
expect(chapterWriter.writeChapter).toHaveBeenCalledWith(
  expect.objectContaining({
    prompt: expect.stringContaining('Tension Budget:'),
  })
);
expect(chapterAuditor.auditChapter).toHaveBeenCalledWith(
  expect.objectContaining({
    auditContext: expect.stringContaining('forcedChoice: 保住证据，或救下同伴。'),
  })
);
```

- [x] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/narrative-book-service.test.ts
```

Expected: FAIL because `createBookService` does not accept/save/read `chapterTensionBudgets`.

- [x] **Step 3: Extend dependency type and save budgets**

In `src/core/book-service.ts`, import `ChapterTensionBudget`.

Add dependency interface:

```ts
  chapterTensionBudgets?: {
    upsertMany: (budgets: ChapterTensionBudget[]) => void;
    getByChapter?: (
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ) => ChapterTensionBudget | null;
    listByBook?: (bookId: string) => ChapterTensionBudget[];
  };
```

After saving chapter cards during `buildOutline`, add:

```ts
      if (outline.chapterTensionBudgets?.length) {
        deps.chapterTensionBudgets?.upsertMany(outline.chapterTensionBudgets);
      }
```

In `getBookDetail`, include:

```ts
          chapterTensionBudgets: deps.chapterTensionBudgets?.listByBook?.(bookId) ?? [],
```

- [x] **Step 4: Inject budget while writing**

Near `chapterCard` resolution in `writeNextChapter`, add:

```ts
      const tensionBudget =
        chapterCard && deps.chapterTensionBudgets?.getByChapter
          ? deps.chapterTensionBudgets.getByChapter(
              bookId,
              nextChapter.volumeIndex,
              nextChapter.chapterIndex
            )
          : null;
```

Pass into `buildNarrativeCommandContext`:

```ts
          tensionBudget,
```

- [x] **Step 5: Wire runtime repository**

In `electron/runtime.ts`, pass the repository from database services into `createBookService`:

```ts
chapterTensionBudgets: repositories.chapterTensionBudgets,
```

Run:

```bash
pnpm exec vitest run tests/electron/runtime-mock-fallback.test.ts
```

Expected: update any expected repository key list or runtime wiring assertions to include `chapterTensionBudgets`; final result PASS.

- [x] **Step 6: Run integration tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-book-service.test.ts tests/electron/runtime-mock-fallback.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/core/book-service.ts electron/runtime.ts tests/core/narrative-book-service.test.ts tests/electron/runtime-mock-fallback.test.ts
git commit -m "feat: wire tension budgets into book generation"
```

## Task 6: Mock Services

**Files:**
- Modify: `src/mock/story-services.ts`
- Test: `tests/mock/story-services.test.ts`

- [x] **Step 1: Write failing mock test**

Append in `tests/mock/story-services.test.ts`:

```ts
it('mock outline service creates deterministic tension budgets', async () => {
  const services = createMockStoryServices();

  const outline = await services.outlineService.generateFromIdea({
    bookId: 'book-1',
    idea: '命簿修复师追查家族旧案。',
    targetChapters: 4,
    wordsPerChapter: 2000,
    modelId: 'mock',
  });

  expect(outline.chapterTensionBudgets).toHaveLength(4);
  expect(outline.chapterTensionBudgets?.[0]).toMatchObject({
    bookId: 'book-1',
    chapterIndex: 1,
    pressureLevel: 'medium',
  });
  expect(
    new Set(outline.chapterTensionBudgets?.map((budget) => budget.dominantTension))
      .size
  ).toBeGreaterThan(1);
});

it('mock auditor returns flatness scoring', async () => {
  const services = createMockStoryServices();

  const audit = await services.chapterAuditor.auditChapter({
    modelId: 'mock',
    draft: '林牧做出选择并承担代价。',
    auditContext: 'Tension Budget: forcedChoice=保密或求助',
  });

  expect(audit.scoring.flatness).toEqual({
    conflictEscalation: 78,
    choicePressure: 76,
    consequenceVisibility: 74,
    irreversibleChange: 80,
    hookStrength: 72,
  });
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec vitest run tests/mock/story-services.test.ts
```

Expected: FAIL because mock services do not return budgets or flatness.

- [x] **Step 3: Add mock budgets**

In `src/mock/story-services.ts`, import `ChapterTensionBudget` if not already covered.

Add helper:

```ts
const dominantTensions = [
  'mystery',
  'relationship',
  'moral_choice',
  'status_loss',
] as const;

function createMockTensionBudgets(input: {
  bookId: string;
  targetChapters: number;
  protagonist: string;
}): ChapterTensionBudget[] {
  return Array.from({ length: input.targetChapters }, (_, index) => {
    const chapterIndex = index + 1;
    const pressureLevel =
      chapterIndex % 8 === 0
        ? 'peak'
        : chapterIndex % 3 === 0
          ? 'high'
          : chapterIndex % 2 === 0
            ? 'medium'
            : 'medium';

    return {
      bookId: input.bookId,
      volumeIndex: Math.max(1, Math.ceil(chapterIndex / 10)),
      chapterIndex,
      pressureLevel,
      dominantTension: dominantTensions[index % dominantTensions.length],
      requiredTurn: `${input.protagonist}在第${chapterIndex}章遭遇一次不能忽略的局势转向。`,
      forcedChoice: `${input.protagonist}必须在保住线索和保护同伴之间选择。`,
      costToPay: `${input.protagonist}为推进真相付出记忆、信任或安全感的代价。`,
      irreversibleChange: `${input.protagonist}在第${chapterIndex}章后无法回到原来的安全状态。`,
      readerQuestion: `命簿背后真正受益者是否已经靠近${input.protagonist}？`,
      hookPressure: `章末出现让下一章必须处理的新压力。`,
      flatnessRisks: [
        '不要用解释代替冲突。',
        '不要让线索无代价出现。',
      ],
    };
  });
}
```

Include in mock outline return:

```ts
chapterTensionBudgets: createMockTensionBudgets({
  bookId: input.bookId,
  targetChapters: input.targetChapters,
  protagonist,
}),
```

- [x] **Step 4: Add mock flatness scoring**

In mock `chapterAuditor.auditChapter`, add:

```ts
            flatness: {
              conflictEscalation: 78,
              choicePressure: 76,
              consequenceVisibility: 74,
              irreversibleChange: 80,
              hookStrength: 72,
            },
```

- [x] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run tests/mock/story-services.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/mock/story-services.ts tests/mock/story-services.test.ts
git commit -m "feat: add mock tension budgets"
```

## Task 7: IPC Contracts And Detail Payload

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `renderer/types/book-detail.ts`
- Test: `tests/core/ipc-contracts.test.ts`
- Test: `tests/renderer/book-detail.test.tsx`

- [x] **Step 1: Write failing contract test**

In `tests/core/ipc-contracts.test.ts`, add a `chapterTensionBudgets` item to the narrative detail fixture and assert it survives:

```ts
expect(detail.narrative.chapterTensionBudgets[0]).toMatchObject({
  chapterIndex: 1,
  pressureLevel: 'high',
  dominantTension: 'moral_choice',
});
```

- [x] **Step 2: Run test to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts
```

Expected: FAIL because contracts do not include `chapterTensionBudgets`.

- [x] **Step 3: Extend shared contract**

In `src/shared/contracts.ts`, add to the narrative detail type:

```ts
      chapterTensionBudgets: Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        pressureLevel: string;
        dominantTension: string;
        requiredTurn: string;
        forcedChoice: string;
        costToPay: string;
        irreversibleChange: string;
        readerQuestion: string;
        hookPressure: string;
        flatnessRisks: string[];
      }>;
```

Mirror the same shape in `renderer/types/book-detail.ts` if it defines a renderer-local narrative type.

- [x] **Step 4: Keep UI unchanged but type-safe**

If `BookDetail.tsx` destructures `detail.narrative`, ensure default values include the new array:

```ts
const chapterTensionBudgets = detail.narrative.chapterTensionBudgets ?? [];
```

Do not add a full visual panel in this task.

- [x] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts tests/renderer/book-detail.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/shared/contracts.ts renderer/types/book-detail.ts renderer/pages/BookDetail.tsx tests/core/ipc-contracts.test.ts tests/renderer/book-detail.test.tsx
git commit -m "feat: expose chapter tension budgets in detail"
```

## Task 8: Full Verification

**Files:**
- Verify all touched source and tests.

- [x] **Step 1: Run focused suite**

Run:

```bash
pnpm exec vitest run tests/core/narrative-validation.test.ts tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts tests/core/narrative-audit-state-checkpoint.test.ts tests/core/ai-outline.test.ts tests/core/narrative-book-service.test.ts tests/storage/narrative-schema.test.ts tests/storage/books.test.ts tests/mock/story-services.test.ts tests/core/ipc-contracts.test.ts tests/electron/runtime-mock-fallback.test.ts
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [x] **Step 3: Run all tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [x] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean worktree after the previous task commits.

## Self-Review

Spec coverage:

- Chapter tension budget type: Task 1.
- Budget prompt and generation after chapter cards: Tasks 2 and 3.
- Validation: Task 1.
- Context injection: Task 2 and Task 5.
- Flatness audit scoring and decision rules: Tasks 1 and 2.
- Storage: Task 4.
- Book-service and runtime wiring: Task 5.
- Mock mode: Task 6.
- Detail payload: Task 7.
- Checkpoint rebalance and full visual curve are intentionally deferred by the spec rollout phases and are not part of this first implementation plan.

Completion marker scan:

- The plan contains no unfinished markers.
- Every step lists concrete paths, code snippets, commands, and expected outcomes.

Type consistency:

- `ChapterTensionBudget`, `TensionPressureLevel`, `DominantTension`, and `FlatnessScoring` names are consistent across tasks.
- Repository method names are consistently `upsertMany`, `getByChapter`, `listByBook`, `clearByBook`, and `deleteByBook`.
- `NarrativeAudit.scoring.flatness` is optional in types and required only in new tests that construct it.
