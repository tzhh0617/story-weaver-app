# Viral Story Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first version of Story Weaver's viral story protocol so each generated novel carries reader-promise, payoff-cadence, trope-contract, anti-cliche, and viral-audit constraints through planning, drafting, auditing, and UI review.

**Architecture:** Keep the protocol embedded in the existing narrative bible to avoid a new storage table in V1. Add pure core types and helpers first, inject the formatted protocol into prompts and command context, extend audit decision logic, register story-router skills, then expose the strategy and chapter-level viral scores in the existing book detail UI.

**Tech Stack:** TypeScript, React 19, Electron IPC, Vitest, Testing Library, existing SQLite repositories.

---

## File Structure

- Modify: `src/core/narrative/types.ts`
  - Add `ViralStoryProtocol`, `ViralStrategyInput`, enum-like union types, `ViralScoring`, and viral audit issue types.
  - Add optional `viralStoryProtocol` to `NarrativeBible`.
  - Add optional `viral` score object to `NarrativeAudit.scoring`.

- Create: `src/core/narrative/viral-story-protocol.ts`
  - Hold default protocol derivation, input normalization, prompt block formatting, chapter payoff helpers, and validation helpers.
  - Keep this file pure; no model, storage, Electron, or React imports.

- Modify: `src/core/narrative/prompts.ts`
  - Add viral requirements to bible, volume, chapter-card, tension-budget, draft, audit, and revision prompts.

- Modify: `src/core/narrative/context.ts`
  - Accept optional compact viral protocol and preserve its block when trimming command context.

- Modify: `src/core/narrative/audit.ts`
  - Apply viral scoring thresholds in `decideAuditAction`.

- Modify: `src/core/story-router/registry.ts`
  - Register `viral-promise`, `payoff-cadence`, and `anti-cliche`.

- Modify: `src/core/story-router/router.ts`
  - Include the new skills in relevant task routes and add protocol-aware checklist items.

- Modify: `src/core/story-router/prompt-rules.ts`
  - Render a `Viral Protocol` section when provided on the route plan.

- Modify: `src/core/story-router/types.ts`
  - Add optional `viralProtocolLines?: string[]` to `StoryRoutePlan`.

- Modify: `src/core/ai-outline.ts`
  - Ensure parsed narrative bibles include or derive `viralStoryProtocol`.
  - Apply create-time `viralStrategy` as high-priority derivation input.
  - Pass the protocol into volume-plan, chapter-card, and tension-budget prompt builders.

- Modify: `src/core/types.ts`
  - Add optional `viralStrategy` to `OutlineGenerationInput`.

- Modify: `src/core/book-service.ts`
  - Pass the story-bible protocol into command context and route plan formatting.
  - Persist and reload optional create-time viral strategy through the book repository.
  - Include viral audit issues and scores in chapter detail view data.

- Modify: `src/shared/contracts.ts`
  - Extend `BookCreatePayload` with optional `viralStrategy`.
  - Extend `BookDetail.narrative.storyBible` with optional viral strategy summary.
  - Extend chapter detail audit fields with optional viral scoring and issues.

- Modify: `renderer/pages/NewBook.tsx`
  - Add optional viral strategy controls.
  - Submit the selected strategy in the existing create payload.

- Modify: `renderer/pages/BookDetail.tsx`
  - Show a compact viral strategy summary and current chapter viral audit result.

- Modify: `src/mock/story-services.ts`
  - Include deterministic viral protocol data in mock narrative bibles.

- Modify: `src/storage/migrations.ts`
  - Add nullable `viral_strategy_json` to the initial `books` table definition.

- Modify: `src/storage/database.ts`
  - Add an idempotent schema guard for existing databases that do not have `books.viral_strategy_json`.

- Modify: `src/storage/books.ts`
  - Save and return `viralStrategy` with `BookRecord`.

- Test: `tests/core/viral-story-protocol.test.ts`
- Test: `tests/core/narrative-prompts.test.ts`
- Test: `tests/core/narrative-context.test.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`
- Test: `tests/core/story-router.test.ts`
- Test: `tests/core/ai-outline.test.ts`
- Test: `tests/core/ipc-contracts.test.ts`
- Test: `tests/renderer/new-book.test.tsx`
- Test: `tests/renderer/book-detail.test.tsx`
- Test: `tests/electron/runtime-mock-fallback.test.ts`

---

### Task 1: Core Viral Protocol Types And Helpers

**Files:**
- Modify: `src/core/narrative/types.ts`
- Create: `src/core/narrative/viral-story-protocol.ts`
- Test: `tests/core/viral-story-protocol.test.ts`
- Test: `tests/core/narrative-validation.test.ts`

- [ ] **Step 1: Write failing tests for derivation, formatting, and validation**

Create `tests/core/viral-story-protocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { NarrativeBible } from '../../src/core/narrative/types';
import {
  deriveViralStoryProtocol,
  formatViralProtocolForPrompt,
  getExpectedPayoffForChapter,
  validateViralStoryProtocol,
} from '../../src/core/narrative/viral-story-protocol';

function bible(overrides: Partial<NarrativeBible> = {}): NarrativeBible {
  return {
    premise: '被逐出宗门的少年发现旧案仍在吞噬同门命数。',
    genreContract: '仙侠复仇升级，宗门压迫，旧案揭密。',
    targetReaderExperience: '压抑后翻盘，持续真相突破。',
    themeQuestion: '弱者能否夺回命运解释权？',
    themeAnswerDirection: '真正的翻盘来自承担代价后的主动选择。',
    centralDramaticQuestion: '陆照能否查清旧案并反制宗门戒律？',
    endingState: {
      protagonistWins: '陆照夺回命簿解释权。',
      protagonistLoses: '他失去被宗门承认的旧身份。',
      worldChange: '宗门戒律被公开审判。',
      relationshipOutcome: '旧同盟因真相重组。',
      themeAnswer: '自由需要付出被误解的代价。',
    },
    voiceGuide: '紧凑中文网文，压迫感强，动作推动心理。',
    characterArcs: [
      {
        id: 'lu-zhao',
        name: '陆照',
        roleType: 'protagonist',
        desire: '洗清旧案并夺回命运解释权。',
        fear: '再次被宗门定义为罪人。',
        flaw: '习惯独自承担。',
        misbelief: '只要证明清白就能回到旧秩序。',
        wound: '被逐出山门。',
        externalGoal: '找到旧案证据。',
        internalNeed: '承认旧秩序本身有罪。',
        arcDirection: 'growth',
        decisionLogic: '先保护证据，再保护关系。',
        lineWillNotCross: '不牺牲无辜同门。',
        lineMayEventuallyCross: '公开挑战宗门戒律。',
        currentArcPhase: '被动求生。',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'fate-ledger-cost',
        category: 'power',
        ruleText: '命簿能改写记录。',
        cost: '每次改写都会失去一段被珍视的记忆。',
        whoBenefits: '执律堂',
        whoSuffers: '被记录者',
        taboo: '私自翻页',
        violationConsequence: '被宗门追捕',
        allowedException: null,
        currentStatus: '被隐藏',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-old-case',
        type: 'main',
        promise: '旧案真相会反转宗门正义。',
        plantedAt: 1,
        expectedPayoff: 40,
        resolvedAt: null,
        currentState: 'open',
        importance: 'critical',
        payoffMustChange: 'plot',
        ownerCharacterId: 'lu-zhao',
        relatedRelationshipId: null,
        notes: null,
      },
    ],
    ...overrides,
  };
}

describe('viral story protocol', () => {
  it('derives a protocol from the narrative bible when none exists', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
    });

    expect(protocol.readerPromise).toContain('压抑后翻盘');
    expect(protocol.coreDesire).toContain('洗清旧案');
    expect(protocol.hookEngine).toContain('旧案');
    expect(protocol.payoffCadence.minorPayoffEveryChapters).toBe(2);
    expect(protocol.payoffCadence.majorPayoffEveryChapters).toBe(8);
    expect(protocol.tropeContract).toContain('weak_to_strong');
    expect(protocol.antiClicheRules).toContain(
      '每次翻盘必须付出记忆、关系、资源或身份代价。'
    );
  });

  it('keeps explicit protocol values from the bible', () => {
    const explicit = deriveViralStoryProtocol(
      bible({
        viralStoryProtocol: {
          readerPromise: '被所有人低估后，用真相和代价逐层反杀。',
          targetEmotion: 'revenge',
          coreDesire: '让旧案审判者付出代价。',
          protagonistDrive: '每次失去都逼他主动出手。',
          hookEngine: '每个证据都会指向更高层的伪证者。',
          payoffCadence: {
            mode: 'steady',
            minorPayoffEveryChapters: 3,
            majorPayoffEveryChapters: 12,
            payoffTypes: ['truth_reveal', 'enemy_setback'],
          },
          tropeContract: ['revenge_payback', 'weak_to_strong'],
          antiClicheRules: ['反派不能无理由降智。'],
          longTermQuestion: '真正改写命簿的人是谁？',
        },
      }),
      { targetChapters: 80 }
    );

    expect(explicit.readerPromise).toBe(
      '被所有人低估后，用真相和代价逐层反杀。'
    );
    expect(explicit.payoffCadence.minorPayoffEveryChapters).toBe(3);
    expect(explicit.antiClicheRules).toEqual(['反派不能无理由降智。']);
  });

  it('uses create-time viral strategy as derivation input', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
      viralStrategy: {
        readerPayoff: '复仇清算',
        protagonistDesire: '让伪证者付出代价。',
        tropeContracts: ['revenge_payback'],
        cadenceMode: 'suppressed_then_burst',
        antiClicheDirection: '胜利必须来自证据链，不来自身份碾压。',
      },
    });

    expect(protocol.readerPromise).toBe('复仇清算');
    expect(protocol.coreDesire).toBe('让伪证者付出代价。');
    expect(protocol.payoffCadence.mode).toBe('suppressed_then_burst');
    expect(protocol.tropeContract).toEqual(['revenge_payback']);
    expect(protocol.antiClicheRules[0]).toBe(
      '胜利必须来自证据链，不来自身份碾压。'
    );
  });


  it('validates required protocol fields', () => {
    expect(
      validateViralStoryProtocol({
        readerPromise: '',
        targetEmotion: 'revenge',
        coreDesire: '复仇',
        protagonistDrive: '主动查案',
        hookEngine: '旧案递进',
        payoffCadence: {
          mode: 'steady',
          minorPayoffEveryChapters: 2,
          majorPayoffEveryChapters: 8,
          payoffTypes: ['truth_reveal'],
        },
        tropeContract: ['revenge_payback'],
        antiClicheRules: ['反派不降智。'],
        longTermQuestion: '幕后是谁？',
      })
    ).toEqual({
      valid: false,
      issues: ['Viral story protocol must include readerPromise.'],
    });
  });

  it('formats a stable prompt block', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
    });

    const text = formatViralProtocolForPrompt(protocol, {
      chapterIndex: 4,
    });

    expect(text).toContain('Viral Story Protocol');
    expect(text).toContain('Reader promise:');
    expect(text).toContain('Current chapter expected payoff: minor payoff');
    expect(text).toContain('Anti-cliche rules:');
  });

  it('calculates expected payoff from cadence', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
    });

    expect(getExpectedPayoffForChapter(protocol, 2)).toBe('minor payoff');
    expect(getExpectedPayoffForChapter(protocol, 8)).toBe('major payoff');
    expect(getExpectedPayoffForChapter(protocol, 9)).toBe('pressure setup');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm exec vitest run tests/core/viral-story-protocol.test.ts
```

Expected: FAIL because `src/core/narrative/viral-story-protocol.ts` does not exist and viral protocol types are not exported.

- [ ] **Step 3: Add viral protocol types**

In `src/core/narrative/types.ts`, add these types after `ReaderReward`:

```ts
export type ViralTargetEmotion =
  | 'comeback'
  | 'revenge'
  | 'survival'
  | 'wonder'
  | 'romantic_tension'
  | 'power_climb'
  | 'mystery_breakthrough'
  | 'being_chosen'
  | 'moral_pressure';

export type ViralTropeContract =
  | 'rebirth_change_fate'
  | 'system_growth'
  | 'hidden_identity'
  | 'revenge_payback'
  | 'weak_to_strong'
  | 'forbidden_bond'
  | 'case_breaking'
  | 'sect_or_family_pressure'
  | 'survival_game'
  | 'business_or_power_game';

export type ViralPayoffType =
  | 'face_slap'
  | 'upgrade'
  | 'truth_reveal'
  | 'relationship_shift'
  | 'resource_gain'
  | 'local_victory'
  | 'identity_reveal'
  | 'enemy_setback';

export type ViralPayoffCadence = {
  mode: 'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst';
  minorPayoffEveryChapters: number;
  majorPayoffEveryChapters: number;
  payoffTypes: ViralPayoffType[];
};

export type ViralStoryProtocol = {
  readerPromise: string;
  targetEmotion: ViralTargetEmotion;
  coreDesire: string;
  protagonistDrive: string;
  hookEngine: string;
  payoffCadence: ViralPayoffCadence;
  tropeContract: ViralTropeContract[];
  antiClicheRules: string[];
  longTermQuestion: string;
};

export type ViralStrategyInput = {
  readerPayoff?: string;
  protagonistDesire?: string;
  tropeContracts?: ViralTropeContract[];
  cadenceMode?: ViralPayoffCadence['mode'];
  antiClicheDirection?: string;
};

export type ViralScoring = {
  openingHook: number;
  desireClarity: number;
  payoffStrength: number;
  readerQuestionStrength: number;
  tropeFulfillment: number;
  antiClicheFreshness: number;
};
```

Extend `AuditIssueType` with viral issue types:

```ts
  | 'weak_reader_promise'
  | 'unclear_desire'
  | 'missing_payoff'
  | 'payoff_without_cost'
  | 'generic_trope'
  | 'weak_reader_question'
  | 'stale_hook_engine';
```

Add the protocol to `NarrativeBible`:

```ts
  viralStoryProtocol?: ViralStoryProtocol;
```

Add viral scoring to `NarrativeAudit.scoring`:

```ts
    viral?: ViralScoring;
```

- [ ] **Step 4: Add pure helper implementation**

Create `src/core/narrative/viral-story-protocol.ts`:

```ts
import type {
  NarrativeBible,
  ValidationResult,
  ViralPayoffCadence,
  ViralStrategyInput,
  ViralStoryProtocol,
  ViralTargetEmotion,
  ViralTropeContract,
} from './types.js';

function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function firstProtagonistDesire(bible: NarrativeBible) {
  return (
    bible.characterArcs.find((character) => character.roleType === 'protagonist')
      ?.desire ?? bible.centralDramaticQuestion
  );
}

function inferTargetEmotion(text: string): ViralTargetEmotion {
  if (includesAny(text, ['复仇', '反杀', '清算'])) return 'revenge';
  if (includesAny(text, ['悬疑', '真相', '旧案', '破案'])) {
    return 'mystery_breakthrough';
  }
  if (includesAny(text, ['生存', '逃亡', '末日'])) return 'survival';
  if (includesAny(text, ['甜宠', '偏爱', '心动'])) return 'romantic_tension';
  if (includesAny(text, ['权谋', '夺权', '掌权'])) return 'power_climb';
  if (includesAny(text, ['修仙', '神明', '异界'])) return 'wonder';
  return 'comeback';
}

function inferTropeContract(text: string): ViralTropeContract[] {
  const contracts: ViralTropeContract[] = [];
  if (includesAny(text, ['重生', '改命'])) contracts.push('rebirth_change_fate');
  if (includesAny(text, ['系统'])) contracts.push('system_growth');
  if (includesAny(text, ['身份', '伪装', '替身'])) contracts.push('hidden_identity');
  if (includesAny(text, ['复仇', '清算', '反杀'])) contracts.push('revenge_payback');
  if (includesAny(text, ['废柴', '逆袭', '升级', '修仙'])) contracts.push('weak_to_strong');
  if (includesAny(text, ['禁忌', '师徒', '宿敌'])) contracts.push('forbidden_bond');
  if (includesAny(text, ['悬疑', '破案', '旧案', '真相'])) contracts.push('case_breaking');
  if (includesAny(text, ['宗门', '家族'])) contracts.push('sect_or_family_pressure');
  if (includesAny(text, ['生存', '逃亡', '末日'])) contracts.push('survival_game');
  if (includesAny(text, ['权谋', '财团', '公司', '商战'])) {
    contracts.push('business_or_power_game');
  }
  return contracts.length ? [...new Set(contracts)] : ['weak_to_strong'];
}

function inferCadence(text: string, targetChapters: number): ViralPayoffCadence {
  if (includesAny(text, ['慢热', '压抑', '克制'])) {
    return {
      mode: 'suppressed_then_burst',
      minorPayoffEveryChapters: 3,
      majorPayoffEveryChapters: Math.max(10, Math.round(targetChapters / 8)),
      payoffTypes: ['truth_reveal', 'local_victory', 'enemy_setback'],
    };
  }

  if (includesAny(text, ['悬疑', '旧案', '破案'])) {
    return {
      mode: 'steady',
      minorPayoffEveryChapters: 2,
      majorPayoffEveryChapters: Math.max(8, Math.round(targetChapters / 10)),
      payoffTypes: ['truth_reveal', 'enemy_setback', 'local_victory'],
    };
  }

  return {
    mode: 'fast',
    minorPayoffEveryChapters: 2,
    majorPayoffEveryChapters: Math.max(6, Math.round(targetChapters / 12)),
    payoffTypes: ['face_slap', 'upgrade', 'local_victory'],
  };
}

export function deriveViralStoryProtocol(
  bible: NarrativeBible,
  input: { targetChapters: number; viralStrategy?: ViralStrategyInput | null }
): ViralStoryProtocol {
  if (bible.viralStoryProtocol) return bible.viralStoryProtocol;

  const combined = [
    bible.premise,
    bible.genreContract,
    bible.targetReaderExperience,
    bible.centralDramaticQuestion,
    bible.characterArcs.map((character) => character.desire).join(' '),
    bible.narrativeThreads.map((thread) => thread.promise).join(' '),
  ].join(' ');

  const coreDesire =
    input.viralStrategy?.protagonistDesire || firstProtagonistDesire(bible);
  const cadence = inferCadence(combined, input.targetChapters);

  return {
    readerPromise:
      input.viralStrategy?.readerPayoff ||
      bible.targetReaderExperience ||
      bible.genreContract,
    targetEmotion: inferTargetEmotion(
      input.viralStrategy?.readerPayoff
        ? `${input.viralStrategy.readerPayoff} ${combined}`
        : combined
    ),
    coreDesire,
    protagonistDrive: `主角持续主动行动，因为他必须${coreDesire}`,
    hookEngine:
      bible.narrativeThreads.find((thread) => thread.type === 'main')?.promise ??
      bible.centralDramaticQuestion,
    payoffCadence: {
      ...cadence,
      mode: input.viralStrategy?.cadenceMode || cadence.mode,
    },
    tropeContract:
      input.viralStrategy?.tropeContracts?.length
        ? input.viralStrategy.tropeContracts
        : inferTropeContract(combined),
    antiClicheRules: [
      ...(input.viralStrategy?.antiClicheDirection
        ? [input.viralStrategy.antiClicheDirection]
        : []),
      '每次翻盘必须付出记忆、关系、资源或身份代价。',
      '反派不能无理由降智，胜利必须来自主角选择和已铺设规则。',
      '熟悉套路必须通过人物独特选择或世界规则变形获得新鲜感。',
    ],
    longTermQuestion: bible.centralDramaticQuestion,
  };
}

export function validateViralStoryProtocol(
  protocol: ViralStoryProtocol
): ValidationResult {
  const issues: string[] = [];
  if (isBlank(protocol.readerPromise)) {
    issues.push('Viral story protocol must include readerPromise.');
  }
  if (isBlank(protocol.coreDesire)) {
    issues.push('Viral story protocol must include coreDesire.');
  }
  if (isBlank(protocol.hookEngine)) {
    issues.push('Viral story protocol must include hookEngine.');
  }
  if (isBlank(protocol.longTermQuestion)) {
    issues.push('Viral story protocol must include longTermQuestion.');
  }
  if (!protocol.payoffCadence.minorPayoffEveryChapters) {
    issues.push('Viral story protocol must include minor payoff cadence.');
  }
  if (!protocol.payoffCadence.majorPayoffEveryChapters) {
    issues.push('Viral story protocol must include major payoff cadence.');
  }
  return {
    valid: issues.length === 0,
    issues,
  };
}

export function getExpectedPayoffForChapter(
  protocol: ViralStoryProtocol,
  chapterIndex: number
) {
  if (chapterIndex % protocol.payoffCadence.majorPayoffEveryChapters === 0) {
    return 'major payoff';
  }
  if (chapterIndex % protocol.payoffCadence.minorPayoffEveryChapters === 0) {
    return 'minor payoff';
  }
  return 'pressure setup';
}

export function formatViralProtocolForPrompt(
  protocol: ViralStoryProtocol,
  input: { chapterIndex?: number | null } = {}
) {
  const chapterIndex = input.chapterIndex ?? null;
  return [
    'Viral Story Protocol',
    `Reader promise: ${protocol.readerPromise}`,
    `Target emotion: ${protocol.targetEmotion}`,
    `Core desire: ${protocol.coreDesire}`,
    `Protagonist drive: ${protocol.protagonistDrive}`,
    `Hook engine: ${protocol.hookEngine}`,
    `Payoff cadence: ${protocol.payoffCadence.mode}; minor every ${protocol.payoffCadence.minorPayoffEveryChapters} chapters; major every ${protocol.payoffCadence.majorPayoffEveryChapters} chapters`,
    `Payoff types: ${protocol.payoffCadence.payoffTypes.join(', ')}`,
    `Trope contract: ${protocol.tropeContract.join(', ')}`,
    `Long-term question: ${protocol.longTermQuestion}`,
    chapterIndex
      ? `Current chapter expected payoff: ${getExpectedPayoffForChapter(protocol, chapterIndex)}`
      : '',
    'Anti-cliche rules:',
    ...protocol.antiClicheRules.map((rule) => `- ${rule}`),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}
```

- [ ] **Step 5: Validate protocol inside narrative bible validation**

In `src/core/narrative/validation.ts`, import and call the helper:

```ts
import { validateViralStoryProtocol } from './viral-story-protocol.js';
```

Inside `validateNarrativeBible`, before `return result(issues);`, add:

```ts
  if (bible.viralStoryProtocol) {
    issues.push(...validateViralStoryProtocol(bible.viralStoryProtocol).issues);
  }
```

In `tests/core/narrative-validation.test.ts`, add:

```ts
  it('validates optional viral story protocol fields', () => {
    const bible = validBible();
    bible.viralStoryProtocol = {
      readerPromise: '',
      targetEmotion: 'revenge',
      coreDesire: '复仇',
      protagonistDrive: '主动追查。',
      hookEngine: '旧案递进。',
      payoffCadence: {
        mode: 'steady',
        minorPayoffEveryChapters: 2,
        majorPayoffEveryChapters: 8,
        payoffTypes: ['truth_reveal'],
      },
      tropeContract: ['revenge_payback'],
      antiClicheRules: ['反派不降智。'],
      longTermQuestion: '幕后是谁？',
    };

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Viral story protocol must include readerPromise.'
    );
  });
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/core/viral-story-protocol.test.ts tests/core/narrative-validation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/narrative/types.ts src/core/narrative/viral-story-protocol.ts src/core/narrative/validation.ts tests/core/viral-story-protocol.test.ts tests/core/narrative-validation.test.ts
git commit -m "feat: add viral story protocol core"
```

---

### Task 2: Prompt And Command Context Injection

**Files:**
- Modify: `src/core/narrative/prompts.ts`
- Modify: `src/core/narrative/context.ts`
- Modify: `src/core/ai-outline.ts`
- Modify: `src/core/book-service.ts`
- Test: `tests/core/narrative-prompts.test.ts`
- Test: `tests/core/narrative-context.test.ts`
- Test: `tests/core/ai-outline.test.ts`

- [ ] **Step 1: Write failing prompt tests**

Append to `tests/core/narrative-prompts.test.ts`:

```ts
const viralProtocol = {
  readerPromise: '压抑后翻盘。',
  targetEmotion: 'revenge' as const,
  coreDesire: '洗清旧案。',
  protagonistDrive: '证据每次出现都会带来更大代价。',
  hookEngine: '旧案证据逐层指向宗门高层。',
  payoffCadence: {
    mode: 'steady' as const,
    minorPayoffEveryChapters: 2,
    majorPayoffEveryChapters: 8,
    payoffTypes: ['truth_reveal' as const, 'enemy_setback' as const],
  },
  tropeContract: ['revenge_payback' as const, 'weak_to_strong' as const],
  antiClicheRules: ['每次反击必须付出代价。'],
  longTermQuestion: '谁改写了旧案？',
};

it('injects viral protocol guidance into planning prompts', () => {
  expect(
    buildNarrativeBiblePrompt({
      idea: '旧案复仇',
      targetChapters: 80,
      wordsPerChapter: 2500,
    })
  ).toContain('viralStoryProtocol');

  expect(
    buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '旧案复仇。',
      volumePlansText: '第一卷：1-20章。',
      viralStoryProtocol: viralProtocol,
    })
  ).toContain('Viral Story Protocol');

  expect(
    buildTensionBudgetPrompt({
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '旧案复仇。',
      volumePlansText: '第一卷：1-20章。',
      chapterCardsText: 'Chapter 1: 入局。',
      viralStoryProtocol: viralProtocol,
    })
  ).toContain('costToPay must connect to this chapter payoff');
});

it('injects viral protocol into draft and audit prompts', () => {
  const draftPrompt = buildNarrativeDraftPrompt({
    idea: '旧案复仇',
    wordsPerChapter: 2500,
    commandContext: 'Chapter Mission: 入局。',
    viralStoryProtocol: viralProtocol,
    chapterIndex: 2,
  });

  expect(draftPrompt).toContain('Viral Story Protocol');
  expect(draftPrompt).toContain('Current chapter expected payoff: minor payoff');

  const auditPrompt = buildChapterAuditPrompt({
    draft: '陆照赢了，但没有代价。',
    auditContext: 'Chapter Mission: 入局。',
    viralStoryProtocol: viralProtocol,
    chapterIndex: 2,
  });

  expect(auditPrompt).toContain('scoring.viral');
  expect(auditPrompt).toContain('payoff_without_cost');
  expect(auditPrompt).toContain('antiClicheFreshness');
});
```

- [ ] **Step 2: Write failing context tests**

Append to `tests/core/narrative-context.test.ts`:

```ts
it('includes viral protocol in the command context and preserves it when trimmed', () => {
  const result = buildNarrativeCommandContext({
    bible: {
      themeQuestion: '弱者能否夺回命运解释权？',
      themeAnswerDirection: '自由需要承担代价。',
      voiceGuide: '紧凑中文网文。',
      viralStoryProtocol: {
        readerPromise: '压抑后翻盘。',
        targetEmotion: 'revenge',
        coreDesire: '洗清旧案。',
        protagonistDrive: '每个证据都逼主角行动。',
        hookEngine: '旧案证据递进。',
        payoffCadence: {
          mode: 'steady',
          minorPayoffEveryChapters: 2,
          majorPayoffEveryChapters: 8,
          payoffTypes: ['truth_reveal'],
        },
        tropeContract: ['revenge_payback'],
        antiClicheRules: ['反击必须付出代价。'],
        longTermQuestion: '幕后是谁？',
      },
    },
    chapterCard: {
      title: '旧页',
      plotFunction: '开局。',
      externalConflict: '宗门追捕。',
      internalConflict: '想保密却需要求助。',
      relationshipChange: '欠下人情。',
      worldRuleUsedOrTested: 'record-cost',
      informationReveal: '命簿吞记忆。',
      readerReward: 'truth',
      endingHook: '旧页浮现林家姓名。',
      mustChange: '主角开始追查。',
      forbiddenMoves: [],
    },
    tensionBudget: null,
    hardContinuity: ['x'.repeat(1000)],
    characterPressures: [],
    relationshipActions: [],
    threadActions: [],
    worldRules: [],
    recentSummaries: [],
    previousChapterEnding: null,
    maxCharacters: 900,
  });

  expect(result).toContain('Viral Story Protocol');
  expect(result).toContain('Reader promise: 压抑后翻盘。');
  expect(result).toContain('Chapter Mission');
  expect(result.length).toBeLessThanOrEqual(900);
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts
```

Expected: FAIL because prompt builders and context do not accept viral protocol fields.

- [ ] **Step 4: Update prompt builders**

In `src/core/narrative/prompts.ts`, update imports:

```ts
import type { NarrativeAudit, ViralStoryProtocol } from './types.js';
import { formatViralProtocolForPrompt } from './viral-story-protocol.js';
```

Extend input types:

```ts
viralStoryProtocol?: ViralStoryProtocol | null;
chapterIndex?: number | null;
```

Add these lines to `buildNarrativeBiblePrompt`:

```ts
    'The JSON may include viralStoryProtocol with readerPromise, targetEmotion, coreDesire, protagonistDrive, hookEngine, payoffCadence, tropeContract, antiClicheRules, longTermQuestion.',
    'If viralStoryProtocol is included, it must describe reader retention mechanics, not market claims.',
```

Add a local helper:

```ts
function viralPromptBlock(
  protocol: ViralStoryProtocol | null | undefined,
  chapterIndex?: number | null
) {
  return protocol
    ? [formatViralProtocolForPrompt(protocol, { chapterIndex })]
    : [];
}
```

In `buildVolumePlanPrompt`, accept `viralStoryProtocol?: ViralStoryProtocol | null` and add:

```ts
    ...viralPromptBlock(input.viralStoryProtocol),
    'Each volume must include a stage payoff that serves the reader promise when viral protocol is available.',
    'Each volume ending must upgrade the long-term reader question.',
```

In `buildChapterCardPrompt`, accept `viralStoryProtocol?: ViralStoryProtocol | null` and add before opening retention lines:

```ts
    ...viralPromptBlock(input.viralStoryProtocol),
    'When viral protocol is available, each chapter must serve readerPromise and advance or complicate longTermQuestion.',
    'Use payoffCadence to decide whether the chapter needs a minor payoff or major payoff.',
    'When a payoff appears, the card must make the side effect visible through mustChange, endingHook, or forbiddenMoves.',
    'If the chapter uses a familiar trope, state the fresh variation inside plotFunction or informationReveal.',
```

In `buildTensionBudgetPrompt`, accept `viralStoryProtocol?: ViralStoryProtocol | null` and add:

```ts
    ...viralPromptBlock(input.viralStoryProtocol),
    'When viral protocol is available, dominantTension must support the expected payoff or pressure setup.',
    'costToPay must connect to this chapter payoff, breakthrough, or hook engine.',
    'readerQuestion must create specific next-chapter action pressure.',
```

In `buildNarrativeDraftPrompt`, accept `viralStoryProtocol?: ViralStoryProtocol | null` and `chapterIndex?: number | null`, then add before `input.commandContext`:

```ts
    ...viralPromptBlock(input.viralStoryProtocol, input.chapterIndex),
```

In `buildChapterAuditPrompt`, accept the same fields and update the JSON requirement:

```ts
    'Return valid JSON only with passed, score, decision, issues, scoring, stateUpdates.',
    'When viral protocol is provided, scoring must include scoring.viral: openingHook, desireClarity, payoffStrength, readerQuestionStrength, tropeFulfillment, antiClicheFreshness.',
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward, flat_chapter, weak_choice_pressure, missing_consequence, soft_hook, repeated_tension_pattern, weak_reader_promise, unclear_desire, missing_payoff, payoff_without_cost, generic_trope, weak_reader_question, stale_hook_engine.',
```

Add the viral prompt block before route plan text:

```ts
    ...viralPromptBlock(input.viralStoryProtocol, input.chapterIndex),
```

In `buildRevisionPrompt`, add:

```ts
    'If an issue is viral-specific, preserve the chapter direction and fix the reader-promise, payoff, cost, hook, or anti-cliche failure locally.',
```

- [ ] **Step 5: Update command context**

In `src/core/narrative/context.ts`, import the type and formatter:

```ts
import type { ViralStoryProtocol } from './types.js';
import { formatViralProtocolForPrompt } from './viral-story-protocol.js';
```

Extend `CompactBible`:

```ts
  viralStoryProtocol?: ViralStoryProtocol | null;
```

In `buildNarrativeCommandContext`, create:

```ts
  const viralProtocolLines = input.bible.viralStoryProtocol
    ? [formatViralProtocolForPrompt(input.bible.viralStoryProtocol)]
    : [];
```

Add `...viralProtocolLines` near the beginning of `requiredTail`, before tension budget:

```ts
  const requiredTail = [
    ...viralProtocolLines,
    ...tensionBudgetLines,
    'Chapter Mission:',
```

- [ ] **Step 6: Thread protocol through outline and drafting**

In `src/core/types.ts`, import `ViralStrategyInput` and extend `OutlineGenerationInput`:

```ts
import type {
  ChapterCard,
  ChapterCharacterPressure,
  ChapterRelationshipAction,
  ChapterTensionBudget,
  ChapterThreadAction,
  NarrativeBible,
  ViralStrategyInput,
  VolumePlan,
} from './narrative/types.js';
```

```ts
  viralStrategy?: ViralStrategyInput | null;
```

In `src/core/ai-outline.ts`, import:

```ts
import { deriveViralStoryProtocol } from './narrative/viral-story-protocol.js';
```

After narrative bible validation succeeds, derive and attach the protocol:

```ts
        const viralStoryProtocol = deriveViralStoryProtocol(narrativeBible, {
          targetChapters: input.targetChapters,
          viralStrategy: input.viralStrategy ?? null,
        });
        narrativeBible = {
          ...narrativeBible,
          viralStoryProtocol,
        };
```

Pass `viralStoryProtocol` into `buildVolumePlanPrompt`, `buildChapterCardPrompt`, and `buildTensionBudgetPrompt`.

In `src/core/book-service.ts`, reduce repeated bible lookups:

```ts
      const storyBible = deps.storyBibles?.getByBook?.(bookId) ?? null;
```

When starting outline generation, pass the persisted create-time strategy:

```ts
        viralStrategy: book.viralStrategy ?? null,
```

Use it in `buildNarrativeCommandContext`:

```ts
            bible: {
              themeQuestion: storyBible?.themeQuestion ?? '',
              themeAnswerDirection: storyBible?.themeAnswerDirection ?? '',
              voiceGuide: storyBible?.voiceGuide ?? '',
              viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
            },
```

Pass it to `buildNarrativeDraftPrompt`:

```ts
            viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
            chapterIndex: nextChapter.chapterIndex,
```

Pass it to `chapterAuditor.auditChapter` by extending the call input only after Task 3 updates the auditor prompt wrapper. If the current `auditChapter` signature does not accept those fields, keep viral protocol in `auditContext` through command context for this task.

- [ ] **Step 7: Update ai-outline tests**

In `tests/core/ai-outline.test.ts`, update the valid narrative bible fixture to include no explicit `viralStoryProtocol`; assert generation derives one:

```ts
expect(result.narrativeBible?.viralStoryProtocol).toMatchObject({
  readerPromise: expect.any(String),
  coreDesire: expect.any(String),
  hookEngine: expect.any(String),
});
```

Also assert planning prompts receive the block by checking captured prompts:

```ts
expect(prompts.some((prompt) => prompt.includes('Viral Story Protocol'))).toBe(true);
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts tests/core/ai-outline.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/core/narrative/prompts.ts src/core/narrative/context.ts src/core/ai-outline.ts src/core/book-service.ts tests/core/narrative-prompts.test.ts tests/core/narrative-context.test.ts tests/core/ai-outline.test.ts
git commit -m "feat: inject viral protocol into narrative prompts"
```

---

### Task 3: Viral Audit Scoring And Decision Rules

**Files:**
- Modify: `src/core/narrative/audit.ts`
- Modify: `src/core/ai-post-chapter.ts`
- Test: `tests/core/narrative-audit-state-checkpoint.test.ts`
- Test: `tests/core/narrative-prompts.test.ts`
- Test: `tests/core/ai-post-chapter.test.ts`

- [ ] **Step 1: Write failing audit decision tests**

Append to `tests/core/narrative-audit-state-checkpoint.test.ts`:

```ts
  it('revises strict opening chapters with weak viral opening hook', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 90,
          decision: 'accept',
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
            viral: {
              openingHook: 79,
              desireClarity: 90,
              payoffStrength: 90,
              readerQuestionStrength: 90,
              tropeFulfillment: 90,
              antiClicheFreshness: 90,
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

  it('revises chapters with payoff without cost', () => {
    expect(
      decideAuditAction({
        passed: true,
        score: 92,
        decision: 'accept',
        issues: [
          {
            type: 'payoff_without_cost',
            severity: 'minor',
            evidence: '主角直接胜利，没有副作用。',
            fixInstruction: '增加关系代价。',
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
          viral: {
            openingHook: 90,
            desireClarity: 90,
            payoffStrength: 90,
            readerQuestionStrength: 90,
            tropeFulfillment: 90,
            antiClicheFreshness: 90,
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

  it('rewrites chapters that miss both reader promise and desire', () => {
    expect(
      decideAuditAction({
        passed: false,
        score: 62,
        decision: 'revise',
        issues: [
          {
            type: 'weak_reader_promise',
            severity: 'major',
            evidence: '本章没有服务压抑后翻盘。',
            fixInstruction: '重建章节目标。',
          },
          {
            type: 'unclear_desire',
            severity: 'major',
            evidence: '主角没有主动目标。',
            fixInstruction: '重建主角行动线。',
          },
        ],
        scoring: {
          characterLogic: 70,
          mainlineProgress: 70,
          relationshipChange: 70,
          conflictDepth: 70,
          worldRuleCost: 70,
          threadManagement: 70,
          pacingReward: 70,
          themeAlignment: 70,
          viral: {
            openingHook: 70,
            desireClarity: 40,
            payoffStrength: 65,
            readerQuestionStrength: 70,
            tropeFulfillment: 70,
            antiClicheFreshness: 70,
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
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts
```

Expected: FAIL because viral scoring is ignored by `decideAuditAction`.

- [ ] **Step 3: Implement viral audit decision rules**

In `src/core/narrative/audit.ts`, add:

```ts
function hasIssue(audit: NarrativeAudit, type: NarrativeAudit['issues'][number]['type']) {
  return audit.issues.some((issue) => issue.type === type);
}
```

Inside `decideAuditAction`, after blocker checks and before flatness checks:

```ts
  const viral = audit.scoring.viral;
  if (viral) {
    if (
      hasIssue(audit, 'weak_reader_promise') &&
      (hasIssue(audit, 'unclear_desire') || viral.desireClarity < 50)
    ) {
      return 'rewrite';
    }

    if (
      isOpeningStrictChapter(context.chapterIndex) &&
      viral.openingHook < 80
    ) {
      return 'revise';
    }

    if (
      viral.desireClarity < 65 ||
      viral.payoffStrength < 70 ||
      viral.readerQuestionStrength < 70 ||
      viral.antiClicheFreshness < 50 ||
      hasIssue(audit, 'missing_payoff') ||
      hasIssue(audit, 'payoff_without_cost') ||
      hasIssue(audit, 'generic_trope') ||
      hasIssue(audit, 'weak_reader_question') ||
      hasIssue(audit, 'stale_hook_engine')
    ) {
      return 'revise';
    }
  }
```

- [ ] **Step 4: Thread viral fields through the AI post-chapter auditor**

Open `src/core/ai-post-chapter.ts`. Find the `auditChapter` input type and add:

```ts
  viralStoryProtocol?: ViralStoryProtocol | null;
  chapterIndex?: number | null;
```

Import `ViralStoryProtocol` from `./narrative/types.js` if needed.

When calling `buildChapterAuditPrompt(input)`, pass the new fields through. The existing code should already pass the full input object; if it destructures fields, add `viralStoryProtocol` and `chapterIndex`.

In `src/core/book-service.ts`, update `deps.chapterAuditor.auditChapter` call:

```ts
          viralStoryProtocol: storyBible?.viralStoryProtocol ?? null,
          chapterIndex: nextChapter.chapterIndex,
```

- [ ] **Step 5: Add prompt and auditor tests**

In `tests/core/ai-post-chapter.test.ts`, add a test matching the local mock style:

```ts
it('passes viral protocol fields into audit prompts', async () => {
  const prompts: string[] = [];
  const auditor = createAiPostChapterService({
    registry: { languageModel: () => ({}) },
    generateText: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        text: JSON.stringify({
          passed: true,
          score: 90,
          decision: 'accept',
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
            viral: {
              openingHook: 90,
              desireClarity: 90,
              payoffStrength: 90,
              readerQuestionStrength: 90,
              tropeFulfillment: 90,
              antiClicheFreshness: 90,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        }),
      };
    },
  });

  await auditor.auditChapter({
    modelId: 'model-1',
    draft: '陆照找到证据。',
    auditContext: 'Chapter Mission: 找到证据。',
    chapterIndex: 2,
    viralStoryProtocol: {
      readerPromise: '压抑后翻盘。',
      targetEmotion: 'revenge',
      coreDesire: '洗清旧案。',
      protagonistDrive: '证据逼他行动。',
      hookEngine: '旧案递进。',
      payoffCadence: {
        mode: 'steady',
        minorPayoffEveryChapters: 2,
        majorPayoffEveryChapters: 8,
        payoffTypes: ['truth_reveal'],
      },
      tropeContract: ['revenge_payback'],
      antiClicheRules: ['反击必须付出代价。'],
      longTermQuestion: '幕后是谁？',
    },
  });

  expect(prompts[0]).toContain('Viral Story Protocol');
  expect(prompts[0]).toContain('Current chapter expected payoff: minor payoff');
});
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/core/narrative-audit-state-checkpoint.test.ts tests/core/narrative-prompts.test.ts tests/core/ai-post-chapter.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/narrative/audit.ts src/core/ai-post-chapter.ts src/core/book-service.ts tests/core/narrative-audit-state-checkpoint.test.ts tests/core/narrative-prompts.test.ts tests/core/ai-post-chapter.test.ts
git commit -m "feat: audit viral story protocol"
```

---

### Task 4: Story Router Viral Skills

**Files:**
- Modify: `src/core/story-router/types.ts`
- Modify: `src/core/story-router/registry.ts`
- Modify: `src/core/story-router/router.ts`
- Modify: `src/core/story-router/prompt-rules.ts`
- Test: `tests/core/story-router.test.ts`

- [ ] **Step 1: Write failing router tests**

Update `tests/core/story-router.test.ts` first test expected required skills to include viral skills:

```ts
    expect(plan.requiredSkills.map((skill) => skill.id)).toEqual([
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'dialogue-control',
      'genre-pattern',
      'viral-promise',
      'payoff-cadence',
      'anti-cliche',
      'prose-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ]);
```

Update the `design_opening` expectation:

```ts
    expect(plan.requiredSkills.map((skill) => skill.id)).toEqual([
      'story-structure',
      'chapter-goal',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'genre-pattern',
      'viral-promise',
      'anti-cliche',
      'pacing-audit',
    ]);
```

Append:

```ts
  it('formats viral protocol lines when provided', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    const text = formatStoryRoutePlanForPrompt({
      ...plan,
      viralProtocolLines: [
        'Viral Story Protocol',
        'Reader promise: 压抑后翻盘。',
      ],
    });

    expect(text).toContain('Viral Protocol');
    expect(text).toContain('Reader promise: 压抑后翻盘。');
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/story-router.test.ts
```

Expected: FAIL because the new skill ids and route-plan property do not exist.

- [ ] **Step 3: Add route plan viral lines**

In `src/core/story-router/types.ts`, extend `StoryRoutePlan`:

```ts
  viralProtocolLines?: string[];
```

In `src/core/story-router/prompt-rules.ts`, render after opening retention:

```ts
    ...(plan.viralProtocolLines?.length
      ? [
          ...renderSection('Viral Protocol', plan.viralProtocolLines),
          '',
        ]
      : []),
```

- [ ] **Step 4: Register viral skills**

In `src/core/story-router/registry.ts`, insert after `genre-pattern`:

```ts
  {
    id: 'viral-promise',
    name: '读者承诺',
    type: 'process',
    priority: 58,
    rigidity: 'hard',
    triggers: ['design_opening', 'write_chapter', 'revise_chapter', 'audit_story'],
    requiredContext: ['narrativeBible'],
    promptRules: [
      '本章必须服务作品读者承诺。',
      '主角行动必须能看出核心欲望。',
      '不允许只靠设定解释读者爽点。',
    ],
    auditQuestions: ['本章是否服务 readerPromise？', '主角欲望是否清晰可见？'],
    redFlags: ['读者承诺只停留在设定，没有进入场景行动。'],
  },
  {
    id: 'payoff-cadence',
    name: '回报节奏',
    type: 'execution',
    priority: 57,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter', 'audit_story'],
    requiredContext: ['narrativeBible', 'chapterCard', 'tensionBudget'],
    promptRules: [
      '按回报节奏判断本章是否需要 minor payoff 或 major payoff。',
      '回报必须带副作用、债务、误判或新敌意。',
      '连续压抑章节必须有补偿性信息、关系或能力推进。',
    ],
    auditQuestions: ['本章是否兑现应有回报？', '回报是否带来可见代价？'],
    redFlags: ['爽点没有代价。', '连续压抑但没有补偿性推进。'],
  },
  {
    id: 'anti-cliche',
    name: '反套路保护',
    type: 'execution',
    priority: 56,
    rigidity: 'soft',
    triggers: ['design_opening', 'write_chapter', 'revise_chapter'],
    requiredContext: ['genreContract', 'worldRules'],
    promptRules: [
      '类型套路可以使用，但必须有具体变形。',
      '禁止使用没有代价的万能系统、没有逻辑的突然打脸、没有铺垫的身份碾压。',
      '熟悉桥段必须由人物独特选择或世界规则变形来获得新鲜感。',
    ],
    auditQuestions: ['熟悉桥段是否有新鲜变形？'],
    redFlags: ['万能系统无代价。', '反派无理由降智。', '身份碾压没有铺垫。'],
  },
```

- [ ] **Step 5: Update task routes and checklist**

In `src/core/story-router/router.ts`, add to `write_chapter.required` after `genre-pattern`:

```ts
      'viral-promise',
      'payoff-cadence',
      'anti-cliche',
```

Add to `revise_chapter.required` after `hook-technique`:

```ts
      'viral-promise',
      'payoff-cadence',
      'anti-cliche',
```

Add to `design_opening.required` after `genre-pattern`:

```ts
      'viral-promise',
      'anti-cliche',
```

Add to `audit_story.required` after `genre-pattern`:

```ts
      'viral-promise',
      'payoff-cadence',
```

Extend `baseChecklist`:

```ts
  '必须服务作品读者承诺。',
  '应有回报必须带代价或副作用。',
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/core/story-router.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/story-router/types.ts src/core/story-router/registry.ts src/core/story-router/router.ts src/core/story-router/prompt-rules.ts tests/core/story-router.test.ts
git commit -m "feat: route viral story skills"
```

---

### Task 5: Contracts, Storage, Mock Data, And Book Detail Payload

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/storage/migrations.ts`
- Modify: `src/storage/database.ts`
- Modify: `src/storage/books.ts`
- Modify: `src/mock/story-services.ts`
- Modify: `src/core/book-service.ts`
- Test: `tests/core/ipc-contracts.test.ts`
- Test: `tests/storage/books.test.ts`
- Test: `tests/electron/runtime-mock-fallback.test.ts`
- Test: `tests/core/book-service.test.ts`

- [ ] **Step 1: Write failing contract tests**

In `tests/core/ipc-contracts.test.ts`, add:

```ts
  it('accepts optional viral strategy in book creation payloads', () => {
    expect(() =>
      assertIpcPayload(ipcChannels.bookCreate, {
        idea: '旧案复仇',
        targetChapters: 500,
        wordsPerChapter: 2500,
        viralStrategy: {
          readerPayoff: '复仇',
          protagonistDesire: '洗清旧案',
          tropeContracts: ['revenge_payback'],
          cadenceMode: 'steady',
          antiClicheDirection: '反派不降智',
        },
      })
    ).not.toThrow();
  });
```

In `tests/electron/runtime-mock-fallback.test.ts`, extend existing detail expectations:

```ts
expect(detail?.narrative?.storyBible?.viralStoryProtocol).toMatchObject({
  readerPromise: expect.any(String),
  coreDesire: expect.any(String),
  hookEngine: expect.any(String),
});
```

In `tests/storage/books.test.ts`, add a repository test matching the file's setup style:

```ts
it('persists optional viral strategy with the book record', () => {
  const repo = createBookRepository(db);

  repo.create({
    id: 'book-viral',
    title: '新书',
    idea: '旧案复仇',
    targetChapters: 500,
    wordsPerChapter: 2500,
    viralStrategy: {
      readerPayoff: 'revenge',
      protagonistDesire: '洗清旧案',
      tropeContracts: ['revenge_payback'],
      cadenceMode: 'steady',
      antiClicheDirection: '反派不降智',
    },
  });

  expect(repo.getById('book-viral')?.viralStrategy).toEqual({
    readerPayoff: 'revenge',
    protagonistDesire: '洗清旧案',
    tropeContracts: ['revenge_payback'],
    cadenceMode: 'steady',
    antiClicheDirection: '反派不降智',
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts tests/storage/books.test.ts tests/electron/runtime-mock-fallback.test.ts
```

Expected: FAIL because payload, storage, and detail contracts do not include viral fields.

- [ ] **Step 3: Extend shared contract types and validation**

In `src/shared/contracts.ts`, add:

```ts
export type ViralStrategyPayload = {
  readerPayoff?: string;
  protagonistDesire?: string;
  tropeContracts?: string[];
  cadenceMode?: 'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst';
  antiClicheDirection?: string;
};
```

Extend `BookCreatePayload`:

```ts
  viralStrategy?: ViralStrategyPayload;
```

Extend `BookRecord`:

```ts
  viralStrategy?: ViralStrategyPayload | null;
```

Add validators:

```ts
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isViralStrategyPayload(value: unknown): value is ViralStrategyPayload {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const cadence = value.cadenceMode;
  return (
    (value.readerPayoff === undefined || typeof value.readerPayoff === 'string') &&
    (value.protagonistDesire === undefined || typeof value.protagonistDesire === 'string') &&
    (value.tropeContracts === undefined || isStringArray(value.tropeContracts)) &&
    (cadence === undefined ||
      cadence === 'fast' ||
      cadence === 'steady' ||
      cadence === 'slow_burn' ||
      cadence === 'suppressed_then_burst') &&
    (value.antiClicheDirection === undefined ||
      typeof value.antiClicheDirection === 'string')
  );
}
```

Update `isBookCreatePayload`:

```ts
    isPositiveInteger(payload.wordsPerChapter) &&
    isViralStrategyPayload(payload.viralStrategy)
```

- [ ] **Step 4: Persist viral strategy in books**

In `src/storage/migrations.ts`, add the nullable column to the initial `CREATE TABLE IF NOT EXISTS books` statement:

```sql
    viral_strategy_json TEXT,
```

Place it after `words_per_chapter INTEGER NOT NULL,`.

In `src/storage/database.ts`, add this helper near `shouldResetDevelopmentStorySchema`:

```ts
function ensureBookViralStrategyColumn(db: SqliteDatabase) {
  const columns = db
    .prepare('PRAGMA table_info(books)')
    .all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has('viral_strategy_json')) {
    db.prepare('ALTER TABLE books ADD COLUMN viral_strategy_json TEXT').run();
  }
}
```

Call it inside `runMigrations` immediately after the first migration loop:

```ts
  ensureBookViralStrategyColumn(db);
```

In `src/storage/books.ts`, extend `NewBookInput`:

```ts
type NewBookInput = Pick<
  BookRecord,
  'id' | 'title' | 'idea' | 'targetChapters' | 'wordsPerChapter' | 'viralStrategy'
>;
```

Add a parser:

```ts
function parseViralStrategy(value: string | null) {
  if (!value) return null;
  return JSON.parse(value) as BookRecord['viralStrategy'];
}
```

In `create`, add `viral_strategy_json` to the insert columns and values:

```sql
            viral_strategy_json,
```

```sql
            @viralStrategyJson,
```

Add this value to `.run`:

```ts
        viralStrategyJson: input.viralStrategy
          ? JSON.stringify(input.viralStrategy)
          : null,
```

In `list()` and `getById()`, select:

```sql
              viral_strategy_json AS viralStrategyJson,
```

Map rows instead of casting directly:

```ts
    list(): BookRecord[] {
      const rows = db
        .prepare(
          `
            SELECT
              id,
              title,
              idea,
              status,
              target_chapters AS targetChapters,
              words_per_chapter AS wordsPerChapter,
              viral_strategy_json AS viralStrategyJson,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM books
            ORDER BY created_at DESC
          `
        )
        .all() as Array<BookRecord & { viralStrategyJson: string | null }>;

      return rows.map(({ viralStrategyJson, ...row }) => ({
        ...row,
        viralStrategy: parseViralStrategy(viralStrategyJson),
      }));
    },
```

Use the same row mapping in `getById()`.

- [ ] **Step 5: Pass create-time strategy through book service**

In `src/core/book-service.ts`, extend `createBook` input:

```ts
      viralStrategy?: BookRecord['viralStrategy'];
```

Pass it into `deps.books.create`:

```ts
        viralStrategy: input.viralStrategy ?? null,
```

When calling `deps.outlineService.generateFromIdea`, pass:

```ts
        viralStrategy: book.viralStrategy ?? null,
```

Extend `BookDetail.narrative.storyBible`:

```ts
      viralStoryProtocol?: {
        readerPromise: string;
        targetEmotion: string;
        coreDesire: string;
        protagonistDrive: string;
        hookEngine: string;
        payoffCadence: {
          mode: string;
          minorPayoffEveryChapters: number;
          majorPayoffEveryChapters: number;
          payoffTypes: string[];
        };
        tropeContract: string[];
        antiClicheRules: string[];
        longTermQuestion: string;
      } | null;
```

Extend chapter fields:

```ts
    auditViralScore?: number | null;
    auditViralIssues?: Array<{
      type: string;
      severity: string;
      evidence: string;
      fixInstruction: string;
    }>;
```

- [ ] **Step 6: Include viral protocol in mock service bible**

In `src/mock/story-services.ts`, add `viralStoryProtocol` to the deterministic `narrativeBible` object:

```ts
        viralStoryProtocol: {
          readerPromise: `${genre.tone}，以阶段翻盘和真相突破维持追读。`,
          targetEmotion: genre.id === 'urban-ability' ? 'mystery_breakthrough' : 'revenge',
          coreDesire: genre.conflict,
          protagonistDrive: '每个线索都会带来更高代价，迫使主角主动行动。',
          hookEngine: genre.pressureSources.join('、'),
          payoffCadence: {
            mode: 'steady',
            minorPayoffEveryChapters: 2,
            majorPayoffEveryChapters: 8,
            payoffTypes: ['truth_reveal', 'local_victory', 'enemy_setback'],
          },
          tropeContract:
            genre.id === 'urban-ability'
              ? ['case_breaking', 'business_or_power_game']
              : ['revenge_payback', 'weak_to_strong', 'sect_or_family_pressure'],
          antiClicheRules: [
            '反派不能无理由降智。',
            '每次翻盘都必须付出资源、关系或身份代价。',
          ],
          longTermQuestion: genre.conflict,
        },
```

- [ ] **Step 7: Include viral fields in book detail payload**

In `src/core/book-service.ts`, find `getBookDetail`. When constructing `narrative.storyBible`, include:

```ts
          viralStoryProtocol: storyBible.viralStoryProtocol ?? null,
```

When mapping chapters, calculate viral score:

```ts
        const viral = latestAudit?.audit.scoring.viral;
        const auditViralScore = viral
          ? Math.round(
              (viral.openingHook +
                viral.desireClarity +
                viral.payoffStrength +
                viral.readerQuestionStrength +
                viral.tropeFulfillment +
                viral.antiClicheFreshness) /
                6
            )
          : null;
        const auditViralIssues =
          latestAudit?.audit.issues.filter((issue) =>
            [
              'weak_reader_promise',
              'unclear_desire',
              'missing_payoff',
              'payoff_without_cost',
              'generic_trope',
              'weak_reader_question',
              'stale_hook_engine',
            ].includes(issue.type)
          ) ?? [];
```

Return those fields on each chapter:

```ts
          auditViralScore,
          auditViralIssues,
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/core/ipc-contracts.test.ts tests/storage/books.test.ts tests/electron/runtime-mock-fallback.test.ts tests/core/book-service.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/shared/contracts.ts src/storage/migrations.ts src/storage/database.ts src/storage/books.ts src/mock/story-services.ts src/core/book-service.ts tests/core/ipc-contracts.test.ts tests/storage/books.test.ts tests/electron/runtime-mock-fallback.test.ts tests/core/book-service.test.ts
git commit -m "feat: expose viral story protocol data"
```

---

### Task 6: New Book Viral Strategy UI And Detail Summary

**Files:**
- Modify: `renderer/pages/NewBook.tsx`
- Modify: `renderer/pages/BookDetail.tsx`
- Modify: `renderer/App.tsx`
- Test: `tests/renderer/new-book.test.tsx`
- Test: `tests/renderer/book-detail.test.tsx`

- [ ] **Step 1: Write failing NewBook tests**

Append to `tests/renderer/new-book.test.tsx`:

```tsx
  it('submits optional viral strategy fields', () => {
    const onCreate = vi.fn();

    render(<NewBook onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText('故事设想'), {
      target: { value: '被逐出宗门的少年追查旧案。' },
    });
    fireEvent.change(screen.getByLabelText('读者爽点'), {
      target: { value: 'revenge' },
    });
    fireEvent.change(screen.getByLabelText('主角欲望'), {
      target: { value: '洗清旧案并反制宗门。' },
    });
    fireEvent.change(screen.getByLabelText('节奏偏好'), {
      target: { value: 'steady' },
    });
    fireEvent.change(screen.getByLabelText('反套路方向'), {
      target: { value: '反派不降智，胜利必须付出代价。' },
    });
    fireEvent.click(screen.getByText('开始写作'));

    expect(onCreate).toHaveBeenCalledWith({
      idea: '被逐出宗门的少年追查旧案。',
      targetChapters: 500,
      wordsPerChapter: 2500,
      viralStrategy: {
        readerPayoff: 'revenge',
        protagonistDesire: '洗清旧案并反制宗门。',
        tropeContracts: [],
        cadenceMode: 'steady',
        antiClicheDirection: '反派不降智，胜利必须付出代价。',
      },
    });
  });
```

- [ ] **Step 2: Write failing detail tests**

In `tests/renderer/book-detail.test.tsx`, add a detail fixture with:

```ts
narrative: {
  storyBible: {
    themeQuestion: '弱者能否夺回命运解释权？',
    themeAnswerDirection: '自由需要承担代价。',
    centralDramaticQuestion: '幕后是谁？',
    viralStoryProtocol: {
      readerPromise: '压抑后翻盘。',
      targetEmotion: 'revenge',
      coreDesire: '洗清旧案。',
      protagonistDrive: '证据逼主角行动。',
      hookEngine: '旧案递进。',
      payoffCadence: {
        mode: 'steady',
        minorPayoffEveryChapters: 2,
        majorPayoffEveryChapters: 8,
        payoffTypes: ['truth_reveal'],
      },
      tropeContract: ['revenge_payback'],
      antiClicheRules: ['反击必须付出代价。'],
      longTermQuestion: '幕后是谁？',
    },
  },
  chapterCards: [],
  chapterTensionBudgets: [],
  narrativeCheckpoints: [],
},
chapters: [
  {
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex: 1,
    title: '旧页',
    outline: '',
    content: '正文',
    summary: null,
    wordCount: 2,
    auditViralScore: 72,
    auditViralIssues: [
      {
        type: 'payoff_without_cost',
        severity: 'major',
        evidence: '反击没有副作用。',
        fixInstruction: '增加关系代价。',
      },
    ],
  },
],
```

Add assertions:

```tsx
expect(screen.getByText('爆款策略')).toBeInTheDocument();
expect(screen.getByText('压抑后翻盘。')).toBeInTheDocument();
expect(screen.getByText('爆款审计')).toBeInTheDocument();
expect(screen.getByText('72')).toBeInTheDocument();
expect(screen.getByText('回报无代价')).toBeInTheDocument();
```

- [ ] **Step 3: Run renderer tests to verify failure**

Run:

```bash
pnpm exec vitest run tests/renderer/new-book.test.tsx tests/renderer/book-detail.test.tsx
```

Expected: FAIL because the UI does not render or submit viral strategy fields.

- [ ] **Step 4: Add NewBook controls**

In `renderer/pages/NewBook.tsx`, add state:

```tsx
  const [readerPayoff, setReaderPayoff] = useState('');
  const [protagonistDesire, setProtagonistDesire] = useState('');
  const [cadenceMode, setCadenceMode] = useState<
    'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst' | ''
  >('');
  const [antiClicheDirection, setAntiClicheDirection] = useState('');
```

Extend `onCreate` prop type:

```tsx
    viralStrategy?: {
      readerPayoff?: string;
      protagonistDesire?: string;
      tropeContracts?: string[];
      cadenceMode?: 'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst';
      antiClicheDirection?: string;
    };
```

Before calling `onCreate`, build:

```tsx
            const viralStrategy = {
              readerPayoff,
              protagonistDesire,
              tropeContracts: [],
              cadenceMode: cadenceMode || undefined,
              antiClicheDirection,
            };
            const result = onCreate({
              idea,
              targetChapters,
              wordsPerChapter,
              viralStrategy:
                readerPayoff ||
                protagonistDesire ||
                cadenceMode ||
                antiClicheDirection
                  ? viralStrategy
                  : undefined,
            });
```

Add fields before the submit button:

```tsx
            <div className="grid gap-4 border-t pt-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">爆款策略</h3>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-book-reader-payoff">读者爽点</Label>
                <select
                  id="new-book-reader-payoff"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                  value={readerPayoff}
                  onChange={(event) => setReaderPayoff(event.target.value)}
                >
                  <option value="">自动判断</option>
                  <option value="comeback">逆袭</option>
                  <option value="revenge">复仇</option>
                  <option value="mystery_breakthrough">解谜</option>
                  <option value="power_climb">权谋</option>
                  <option value="romantic_tension">甜宠拉扯</option>
                  <option value="survival">生存</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-book-protagonist-desire">主角欲望</Label>
                <Input
                  id="new-book-protagonist-desire"
                  value={protagonistDesire}
                  onChange={(event) => setProtagonistDesire(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-book-cadence-mode">节奏偏好</Label>
                <select
                  id="new-book-cadence-mode"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
                  value={cadenceMode}
                  onChange={(event) =>
                    setCadenceMode(
                      event.target.value as
                        | 'fast'
                        | 'steady'
                        | 'slow_burn'
                        | 'suppressed_then_burst'
                        | ''
                    )
                  }
                >
                  <option value="">自动判断</option>
                  <option value="fast">快爽</option>
                  <option value="steady">稳爽</option>
                  <option value="slow_burn">悬疑递进</option>
                  <option value="suppressed_then_burst">压抑后爆发</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-book-anti-cliche">反套路方向</Label>
                <Input
                  id="new-book-anti-cliche"
                  value={antiClicheDirection}
                  onChange={(event) => setAntiClicheDirection(event.target.value)}
                />
              </div>
            </div>
```

- [ ] **Step 5: Pass payload through App**

`renderer/App.tsx` already forwards `input` to `ipcChannels.bookCreate`. Keep that forwarding intact so `viralStrategy` reaches IPC with the rest of the create payload.

- [ ] **Step 6: Add detail sections**

In `renderer/pages/BookDetail.tsx`, add labels:

```tsx
const viralIssueLabels: Record<string, string> = {
  weak_reader_promise: '读者承诺弱',
  unclear_desire: '欲望不清',
  missing_payoff: '缺少回报',
  payoff_without_cost: '回报无代价',
  generic_trope: '套路陈旧',
  weak_reader_question: '追读问题弱',
  stale_hook_engine: '钩子机制疲劳',
};
```

Add a component:

```tsx
function ViralProtocolSection({
  protocol,
}: {
  protocol: NonNullable<
    NonNullable<BookDetail['narrative']>['storyBible']
  >['viralStoryProtocol'];
}) {
  if (!protocol) return null;

  return (
    <DetailSection title="爆款策略">
      <dl className="grid gap-2">
        <div>
          <dt className="text-xs font-semibold text-foreground">读者承诺</dt>
          <dd>{protocol.readerPromise}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-foreground">主角欲望</dt>
          <dd>{protocol.coreDesire}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-foreground">追读机制</dt>
          <dd>{protocol.hookEngine}</dd>
        </div>
      </dl>
    </DetailSection>
  );
}

function ViralAuditSection({
  score,
  issues,
}: {
  score?: number | null;
  issues?: ChapterFlatnessIssueView[];
}) {
  if (score == null && (!issues || issues.length === 0)) return null;

  return (
    <DetailSection title="爆款审计">
      <div className="grid gap-3">
        {score != null ? (
          <p className="text-2xl font-semibold text-foreground">{score}</p>
        ) : null}
        {issues?.length ? (
          <ul className="grid gap-2">
            {issues.map((issue, index) => (
              <li key={`${issue.type}-${index}`}>
                <span className="font-semibold text-foreground">
                  {viralIssueLabels[issue.type] ?? issue.type}
                </span>
                <span>{`：${issue.fixInstruction}`}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DetailSection>
  );
}
```

Render `ViralProtocolSection` near existing narrative context sections:

```tsx
<ViralProtocolSection
  protocol={detail.narrative?.storyBible?.viralStoryProtocol ?? null}
/>
```

Render `ViralAuditSection` for the selected chapter:

```tsx
<ViralAuditSection
  score={selectedChapter.auditViralScore}
  issues={selectedChapter.auditViralIssues}
/>
```

- [ ] **Step 7: Run renderer tests**

Run:

```bash
pnpm exec vitest run tests/renderer/new-book.test.tsx tests/renderer/book-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add renderer/pages/NewBook.tsx renderer/pages/BookDetail.tsx renderer/App.tsx tests/renderer/new-book.test.tsx tests/renderer/book-detail.test.tsx
git commit -m "feat: show viral story protocol UI"
```

---

### Task 7: Full Verification

**Files:**
- No planned source changes.

- [ ] **Step 1: Run core and renderer tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only viral story protocol implementation files should be modified relative to the branch base. Existing unrelated user changes may still appear in the worktree; do not revert them.

- [ ] **Step 5: Final commit if verification required formatting fixes**

If verification required changes, commit them:

```bash
git add src/core/narrative src/core/story-router src/core/ai-outline.ts src/core/ai-post-chapter.ts src/core/book-service.ts src/shared/contracts.ts src/mock/story-services.ts renderer/pages tests
git commit -m "test: verify viral story protocol"
```

Expected: create a verification commit only when Step 1, Step 2, or Step 3 required code or test edits.

---

## Self-Review Notes

- Spec coverage:
  - `ViralStoryProtocol`, target emotion, payoff cadence, trope contract, anti-cliche rules: Task 1.
  - Prompt injection for bible, volume, cards, budgets, draft, audit, revision: Task 2 and Task 3.
  - Viral scoring and audit actions: Task 3.
  - Story Router skills: Task 4.
  - Embedded storage through story bible and old-book compatibility: Task 1 and Task 5.
  - New-book optional strategy UI and book detail summary: Task 6.
  - Mock fallback and IPC contract compatibility: Task 5.

- Type consistency:
  - UI payload uses `cadenceMode`; core protocol uses `payoffCadence.mode`. Task 1 and Task 2 convert `cadenceMode` into `ViralStrategyInput` before deriving `ViralStoryProtocol`.
  - `viralStoryProtocol` remains optional everywhere for old books.
  - Viral issue types reuse the existing `AuditIssueType` array, so chapter revision receives them without a separate issue model.

- Scope note:
  - This plan does not create `viral_story_protocols` storage because the spec recommends embedding V1 in the story bible.
  - This plan does not add platform trend research or ranking data because the spec explicitly excludes external market analysis.
