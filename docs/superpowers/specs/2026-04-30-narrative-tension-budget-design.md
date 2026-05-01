# Story Weaver 叙事张力预算设计

## 背景

Story Weaver 当前已经具备叙事控制闭环：故事圣经、分卷计划、章节任务卡、写前叙事指挥台、写后审计、修订和阶段复盘。这套机制能控制长期连续性和叙事偏航，但对“长篇越写越平”的问题还缺少一个专门的调度层。

“平”通常不是因为没有事件，而是因为章节没有形成可感知的压力、选择、代价、变化和未完成期待。现有 `ChapterCard` 已经要求 `mustChange`、`readerReward`、`relationshipChange`、`endingHook`，但这些字段仍然偏章节任务描述。系统还需要在写前明确本章张力来源，在写后审计兑现程度，并在阶段复盘时调整后续章节的张力曲线。

本设计在现有 narrative control loop 上增加 `ChapterTensionBudget`，把“这一章凭什么不平”变成结构化约束。

## 目标

- 每章写作前明确本章主要张力来源、压力等级、强制选择、代价、不可逆变化和钩子压力。
- 让写章 prompt 同时携带章节任务和张力预算，避免模型只完成事件而没有戏剧推进。
- 写后审计增加防平专项评分，能识别弱冲突、弱选择、无代价、无变化、软钩子和重复张力模式。
- 连续低张力时自动提高后续章节压力等级，避免长篇中段松散。
- checkpoint 阶段生成张力曲线报告，为后续章节卡或张力预算重排提供依据。

## 非目标

- 不在本轮实现完整可视化节奏图。
- 不替代已有 `ChapterCard`；张力预算只补充“压力和变化”维度。
- 不把所有章节都写成高强度高潮章。低张力章节允许存在，但必须有暗流、代价或关系/认知变化。
- 不强制每章都有外部危险。张力可以来自欲望、关系、谜团、道德选择、期限、地位损失或资源代价。

## 设计原则

1. 事件推进不等于叙事推进。
   章节必须让人物、关系、局势、认知、主题或读者期待中的至少一项发生可感知变化。

2. 张力需要被调度，而不是只被鼓励。
   prompt 中的写作建议容易在长篇生成中衰减；结构化预算能让每章写作都有明确压力任务。

3. 代价优先于热闹。
   打斗、揭秘和追逐如果没有代价，很快会变平。预算必须要求本章支付或转移某种代价。

4. 节奏允许呼吸，但不能停滞。
   `pressureLevel: low` 的章节也必须完成认知变化、关系暗流、伏笔推进或主题压力。

5. 重复即平。
   连续使用同一张力类型会削弱读者感受。checkpoint 必须识别重复模式并要求后续切换张力来源。

## 当前项目支撑点

已有可复用结构：

- `src/core/narrative/types.ts`
  - `ChapterCard`
  - `NarrativeAudit`
  - `ReaderReward`
  - `AuditIssueType`
- `src/core/narrative/context.ts`
  - `buildNarrativeCommandContext`
- `src/core/narrative/prompts.ts`
  - chapter card prompt
  - draft prompt
  - audit prompt
  - revision prompt
- `src/core/narrative/audit.ts`
  - `decideAuditAction`
- `src/core/book-service.ts`
  - 写章、审计、修订、保存、checkpoint 串联点
- `src/storage/chapter-cards.ts`
  - 已按章节保存结构化任务卡
- `src/storage/chapter-audits.ts`
  - 已保存审计结果

本设计应沿用这些边界，不新增独立写作流水线。

## 核心概念

### ChapterTensionBudget

`ChapterTensionBudget` 是章节级张力任务书。它回答“这一章为什么会让读者继续读”，而不是重复章节梗概。

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
```

字段含义：

- `pressureLevel`：本章压力强度。控制章节不是一直高压，也不是长期低压。
- `dominantTension`：本章主要张力来源。用于避免连续章节张力类型重复。
- `requiredTurn`：本章必须出现的转折。
- `forcedChoice`：人物必须面对的选择压力。低张力章节也要有轻量选择。
- `costToPay`：选择或推进带来的代价。
- `irreversibleChange`：章末不能回到章前状态的变化。
- `readerQuestion`：本章留给读者的未完成问题。
- `hookPressure`：章末钩子的压力来源，不只是一个悬念句。
- `flatnessRisks`：本章最容易写平的方式，用来约束 draft prompt 和 revision prompt。

### Flatness Scoring

审计增加防平专项评分：

```ts
export type FlatnessScoring = {
  conflictEscalation: number;
  choicePressure: number;
  consequenceVisibility: number;
  irreversibleChange: number;
  hookStrength: number;
};
```

分数含义：

- `conflictEscalation`：冲突是否相比章前升级或转向。
- `choicePressure`：人物是否被迫选择，而不是被事件推着走。
- `consequenceVisibility`：代价是否在正文中被读者看见。
- `irreversibleChange`：章末变化是否真实不可逆。
- `hookStrength`：章末是否制造明确的下一章阅读压力。

### 新增审计问题类型

```ts
export type AuditIssueType =
  | ExistingAuditIssueType
  | 'flat_chapter'
  | 'weak_choice_pressure'
  | 'missing_consequence'
  | 'soft_hook'
  | 'repeated_tension_pattern';
```

规则：

- `flat_chapter`：有事件但没有压力、选择、代价或变化。
- `weak_choice_pressure`：人物没有被迫取舍，只是顺着事件行动。
- `missing_consequence`：章节完成了任务，但没有付出代价或改变局面。
- `soft_hook`：章末只是停顿，没有形成下一章压力。
- `repeated_tension_pattern`：连续章节使用同类张力，读者感受变钝。

## 总体流程

目标流水线：

```text
generate narrative bible
  -> generate volume plans
  -> generate chapter cards
  -> generate tension budgets
  -> validate chapter cards and tension budgets
  -> build narrative command context
  -> write chapter with chapter card + tension budget
  -> audit chapter fulfillment and flatness
  -> revise or rewrite if flat
  -> extract state deltas
  -> persist chapter, audit, and state
  -> checkpoint tension curve every N chapters
  -> rebalance future budgets when needed
```

## 生成张力预算

新增 prompt builder：

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
    'Each chapter must include pressureLevel, dominantTension, requiredTurn, forcedChoice, costToPay, irreversibleChange, readerQuestion, hookPressure, flatnessRisks.',
    'Do not assign the same dominantTension to more than three consecutive chapters.',
    'Low pressure chapters must still include visible internal, relational, informational, or thematic movement.',
    'Peak chapters should align with volume turns, major payoffs, betrayals, failures, or irreversible decisions.',
  ].join('\n');
}
```

预算生成应发生在 chapter cards 之后，因为它需要知道章节功能和分卷节奏。

## 验证规则

新增 `validateTensionBudgets`：

```ts
export function validateTensionBudgets(
  budgets: ChapterTensionBudget[],
  input: { targetChapters: number }
): ValidationResult;
```

验证项：

- 每章必须有对应预算。
- `requiredTurn`、`costToPay`、`irreversibleChange`、`hookPressure` 不能为空。
- `flatnessRisks` 至少一项。
- 不允许超过 3 章连续相同 `dominantTension`。
- `peak` 不应过密，默认连续章节不可都为 `peak`，除非处于卷末。
- 每 3 章内至少有一章 `pressureLevel` 为 `medium` 或更高。

## 写前上下文

扩展 `buildNarrativeCommandContext` 输入：

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

输出中增加：

```text
Tension Budget:
pressureLevel: high
dominantTension: moral_choice
requiredTurn: 主角发现胜利会伤害自己想保护的人
forcedChoice: 保住证据，或救下同伴
costToPay: 无论选择哪边，都会失去一方信任
irreversibleChange: 主角无法再维持旁观者身份
readerQuestion: 真正操纵这场选择的人是谁
hookPressure: 章末暴露一个更坏选择
Flatness Risks:
- 不要用解释代替冲突
- 不要让线索无代价出现
- 不要让关系回到章前状态
```

draft prompt 的硬性要求改为：

```text
Hard requirements:
- complete mustChange
- fulfill the Tension Budget
- make the forcedChoice visible through action
- make costToPay visible before the chapter ends
- preserve forbiddenMoves
- show world-rule cost when a rule is used
- make relationship changes visible through action
```

## 写后审计

扩展 `NarrativeAudit`：

```ts
export type NarrativeAudit = {
  passed: boolean;
  score: number;
  decision: AuditDecision;
  issues: AuditIssue[];
  scoring: {
    characterLogic: number;
    mainlineProgress: number;
    relationshipChange: number;
    conflictDepth: number;
    worldRuleCost: number;
    threadManagement: number;
    pacingReward: number;
    themeAlignment: number;
    flatness: FlatnessScoring;
  };
  stateUpdates: NarrativeAuditStateUpdates;
};
```

如果要保持向后兼容，`flatness` 可以先设为可选：

```ts
flatness?: FlatnessScoring;
```

推荐第一版使用可选字段，避免旧 mock 和旧测试一次性大改。

审计 prompt 增加：

```text
Also audit flatness:
- Did the chapter escalate, turn, or meaningfully redirect conflict?
- Did the POV character face a visible choice?
- Was a cost paid or consequence made visible?
- Did the ending create forward pressure?
- Did this chapter repeat the same tension pattern without new effect?
```

## 审计决策规则

扩展 `decideAuditAction`：

```ts
export function decideAuditAction(audit: NarrativeAudit): AuditDecision {
  if (audit.issues.some((issue) => issue.severity === 'blocker')) {
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

第一版只处理单章 flatness。连续低张力的调度放在 checkpoint。

## 修订策略

revision prompt 不应只说“改好”，而要把 flatness issue 转为具体修订动作：

- `weak_choice_pressure`：增加清晰取舍，让角色主动选择并承担后果。
- `missing_consequence`：让代价在本章内可见，而不是留到以后解释。
- `soft_hook`：把章末改成新的压力入口，不只是情绪停顿。
- `flat_chapter`：重写关键场景，使 `requiredTurn` 和 `irreversibleChange` 发生在正文中。
- `repeated_tension_pattern`：换一种张力来源推进同一任务。

## Checkpoint 张力曲线

每 10 章 checkpoint 增加张力复盘：

```ts
export type TensionCheckpoint = {
  recentPressureCurve: Array<{
    chapterIndex: number;
    pressureLevel: TensionPressureLevel;
    dominantTension: DominantTension;
    flatnessScore: number | null;
  }>;
  repeatedPatterns: string[];
  flatChapterIndexes: number[];
  rewardGaps: string[];
  nextBudgetInstruction: string;
};
```

checkpoint 规则：

- 最近 5 章平均 flatness 低于 70：后续 3 章至少 2 章升为 `medium` 或 `high`。
- 连续 3 章同一 `dominantTension`：后续 2 章切换张力类型。
- 连续 3 章没有强 reader reward：后续章节必须安排 truth、reversal、failure 或 breakthrough。
- 伏笔持续新增但未推进：后续预算减少 `mystery`，增加 `relationship`、`moral_choice` 或 `status_loss`。

## 数据存储

推荐新增表：

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
  PRIMARY KEY (book_id, volume_index, chapter_index)
);
```

新增 repository：

```text
src/storage/chapter-tension-budgets.ts
```

方法：

```ts
upsertMany(budgets: ChapterTensionBudget[]): void;
getByChapter(bookId: string, volumeIndex: number, chapterIndex: number): ChapterTensionBudget | null;
listByBook(bookId: string): ChapterTensionBudget[];
clearByBook(bookId: string): void;
deleteByBook(bookId: string): void;
```

为什么不并入 `chapter_cards`：

- `ChapterCard` 是“剧情任务”，`ChapterTensionBudget` 是“压力调度”。
- 后续 checkpoint 可能重排未写章节预算，但不一定改章节卡。
- UI 可以单独展示节奏曲线。

## Book Service 集成

### buildOutline 阶段

生成顺序：

```text
narrativeBible
volumePlans
chapterCards
tensionBudgets
```

保存顺序：

```text
storyBibles.saveGraph
volumePlans.upsertMany
chapterCards.upsertMany
chapterTensionBudgets.upsertMany
```

### writeNextChapter 阶段

读取：

```ts
const tensionBudget =
  deps.chapterTensionBudgets?.getByChapter(
    bookId,
    nextChapter.volumeIndex,
    nextChapter.chapterIndex
  ) ?? null;
```

传入：

```ts
const commandContext = buildNarrativeCommandContext({
  bible,
  chapterCard,
  tensionBudget,
  ...
});
```

审计上下文使用同一份 `commandContext`，确保审计知道本章预算。

## UI 策略

第一版不做复杂 UI，只在现有章节详情中可选展示：

- pressure level
- dominant tension
- audit score
- flatness score

后续增强再做“张力心电图”：

```text
章节 1  low     relationship
章节 2  medium  mystery
章节 3  high    moral_choice
章节 4  low     desire
章节 5  peak    status_loss
```

UI 不是第一阶段成功标准。第一阶段成功标准是生成章节不再只完成事件，而能稳定产生选择、代价、变化和钩子。

## 测试计划

新增测试：

- `tests/core/narrative-tension.test.ts`
  - validates one budget per chapter
  - rejects blank required turn/cost/irreversible change/hook pressure
  - rejects more than three repeated dominant tension values
  - rejects long low-pressure runs

扩展测试：

- `tests/core/narrative-context.test.ts`
  - command context includes Tension Budget
  - context trimming preserves required chapter card and tension budget fields

- `tests/core/narrative-prompts.test.ts`
  - tension budget prompt requires forced choice, cost, irreversible change, hook pressure
  - audit prompt includes flatness instructions

- `tests/core/narrative-audit-state-checkpoint.test.ts`
  - `decideAuditAction` rewrites low flatness average
  - `decideAuditAction` revises weak choice/consequence/irreversible change

- `tests/core/narrative-book-service.test.ts`
  - outline generation saves tension budgets
  - write chapter passes tension budget into command context
  - audit uses the tension-aware context

- `tests/storage/narrative-schema.test.ts`
  - migration creates `chapter_tension_budgets`
  - repository round-trips flatness risks JSON

Mock updates:

- `src/mock/story-services.ts`
  - mock outline service generates deterministic tension budgets
  - mock chapter writer reflects forced choice/cost in prose
  - mock auditor returns `flatness` scoring

## Rollout Plan

Phase 1: Core Budget

- Add types, prompt, validation, storage, mock data.
- Generate and save tension budgets after chapter cards.
- Inject budget into command context.
- Extend audit prompt and decision helper.

Phase 2: Checkpoint Rebalance

- Add tension checkpoint report.
- Detect repeated patterns and low flatness runs.
- Generate instructions for future budgets.

Phase 3: UI Visibility

- Show tension budget on book detail.
- Add compact tension curve in narrative panel.
- Surface flatness issues beside audit score.

## Risks

- Over-constraining the model may make every chapter feel melodramatic.
  Mitigation: allow `low` pressure, but require subtle movement.

- More structured prompts increase token usage.
  Mitigation: include only current chapter budget in draft context, and only recent budgets in checkpoint.

- Audit JSON may fail when schema grows.
  Mitigation: keep `flatness` optional in the first implementation and normalize missing fields.

- Budget generation may duplicate chapter card content.
  Mitigation: prompt explicitly distinguishes “chapter task” from “tension source.”

## Acceptance Criteria

- Every generated chapter card has a corresponding tension budget.
- Draft prompt includes chapter mission and tension budget.
- Audit prompt checks both task completion and flatness.
- Low flatness can trigger revision or rewrite.
- Tests prove repeated low/repeated tension patterns are rejected or flagged.
- Existing narrative control loop still works in mock mode and real model mode.

## Spec Self-Review

- Completion marker scan: no unfinished markers remain.
- Internal consistency: the flow preserves the existing bible -> plans -> cards -> draft -> audit -> state loop and inserts tension budget after chapter cards.
- Scope check: first implementation is limited to core budget, prompt injection, audit scoring, storage, mocks, and tests. UI curve and checkpoint rebalance are later phases.
- Ambiguity check: `ChapterCard` owns plot task; `ChapterTensionBudget` owns pressure/choice/cost/change/hook; `NarrativeAudit` verifies both.
