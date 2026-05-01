# Story Skill Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-version Story Skill Router so chapter generation and chapter audits share an explicit task route, selected writing modules, hard constraints, red flags, and checklist.

**Architecture:** Add a focused `src/core/story-router` module with a static skill registry, deterministic task routing, and prompt formatting. Inject the formatted route plan into existing narrative draft and audit prompts, then expose a read-only route summary on chapter detail without adding persistence.

**Tech Stack:** TypeScript, Vitest, React, existing Electron/shared contracts, existing narrative prompt and book-service flow.

---

## File Structure

- Create `src/core/story-router/types.ts`: task, skill, route plan, and context types.
- Create `src/core/story-router/registry.ts`: V1 story skill registry with 13 skills from the design.
- Create `src/core/story-router/router.ts`: deterministic `routeStoryTask()` and unknown-task validation.
- Create `src/core/story-router/prompt-rules.ts`: render route plans into stable prompt text.
- Create `src/core/story-router/index.ts`: public exports for core consumers.
- Create `tests/core/story-router.test.ts`: route selection and route-plan formatting tests.
- Modify `src/core/narrative/prompts.ts`: accept optional `routePlanText` in draft and audit prompts.
- Modify `tests/core/narrative-prompts.test.ts`: verify route-plan text is preserved in draft and audit prompts.
- Modify `src/core/ai-post-chapter.ts`: pass optional route-plan text into `buildChapterAuditPrompt`.
- Modify `src/core/book-service.ts`: build the route plan for chapter writing, inject it into writing and auditing, and derive a read-only route plan for book detail chapters.
- Modify `tests/core/book-service.test.ts`: verify write and audit calls receive route-plan context.
- Modify `src/shared/contracts.ts`: add a serializable `StoryRoutePlanView` shape to chapter detail records.
- Modify `renderer/pages/BookDetail.tsx`: show selected chapter route summary in the context outline tab.
- Modify `tests/renderer/book-detail.test.tsx`: cover the read-only route summary.

## Task 1: Story Router Core

**Files:**
- Create: `src/core/story-router/types.ts`
- Create: `src/core/story-router/registry.ts`
- Create: `src/core/story-router/router.ts`
- Create: `src/core/story-router/prompt-rules.ts`
- Create: `src/core/story-router/index.ts`
- Test: `tests/core/story-router.test.ts`

- [x] **Step 1: Write failing router tests**

Create `tests/core/story-router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from '../../src/core/story-router';

describe('story skill router', () => {
  it('routes chapter writing through structure, chapter goal, character, hook, and audit skills', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    expect(plan.taskType).toBe('write_chapter');
    expect(plan.requiredSkills.map((skill) => skill.id)).toEqual([
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'dialogue-control',
      'genre-pattern',
      'prose-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ]);
    expect(plan.optionalSkills.map((skill) => skill.id)).toEqual([
      'de-ai-style',
    ]);
    expect(plan.hardConstraints).toContain(
      '低优先级规则不能推翻用户要求、作品设定、章节卡和张力预算。'
    );
    expect(plan.checklist).toContain('必须完成章节卡 mustChange。');
  });

  it('routes de-ai work without outline or opening modules', () => {
    const plan = routeStoryTask({
      taskType: 'de_ai',
      context: {
        hasNarrativeBible: false,
        hasChapterCard: false,
        hasTensionBudget: false,
      },
    });

    const skillIds = plan.requiredSkills.map((skill) => skill.id);

    expect(skillIds).toEqual([
      'dialogue-control',
      'prose-style',
      'de-ai-style',
      'red-flag-audit',
    ]);
    expect(skillIds).not.toContain('story-structure');
    expect(skillIds).not.toContain('opening-hook');
  });

  it('records warnings for missing route context while keeping generation possible', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: false,
        hasChapterCard: false,
        hasTensionBudget: false,
      },
    });

    expect(plan.warnings).toEqual([
      'Narrative Bible missing: use book idea and available continuity as fallback.',
      'Chapter Card missing: use generic chapter-goal rules.',
      'Tension Budget missing: skip budget-specific pressure rules.',
    ]);
  });

  it('throws for unsupported task types', () => {
    expect(() =>
      routeStoryTask({
        taskType: 'unknown' as never,
        context: {
          hasNarrativeBible: true,
          hasChapterCard: true,
          hasTensionBudget: true,
        },
      })
    ).toThrow('Unsupported story task type: unknown');
  });

  it('formats route plans for prompt injection', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    const text = formatStoryRoutePlanForPrompt(plan);

    expect(text).toContain('Story Skill Route Plan');
    expect(text).toContain('Priority Rules');
    expect(text).toContain('Required Skills');
    expect(text).toContain('story-structure');
    expect(text).toContain('Hard Constraints');
    expect(text).toContain('Red Flags');
    expect(text).toContain('Checklist');
  });
});
```

- [x] **Step 2: Run the failing router tests**

Run:

```bash
pnpm vitest run tests/core/story-router.test.ts
```

Expected: FAIL because `../../src/core/story-router` does not exist.

- [x] **Step 3: Add router types**

Create `src/core/story-router/types.ts`:

```ts
export type StoryTaskType =
  | 'write_chapter'
  | 'revise_chapter'
  | 'design_opening'
  | 'design_character'
  | 'audit_story'
  | 'de_ai';

export type StorySkillType = 'process' | 'execution' | 'audit';
export type StorySkillRigidity = 'hard' | 'soft';

export type StorySkill = {
  id: string;
  name: string;
  type: StorySkillType;
  priority: number;
  rigidity: StorySkillRigidity;
  triggers: StoryTaskType[];
  requiredContext: string[];
  promptRules: string[];
  auditQuestions: string[];
  redFlags: string[];
};

export type StoryRouteContext = {
  hasNarrativeBible: boolean;
  hasChapterCard: boolean;
  hasTensionBudget: boolean;
};

export type StoryRoutePlan = {
  taskType: StoryTaskType;
  requiredSkills: StorySkill[];
  optionalSkills: StorySkill[];
  hardConstraints: string[];
  promptRules: string[];
  auditQuestions: string[];
  redFlags: string[];
  checklist: string[];
  warnings: string[];
};

export type RouteStoryTaskInput = {
  taskType: StoryTaskType;
  context: StoryRouteContext;
};
```

- [x] **Step 4: Add the V1 skill registry**

Create `src/core/story-router/registry.ts`:

```ts
import type { StorySkill } from './types.js';

export const storySkillRegistry: StorySkill[] = [
  {
    id: 'story-structure',
    name: '大纲排布',
    type: 'process',
    priority: 100,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter', 'audit_story'],
    requiredContext: ['volumePlans', 'narrativeThreads'],
    promptRules: [
      '本章必须服务当前卷计划。',
      '本章必须产生可描述的剧情位移。',
      '主线不能连续停滞。',
    ],
    auditQuestions: ['本章是否服务当前卷计划？', '主线是否发生可描述位移？'],
    redFlags: ['主线多章没有推进。'],
  },
  {
    id: 'chapter-goal',
    name: '当前章目标',
    type: 'process',
    priority: 95,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter'],
    requiredContext: ['chapterCard'],
    promptRules: [
      '必须完成章节卡 mustChange。',
      '必须体现章节卡 plotFunction。',
      '结尾必须承接或强化章节卡 endingHook。',
    ],
    auditQuestions: ['是否完成 mustChange？', '是否强化 endingHook？'],
    redFlags: ['章节结尾只是总结，没有下一步压力。'],
  },
  {
    id: 'character-logic',
    name: '人物动机',
    type: 'process',
    priority: 90,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter', 'design_character', 'audit_story'],
    requiredContext: ['characterArcs', 'relationshipEdges'],
    promptRules: [
      '人物行动必须能从欲望、恐惧、缺陷、误信或当前压力中解释。',
      '不允许为了推动剧情让人物突然降智或突然变聪明。',
      '不能越过 lineWillNotCross，除非本章明确写出代价和转折原因。',
    ],
    auditQuestions: ['人物行动是否符合既有动机？', '是否出现 OOC 或剧情服务式降智？'],
    redFlags: ['人物为了剧情服务而失真。', '反派或配角不合理降智。'],
  },
  {
    id: 'emotion-curve',
    name: '情绪曲线',
    type: 'process',
    priority: 80,
    rigidity: 'soft',
    triggers: ['write_chapter', 'revise_chapter', 'design_opening'],
    requiredContext: ['targetReaderExperience'],
    promptRules: [
      '本章需要有可感知的情绪方向。',
      '情绪变化应由事件、选择或关系动作触发。',
      '不能用解释性独白代替情绪推进。',
    ],
    auditQuestions: ['情绪变化是否由场景动作触发？'],
    redFlags: ['只标注情绪，没有可见行动或代价。'],
  },
  {
    id: 'opening-hook',
    name: '开头设计',
    type: 'execution',
    priority: 75,
    rigidity: 'soft',
    triggers: ['write_chapter', 'design_opening'],
    requiredContext: ['previousChapterEnding'],
    promptRules: [
      '开头尽快给出异常、冲突、欲望、危险或未解问题。',
      '不用大段背景解释开局。',
      '前几段必须建立读者继续阅读的理由。',
    ],
    auditQuestions: ['开头是否快速建立阅读理由？'],
    redFlags: ['开头用大段背景解释卸掉张力。'],
  },
  {
    id: 'hook-technique',
    name: '钩子技法',
    type: 'execution',
    priority: 70,
    rigidity: 'soft',
    triggers: ['write_chapter', 'revise_chapter', 'design_opening'],
    requiredContext: ['chapterCard', 'tensionBudget'],
    promptRules: [
      '章节结尾必须制造下一章必须承接的问题。',
      '信息揭示后要留下新的不确定性。',
      '冲突可以阶段性解决，但不能完全卸力。',
    ],
    auditQuestions: ['结尾是否有明确追读压力？', '是否留下未完成问题？'],
    redFlags: ['冲突在章末完全解决。', '读者没有下一步问题。'],
  },
  {
    id: 'dialogue-control',
    name: '对话技法',
    type: 'execution',
    priority: 65,
    rigidity: 'soft',
    triggers: ['write_chapter', 'revise_chapter', 'de_ai'],
    requiredContext: ['relationshipEdges'],
    promptRules: [
      '对话必须带有目的、遮掩、试探、冲突或关系变化。',
      '不用对白整块解释设定。',
      '角色说话方式应符合身份、关系和当下压力。',
    ],
    auditQuestions: ['对白是否只在解释设定？'],
    redFlags: ['对话只在解释设定。'],
  },
  {
    id: 'genre-pattern',
    name: '题材框架',
    type: 'execution',
    priority: 60,
    rigidity: 'hard',
    triggers: ['write_chapter', 'design_opening', 'audit_story'],
    requiredContext: ['genreContract', 'targetReaderExperience'],
    promptRules: [
      '本章需要回应 genreContract。',
      '读者回报必须符合题材预期。',
      '不能为了技巧破坏目标读者体验。',
    ],
    auditQuestions: ['本章是否兑现题材承诺？'],
    redFlags: ['技巧压过目标读者体验。'],
  },
  {
    id: 'prose-style',
    name: '风格模块',
    type: 'execution',
    priority: 50,
    rigidity: 'soft',
    triggers: ['write_chapter', 'revise_chapter', 'de_ai'],
    requiredContext: ['voiceGuide'],
    promptRules: [
      '遵守 voiceGuide。',
      '镜头、心理、动作和叙述密度要匹配当前场景。',
      '文风优化不能改变事实、关系和人物动机。',
    ],
    auditQuestions: ['文风是否改变了事实或人物动机？'],
    redFlags: ['漂亮句子覆盖了真实行动。'],
  },
  {
    id: 'de-ai-style',
    name: '去 AI 味',
    type: 'execution',
    priority: 45,
    rigidity: 'soft',
    triggers: ['revise_chapter', 'de_ai'],
    requiredContext: ['voiceGuide'],
    promptRules: [
      '删除泛泛总结和抽象情绪标签。',
      '用具体动作、选择、物件、环境反馈呈现心理。',
      '避免连续使用同构句式和套路化转场。',
    ],
    auditQuestions: ['是否存在模板化总结和抽象情绪标签？'],
    redFlags: ['连续使用同构句式和套路化转场。'],
  },
  {
    id: 'consistency-audit',
    name: '一致性检查',
    type: 'audit',
    priority: 40,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter', 'audit_story'],
    requiredContext: ['narrativeBible', 'worldRules'],
    promptRules: [],
    auditQuestions: [
      '是否违反世界规则？',
      '是否改变已建立人物逻辑？',
      '是否新增未授权的重要设定？',
    ],
    redFlags: ['新增未授权的重要设定。'],
  },
  {
    id: 'pacing-audit',
    name: '节奏检查',
    type: 'audit',
    priority: 35,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter', 'audit_story'],
    requiredContext: ['chapterCard', 'tensionBudget'],
    promptRules: [],
    auditQuestions: [
      '是否有剧情位移？',
      '是否有选择压力？',
      '是否有代价或后果？',
      '是否重复相同张力模式？',
    ],
    redFlags: ['伏笔只埋不推。', '爽点缺少压抑、代价或关系变化支撑。'],
  },
  {
    id: 'red-flag-audit',
    name: '红旗检查',
    type: 'audit',
    priority: 30,
    rigidity: 'hard',
    triggers: ['write_chapter', 'revise_chapter', 'audit_story', 'de_ai'],
    requiredContext: ['chapterCard', 'narrativeBible'],
    promptRules: [],
    auditQuestions: [
      '人物是否为了剧情服务而失真？',
      '对话是否只在解释设定？',
      '章末是否没有追读压力？',
    ],
    redFlags: [
      '人物为了剧情服务而失真。',
      '反派或配角不合理降智。',
      '对话只在解释设定。',
      '章末没有追读压力。',
    ],
  },
];
```

- [x] **Step 5: Add deterministic routing**

Create `src/core/story-router/router.ts`:

```ts
import { storySkillRegistry } from './registry.js';
import type {
  RouteStoryTaskInput,
  StoryRoutePlan,
  StorySkill,
  StoryTaskType,
} from './types.js';

const taskRoutes: Record<StoryTaskType, { required: string[]; optional: string[] }> = {
  write_chapter: {
    required: [
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'dialogue-control',
      'genre-pattern',
      'prose-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ],
    optional: ['de-ai-style'],
  },
  revise_chapter: {
    required: [
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'hook-technique',
      'dialogue-control',
      'prose-style',
      'de-ai-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ],
    optional: [],
  },
  design_opening: {
    required: [
      'story-structure',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'genre-pattern',
    ],
    optional: [],
  },
  design_character: {
    required: ['character-logic'],
    optional: [],
  },
  audit_story: {
    required: [
      'story-structure',
      'character-logic',
      'genre-pattern',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ],
    optional: [],
  },
  de_ai: {
    required: [
      'dialogue-control',
      'prose-style',
      'de-ai-style',
      'red-flag-audit',
    ],
    optional: [],
  },
};

const priorityRules = [
  '用户本次明确要求优先。',
  '已有作品设定优先于章节技巧。',
  '当前章节卡优先于张力预算之外的风格建议。',
  '当前张力预算优先于通用文风润色。',
  '低优先级规则不能推翻用户要求、作品设定、章节卡和张力预算。',
];

const baseChecklist = [
  '必须完成章节卡 mustChange。',
  '必须体现可见选择、代价或后果。',
  '人物行动必须符合动机链。',
  '章末必须保留追读压力。',
  '不得违反世界规则和已发生剧情。',
];

function getRoute(taskType: StoryTaskType) {
  const route = taskRoutes[taskType];
  if (!route) {
    throw new Error(`Unsupported story task type: ${String(taskType)}`);
  }
  return route;
}

function resolveSkills(ids: string[]): StorySkill[] {
  return ids.map((id) => {
    const skill = storySkillRegistry.find((candidate) => candidate.id === id);
    if (!skill) {
      throw new Error(`Story skill not found: ${id}`);
    }
    return skill;
  });
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.filter((line) => line.trim().length > 0))];
}

export function routeStoryTask(input: RouteStoryTaskInput): StoryRoutePlan {
  const route = getRoute(input.taskType);
  const requiredSkills = resolveSkills(route.required);
  const optionalSkills = resolveSkills(route.optional);
  const selectedSkills = [...requiredSkills, ...optionalSkills];
  const warnings: string[] = [];

  if (!input.context.hasNarrativeBible) {
    warnings.push(
      'Narrative Bible missing: use book idea and available continuity as fallback.'
    );
  }
  if (!input.context.hasChapterCard) {
    warnings.push('Chapter Card missing: use generic chapter-goal rules.');
  }
  if (!input.context.hasTensionBudget) {
    warnings.push('Tension Budget missing: skip budget-specific pressure rules.');
  }

  return {
    taskType: input.taskType,
    requiredSkills,
    optionalSkills,
    hardConstraints: priorityRules,
    promptRules: uniqueLines(selectedSkills.flatMap((skill) => skill.promptRules)),
    auditQuestions: uniqueLines(
      selectedSkills.flatMap((skill) => skill.auditQuestions)
    ),
    redFlags: uniqueLines(selectedSkills.flatMap((skill) => skill.redFlags)),
    checklist: baseChecklist,
    warnings,
  };
}
```

- [x] **Step 6: Add prompt formatting and exports**

Create `src/core/story-router/prompt-rules.ts`:

```ts
import type { StoryRoutePlan, StorySkill } from './types.js';

function renderSkills(skills: StorySkill[]) {
  return skills.map(
    (skill) =>
      `- ${skill.id} (${skill.name}; ${skill.type}; ${skill.rigidity})`
  );
}

function renderSection(title: string, lines: string[]) {
  return [title, ...(lines.length ? lines.map((line) => `- ${line}`) : ['- None'])];
}

export function formatStoryRoutePlanForPrompt(plan: StoryRoutePlan) {
  return [
    'Story Skill Route Plan',
    `Task Type: ${plan.taskType}`,
    '',
    ...renderSection('Priority Rules', plan.hardConstraints),
    '',
    'Required Skills',
    ...renderSkills(plan.requiredSkills),
    '',
    'Optional Skills',
    ...renderSkills(plan.optionalSkills),
    '',
    ...renderSection('Prompt Rules', plan.promptRules),
    '',
    ...renderSection('Audit Questions', plan.auditQuestions),
    '',
    ...renderSection('Red Flags', plan.redFlags),
    '',
    ...renderSection('Checklist', plan.checklist),
    '',
    ...renderSection('Warnings', plan.warnings),
  ].join('\n');
}
```

Create `src/core/story-router/index.ts`:

```ts
export { storySkillRegistry } from './registry.js';
export { routeStoryTask } from './router.js';
export { formatStoryRoutePlanForPrompt } from './prompt-rules.js';
export type {
  RouteStoryTaskInput,
  StoryRouteContext,
  StoryRoutePlan,
  StorySkill,
  StorySkillRigidity,
  StorySkillType,
  StoryTaskType,
} from './types.js';
```

- [x] **Step 7: Run router tests**

Run:

```bash
pnpm vitest run tests/core/story-router.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit core router**

Run:

```bash
git add src/core/story-router tests/core/story-router.test.ts
git commit -m "feat: add story skill router"
```

## Task 2: Prompt And Auditor Integration

**Files:**
- Modify: `src/core/narrative/prompts.ts`
- Modify: `src/core/ai-post-chapter.ts`
- Test: `tests/core/narrative-prompts.test.ts`

- [x] **Step 1: Write failing prompt tests**

Append to `tests/core/narrative-prompts.test.ts` inside `describe('narrative prompts', () => { ... })`:

```ts
  it('injects story route plans into draft prompts', () => {
    const prompt = buildNarrativeDraftPrompt({
      idea: '命簿',
      wordsPerChapter: 2000,
      commandContext: 'Chapter Mission: 林牧必须主动追查。',
      routePlanText:
        'Story Skill Route Plan\nRequired Skills\n- story-structure',
    });

    expect(prompt).toContain('Story Skill Route Plan');
    expect(prompt).toContain('Required Skills');
    expect(prompt).toContain('story-structure');
    expect(prompt).toContain('Chapter Mission');
  });

  it('injects story route plans into audit prompts', () => {
    const prompt = buildChapterAuditPrompt({
      draft: '林牧直接改写命簿，没有代价。',
      auditContext: 'World Rule and Cost: 改写命簿会失去记忆。',
      routePlanText: 'Story Skill Route Plan\nRed Flags\n- 章末没有追读压力。',
    });

    expect(prompt).toContain('Story Skill Route Plan');
    expect(prompt).toContain('Red Flags');
    expect(prompt).toContain('章末没有追读压力。');
    expect(prompt).toContain('world_rule_violation');
  });
```

- [x] **Step 2: Run failing prompt tests**

Run:

```bash
pnpm vitest run tests/core/narrative-prompts.test.ts
```

Expected: FAIL because `routePlanText` is not accepted yet.

- [x] **Step 3: Add optional route-plan prompt fields**

Modify `src/core/narrative/prompts.ts`:

```ts
export function buildNarrativeDraftPrompt(input: {
  idea: string;
  wordsPerChapter: number;
  commandContext: string;
  routePlanText?: string | null;
}) {
  return [
    'Write the next chapter of a long-form Chinese web novel.',
    `Book idea: ${input.idea}`,
    `Write approximately ${input.wordsPerChapter} Chinese characters.`,
    input.routePlanText ? `\n${input.routePlanText}` : '',
    input.commandContext,
    'Hard requirements: complete mustChange, fulfill the Tension Budget when provided, make forcedChoice visible through action, make costToPay visible before the chapter ends, preserve forbiddenMoves, show world-rule cost when a rule is used, and make relationship changes visible through action.',
    'Return only the final chapter prose. Do not summarize or explain.',
  ].join('\n');
}

export function buildChapterAuditPrompt(input: {
  draft: string;
  auditContext: string;
  routePlanText?: string | null;
}) {
  return [
    'Audit this chapter draft for long-form narrative drift.',
    'Return valid JSON only with passed, score, decision, issues, scoring, stateUpdates.',
    'Issue type enum: character_logic, relationship_static, world_rule_violation, mainline_stall, thread_leak, pacing_problem, theme_drift, chapter_too_empty, forbidden_move, missing_reader_reward, flat_chapter, weak_choice_pressure, missing_consequence, soft_hook, repeated_tension_pattern.',
    'Also audit flatness with scoring.flatness: conflictEscalation, choicePressure, consequenceVisibility, irreversibleChange, hookStrength.',
    'Flatness questions: Did the chapter escalate, turn, or meaningfully redirect conflict? Did the POV character face a visible choice? Was a cost paid or consequence made visible? Did the ending create forward pressure? Did the chapter repeat the same tension pattern without new effect?',
    'Decision rules: accept for strong chapters, revise for fixable major issues, rewrite for blockers.',
    input.routePlanText ? `Story route requirements:\n${input.routePlanText}` : '',
    `Audit context:\n${input.auditContext}`,
    `Draft:\n${input.draft}`,
  ].join('\n');
}
```

- [x] **Step 4: Extend AI chapter auditor input**

Modify `src/core/ai-post-chapter.ts` in `createAiChapterAuditor` so `auditChapter` accepts and forwards `routePlanText`:

```ts
    async auditChapter(input: {
      modelId: string;
      draft: string;
      auditContext: string;
      routePlanText?: string | null;
    }) {
      const response = await deps.generateText({
        modelId: input.modelId,
        prompt: buildChapterAuditPrompt(input),
      });
```

- [x] **Step 5: Run prompt tests**

Run:

```bash
pnpm vitest run tests/core/narrative-prompts.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit prompt integration**

Run:

```bash
git add src/core/narrative/prompts.ts src/core/ai-post-chapter.ts tests/core/narrative-prompts.test.ts
git commit -m "feat: inject story routes into narrative prompts"
```

## Task 3: Book Service Route Injection

**Files:**
- Modify: `src/core/book-service.ts`
- Test: `tests/core/book-service.test.ts`

- [x] **Step 1: Write failing book-service tests**

Append to `tests/core/book-service.test.ts`:

```ts
it('injects story route plans into chapter writing and auditing', async () => {
  const db = createDatabase(':memory:');
  const writeChapter = vi.fn().mockResolvedValue({
    content: '第一章正文',
    usage: { inputTokens: 10, outputTokens: 20 },
  });
  const auditChapter = vi.fn().mockResolvedValue({
    passed: true,
    score: 90,
    decision: 'accept',
    issues: [],
    scoring: {
      characterLogic: 18,
      mainlineProgress: 14,
      relationshipChange: 12,
      conflictDepth: 14,
      worldRuleCost: 8,
      threadManagement: 8,
      pacingReward: 10,
      themeAlignment: 6,
      flatness: {
        conflictEscalation: 80,
        choicePressure: 80,
        consequenceVisibility: 80,
        irreversibleChange: 80,
        hookStrength: 80,
      },
    },
    stateUpdates: {
      characterArcUpdates: [],
      relationshipUpdates: [],
      threadUpdates: [],
      worldRuleUpdates: [],
    },
  });
  const service = createBookService({
    books: createBookRepository(db),
    chapters: createChapterRepository(db),
    characters: createCharacterRepository(db),
    plotThreads: createPlotThreadRepository(db),
    sceneRecords: createSceneRecordRepository(db),
    progress: createProgressRepository(db),
    outlineService: {
      generateFromIdea: vi.fn().mockResolvedValue({
        worldSetting: 'World rules',
        masterOutline: 'Master outline',
        volumeOutlines: ['Volume 1'],
        chapterOutlines: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            outline: 'Opening conflict',
          },
        ],
        narrativeBible: {
          premise: '修复命簿的人发现家族被删除。',
          genreContract: '悬疑升级。',
          targetReaderExperience: '追问真相。',
          themeQuestion: '自由是否需要代价？',
          themeAnswerDirection: '自由需要承担代价。',
          centralDramaticQuestion: '林牧能否夺回命运？',
          endingState: {
            protagonistWins: '夺回选择权。',
            protagonistLoses: '失去旧身份。',
            worldChange: '命簿规则公开。',
            relationshipOutcome: '同伴仍愿同行。',
            themeAnswer: '自由来自承担。',
          },
          voiceGuide: '冷静、具象、克制。',
          characterArcs: [],
          relationshipEdges: [],
          worldRules: [],
          narrativeThreads: [],
        },
        chapterCards: [
          {
            bookId: '',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            plotFunction: '开局异常。',
            povCharacterId: null,
            externalConflict: '旧页出现。',
            internalConflict: '是否相信旧页。',
            relationshipChange: '向同伴隐瞒。',
            worldRuleUsedOrTested: '改写有代价。',
            informationReveal: '家族记录消失。',
            readerReward: 'truth',
            endingHook: '旧页写出新名字。',
            mustChange: '林牧决定追查。',
            forbiddenMoves: ['不能无代价改写命簿。'],
          },
        ],
        chapterTensionBudgets: [
          {
            bookId: '',
            volumeIndex: 1,
            chapterIndex: 1,
            pressureLevel: 'high',
            dominantTension: 'mystery',
            requiredTurn: '旧页回应林牧。',
            forcedChoice: '保密或求助。',
            costToPay: '失去一段记忆。',
            irreversibleChange: '林牧开始追查。',
            readerQuestion: '旧页为何回应？',
            hookPressure: '章末出现新名字。',
            flatnessRisks: ['不要只解释。'],
          },
        ],
      }),
    },
    chapterWriter: { writeChapter },
    chapterAuditor: { auditChapter },
    summaryGenerator: {
      summarizeChapter: vi.fn().mockResolvedValue('摘要'),
    },
    plotThreadExtractor: {
      extractThreads: vi.fn().mockResolvedValue({
        openedThreads: [],
        resolvedThreadIds: [],
      }),
    },
    characterStateExtractor: {
      extractStates: vi.fn().mockResolvedValue([]),
    },
    sceneRecordExtractor: {
      extractScene: vi.fn().mockResolvedValue(null),
    },
    resolveModelId: vi.fn().mockReturnValue('openai:gpt-4o-mini'),
  });

  const bookId = service.createBook({
    idea: '命簿',
    targetChapters: 1,
    wordsPerChapter: 1200,
  });

  await service.startBook(bookId);
  await service.generateNextChapter(bookId);

  expect(writeChapter.mock.calls[0]?.[0].prompt).toContain(
    'Story Skill Route Plan'
  );
  expect(writeChapter.mock.calls[0]?.[0].prompt).toContain('chapter-goal');
  expect(auditChapter).toHaveBeenCalledWith(
    expect.objectContaining({
      routePlanText: expect.stringContaining('Story Skill Route Plan'),
    })
  );
});
```

- [x] **Step 2: Run failing book-service test**

Run:

```bash
pnpm vitest run tests/core/book-service.test.ts -- -t "injects story route plans"
```

Expected: FAIL because book-service does not create route plans.

- [x] **Step 3: Import router helpers**

Modify imports in `src/core/book-service.ts`:

```ts
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from './story-router/index.js';
```

- [x] **Step 4: Build the route plan before the narrative draft prompt**

In `generateNextChapter`, immediately after `commandContext` is built, add:

```ts
      const storyRoutePlan = routeStoryTask({
        taskType: 'write_chapter',
        context: {
          hasNarrativeBible: Boolean(deps.storyBibles?.getByBook?.(bookId)),
          hasChapterCard: Boolean(chapterCard),
          hasTensionBudget: Boolean(tensionBudget),
        },
      });
      const routePlanText = formatStoryRoutePlanForPrompt(storyRoutePlan);
```

Then update the narrative draft prompt call:

```ts
          ? buildNarrativeDraftPrompt({
              idea: book.idea,
              wordsPerChapter: book.wordsPerChapter,
              commandContext: commandContext ?? legacyContinuityContext,
              routePlanText,
            })
```

- [x] **Step 5: Pass route text to chapter audits**

Update both `deps.chapterAuditor.auditChapter` calls in `generateNextChapter`:

```ts
        let audit = await deps.chapterAuditor.auditChapter({
          modelId,
          draft: result.content,
          auditContext,
          routePlanText,
        });
```

and:

```ts
          audit = await deps.chapterAuditor.auditChapter({
            modelId,
            draft: result.content,
            auditContext,
            routePlanText,
          });
```

Update the dependency type near `chapterAuditor`:

```ts
  chapterAuditor?: {
    auditChapter: (input: {
      modelId: string;
      draft: string;
      auditContext: string;
      routePlanText?: string | null;
    }) => Promise<NarrativeAudit>;
  };
```

- [x] **Step 6: Run the targeted test**

Run:

```bash
pnpm vitest run tests/core/book-service.test.ts -- -t "injects story route plans"
```

Expected: PASS.

- [x] **Step 7: Commit book-service route injection**

Run:

```bash
git add src/core/book-service.ts tests/core/book-service.test.ts
git commit -m "feat: route chapter generation through story skills"
```

## Task 4: Read-Only Route Summary In Book Detail

**Files:**
- Modify: `src/shared/contracts.ts`
- Modify: `src/core/book-service.ts`
- Modify: `renderer/pages/BookDetail.tsx`
- Test: `tests/renderer/book-detail.test.tsx`
- Test: `tests/core/book-service.test.ts`

- [x] **Step 1: Add failing contract/detail expectations**

Append to `tests/core/book-service.test.ts`:

```ts
it('returns story route plans on chapter detail records', async () => {
  const db = createDatabase(':memory:');
  const service = createBookService({
    books: createBookRepository(db),
    chapters: createChapterRepository(db),
    characters: createCharacterRepository(db),
    plotThreads: createPlotThreadRepository(db),
    sceneRecords: createSceneRecordRepository(db),
    progress: createProgressRepository(db),
    outlineService: {
      generateFromIdea: vi.fn().mockResolvedValue({
        worldSetting: 'World rules',
        masterOutline: 'Master outline',
        volumeOutlines: ['Volume 1'],
        chapterOutlines: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            outline: 'Opening conflict',
          },
        ],
      }),
    },
    chapterWriter: { writeChapter: vi.fn() },
    summaryGenerator: { summarizeChapter: vi.fn() },
    plotThreadExtractor: {
      extractThreads: vi.fn().mockResolvedValue({
        openedThreads: [],
        resolvedThreadIds: [],
      }),
    },
    characterStateExtractor: { extractStates: vi.fn().mockResolvedValue([]) },
    sceneRecordExtractor: { extractScene: vi.fn().mockResolvedValue(null) },
  });

  const bookId = service.createBook({
    idea: '命簿',
    targetChapters: 1,
    wordsPerChapter: 1200,
  });

  await service.startBook(bookId);
  const detail = service.getBookDetail(bookId);

  expect(detail?.chapters[0]?.storyRoutePlan).toMatchObject({
    taskType: 'write_chapter',
  });
  expect(
    detail?.chapters[0]?.storyRoutePlan?.requiredSkills.map((skill) => skill.id)
  ).toContain('chapter-goal');
});
```

Append to `tests/renderer/book-detail.test.tsx`:

```tsx
  it('shows the selected chapter story route summary in the context panel', () => {
    render(
      <BookDetail
        book={{ title: 'Book 1', status: 'writing', wordCount: 1200 }}
        progress={{ phase: 'writing' }}
        chapters={[
          {
            id: '1-1',
            volumeIndex: 1,
            chapterIndex: 1,
            title: 'Chapter 1',
            wordCount: 1200,
            status: 'done',
            content: 'Generated chapter content',
            storyRoutePlan: {
              taskType: 'write_chapter',
              requiredSkills: [
                {
                  id: 'chapter-goal',
                  name: '当前章目标',
                  type: 'process',
                  rigidity: 'hard',
                },
                {
                  id: 'hook-technique',
                  name: '钩子技法',
                  type: 'execution',
                  rigidity: 'soft',
                },
              ],
              optionalSkills: [],
              hardConstraints: ['用户本次明确要求优先。'],
              checklist: ['必须完成章节卡 mustChange。'],
              redFlags: ['章末没有追读压力。'],
              warnings: [],
            },
          },
        ]}
      />
    );

    const contextPanel = screen.getByLabelText('上下文面板');

    expect(within(contextPanel).getByText('写作路由')).toBeInTheDocument();
    expect(within(contextPanel).getByText('write_chapter')).toBeInTheDocument();
    expect(within(contextPanel).getByText('当前章目标')).toBeInTheDocument();
    expect(within(contextPanel).getByText('钩子技法')).toBeInTheDocument();
    expect(
      within(contextPanel).getByText('必须完成章节卡 mustChange。')
    ).toBeInTheDocument();
  });
```

- [x] **Step 2: Run failing detail tests**

Run:

```bash
pnpm vitest run tests/core/book-service.test.ts -- -t "returns story route plans"
pnpm vitest run tests/renderer/book-detail.test.tsx -- -t "story route summary"
```

Expected: FAIL because contracts and UI do not include `storyRoutePlan`.

- [x] **Step 3: Add shared contract shape**

Modify `src/shared/contracts.ts` before `BookDetail`:

```ts
export type StoryRoutePlanView = {
  taskType: string;
  requiredSkills: Array<{
    id: string;
    name: string;
    type: string;
    rigidity: string;
  }>;
  optionalSkills: Array<{
    id: string;
    name: string;
    type: string;
    rigidity: string;
  }>;
  hardConstraints: string[];
  checklist: string[];
  redFlags: string[];
  warnings: string[];
};
```

Add to each chapter record in `BookDetail.chapters`:

```ts
    storyRoutePlan?: StoryRoutePlanView | null;
```

- [x] **Step 4: Add route-plan view mapping in book-service**

Add helper functions near the top of `src/core/book-service.ts`:

```ts
function toStoryRoutePlanView(plan: ReturnType<typeof routeStoryTask>) {
  const mapSkill = (skill: ReturnType<typeof routeStoryTask>['requiredSkills'][number]) => ({
    id: skill.id,
    name: skill.name,
    type: skill.type,
    rigidity: skill.rigidity,
  });

  return {
    taskType: plan.taskType,
    requiredSkills: plan.requiredSkills.map(mapSkill),
    optionalSkills: plan.optionalSkills.map(mapSkill),
    hardConstraints: plan.hardConstraints,
    checklist: plan.checklist,
    redFlags: plan.redFlags,
    warnings: plan.warnings,
  };
}
```

In `getBookDetail`, inside the chapter map after `card` is found, derive the route plan:

```ts
        const budget = chapterTensionBudgets.find(
          (candidate) =>
            candidate.volumeIndex === chapter.volumeIndex &&
            candidate.chapterIndex === chapter.chapterIndex
        );
        const storyRoutePlan = toStoryRoutePlanView(
          routeStoryTask({
            taskType: 'write_chapter',
            context: {
              hasNarrativeBible: Boolean(bible),
              hasChapterCard: Boolean(card),
              hasTensionBudget: Boolean(budget),
            },
          })
        );
```

Include `storyRoutePlan` in both chapter return branches:

```ts
          return {
            ...chapter,
            auditFlatnessScore,
            auditFlatnessIssues,
            storyRoutePlan,
          };
```

and:

```ts
          storyRoutePlan,
          outline: [
            `必须变化：${card.mustChange}`,
            `读者满足：${card.readerReward}`,
            `章末钩子：${card.endingHook}`,
          ].join('\n'),
```

- [x] **Step 5: Add renderer route summary types and component**

Modify `renderer/pages/BookDetail.tsx`.

Add local type:

```ts
type StoryRoutePlanView = {
  taskType: string;
  requiredSkills: Array<{
    id: string;
    name: string;
    type: string;
    rigidity: string;
  }>;
  optionalSkills: Array<{
    id: string;
    name: string;
    type: string;
    rigidity: string;
  }>;
  hardConstraints: string[];
  checklist: string[];
  redFlags: string[];
  warnings: string[];
};
```

Add a section component near `TensionBudgetSection`:

```tsx
function StoryRouteSection({ plan }: { plan: StoryRoutePlanView }) {
  const visibleSkills = [...plan.requiredSkills, ...plan.optionalSkills].slice(0, 6);

  return (
    <DetailSection title="写作路由">
      <div className="grid gap-3">
        <p className="text-xs font-semibold text-foreground">{plan.taskType}</p>
        <div className="flex flex-wrap gap-2">
          {visibleSkills.map((skill) => (
            <Badge key={skill.id} variant="secondary">
              {skill.name}
            </Badge>
          ))}
        </div>
        {plan.checklist.length ? (
          <ul className="m-0 grid gap-1 pl-5">
            {plan.checklist.slice(0, 3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {plan.warnings.length ? (
          <p className="text-xs text-muted-foreground">
            {`提示：${plan.warnings[0]}`}
          </p>
        ) : null}
      </div>
    </DetailSection>
  );
}
```

Add `storyRoutePlan?: StoryRoutePlanView | null;` to the chapter prop shape in `BookDetail`.

Add:

```ts
  const selectedStoryRoutePlan = selectedChapter?.storyRoutePlan ?? null;
```

Render it in the outline tab before `TensionBudgetSection`:

```tsx
                      {selectedStoryRoutePlan ? (
                        <StoryRouteSection plan={selectedStoryRoutePlan} />
                      ) : null}
```

- [x] **Step 6: Run detail tests**

Run:

```bash
pnpm vitest run tests/core/book-service.test.ts -- -t "returns story route plans"
pnpm vitest run tests/renderer/book-detail.test.tsx -- -t "story route summary"
```

Expected: PASS.

- [x] **Step 7: Commit read-only route summary**

Run:

```bash
git add src/shared/contracts.ts src/core/book-service.ts renderer/pages/BookDetail.tsx tests/core/book-service.test.ts tests/renderer/book-detail.test.tsx
git commit -m "feat: show story route summaries"
```

## Task 5: Full Verification And Cleanup

**Files:**
- Review: `src/core/story-router/*`
- Review: `src/core/narrative/prompts.ts`
- Review: `src/core/book-service.ts`
- Review: `renderer/pages/BookDetail.tsx`

- [x] **Step 1: Run focused tests**

Run:

```bash
pnpm vitest run tests/core/story-router.test.ts tests/core/narrative-prompts.test.ts tests/core/book-service.test.ts tests/renderer/book-detail.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS with no TypeScript errors.

- [x] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS. If `better-sqlite3` rebuild output appears, wait for Vitest results and verify all tests pass.

- [x] **Step 4: Inspect final diff**

Run:

```bash
git diff --stat HEAD
git diff -- src/core/story-router src/core/narrative/prompts.ts src/core/book-service.ts renderer/pages/BookDetail.tsx
```

Expected: only Story Skill Router, prompt injection, book-service route usage, contracts, UI summary, and tests changed.

- [x] **Step 5: Commit verification fixes if needed**

If Steps 1-3 required fixes, commit them:

```bash
git add src tests renderer
git commit -m "fix: stabilize story skill router integration"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: core route registry, task routing, prompt injection, audit injection, route summary UI, and tests are each covered by a task.
- Scope check: this plan avoids database schema changes and custom skill configuration, matching V1.
- Type consistency: `StoryRoutePlan`, `routePlanText`, and `StoryRoutePlanView` names are used consistently across tasks.
- Placeholder scan: no unresolved placeholders or vague handling steps are present.
