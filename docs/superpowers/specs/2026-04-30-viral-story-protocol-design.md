# Story Weaver 爆款写作协议设计

## 背景

Story Weaver 当前已经具备较完整的长篇小说生成控制链路：故事圣经、分卷计划、章节卡、张力预算、开篇留存协议、故事技能路由、章节审计和阶段 checkpoint。这些能力能约束“故事是否连贯”“章节是否推进”“开篇是否留人”，但还缺少一个更上层的问题：

> 这本书凭什么让目标读者持续追读？

所谓“爆款思维”不应被理解为堆热门标签，也不应变成系统、重生、退婚、打脸、升级等桥段的机械拼贴。它应该被拆成可执行、可审计、可持续调度的读者机制：清晰欲望、强入口钩子、稳定回报、题材承诺、反预期、新鲜感和长期追读问题。

本设计新增 `ViralStoryProtocol`，把“读者为什么继续读”变成贯穿故事生成、章节写作和审计修订的结构化约束。

## 目标

- 在故事设计阶段明确读者承诺、主角核心欲望、题材契约和追读机制。
- 在章节生成阶段持续注入爽点、钩子、反转、代价和回报节奏约束。
- 在章节审计阶段检查开篇吸引力、欲望清晰度、回报强度、类型承诺兑现和套路风险。
- 让爆款规则服务长期叙事一致性，而不是破坏人物逻辑和世界规则。
- 复用现有 narrative control loop，不新增平行写作流水线。

## 非目标

- 不承诺自动生成商业爆款。
- 不引入实时平台热榜、读者行为数据或外部市场分析。
- 不把所有题材统一写成快节奏爽文。
- 不替代现有 `ChapterCard`、`ChapterTensionBudget`、`OpeningRetentionProtocol` 或 `StorySkillRouter`。
- 不做复杂可视化编辑器。第一版只展示必要的只读策略摘要和审计结果。

## 设计原则

1. 爆款是读者机制，不是题材贴纸。
   热门元素只有在服务欲望、冲突、回报和追读问题时才有效。

2. 爽点必须带代价。
   没有副作用的回报会让故事卸力；每次阶段胜利都应转化为新的风险、误判、敌意或关系债务。

3. 熟悉感和新鲜感同时存在。
   类型承诺要兑现，具体桥段要有反预期、局部变形或人物独特选择。

4. 短留存和长留存分层调度。
   前 5 章负责入坑和不可逆入局；后续章节负责稳定兑现、升级问题和维护长期敌意。

5. 爆款规则不能越过叙事一致性。
   打脸、反转、升级、亲密推进和揭秘都不能破坏人物逻辑、世界规则、时间线和已发生剧情。

## 当前项目支撑点

已有可复用模块：

- `src/core/narrative/types.ts`
  - `ChapterCard`
  - `ChapterTensionBudget`
  - `NarrativeAudit`
  - `FlatnessScoring`
- `src/core/narrative/opening-retention.ts`
  - 前 5 章开篇留存阶段定义
- `src/core/narrative/prompts.ts`
  - 故事圣经、章节卡、张力预算、草稿、审计和修订 prompt
- `src/core/story-router/`
  - 写作技能注册、任务路由、prompt rules
- `src/storage/story-bibles.ts`
  - 故事圣经持久化入口
- `src/storage/chapter-tension-budgets.ts`
  - 章节张力预算持久化入口
- `src/storage/chapter-audits.ts`
  - 章节审计持久化入口

第一版应优先把爆款协议作为故事圣经和章节上下文的一部分接入，避免新增过多独立表。

## 核心概念

### ViralStoryProtocol

`ViralStoryProtocol` 是作品级爆款策略。它回答“这本书卖给读者的核心情绪体验是什么”。

```ts
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
```

字段含义：

- `readerPromise`：作品承诺给读者的核心体验，例如逆袭、复仇、破局、被偏爱、掌控命运。
- `targetEmotion`：主要情绪回报。
- `coreDesire`：主角最强欲望。
- `protagonistDrive`：主角主动行动的持续动力。
- `hookEngine`：持续制造追读的机制，例如身份秘密、敌意升级、规则代价、谜团递进。
- `payoffCadence`：阶段回报频率和强度。
- `tropeContract`：类型承诺。
- `antiClicheRules`：防套路规则。
- `longTermQuestion`：支撑整本书的长期追读问题。

### ViralTargetEmotion

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
```

### ViralTropeContract

```ts
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
```

### ViralPayoffCadence

```ts
export type ViralPayoffCadence = {
  mode: 'fast' | 'steady' | 'slow_burn' | 'suppressed_then_burst';
  minorPayoffEveryChapters: number;
  majorPayoffEveryChapters: number;
  payoffTypes: ViralPayoffType[];
};

export type ViralPayoffType =
  | 'face_slap'
  | 'upgrade'
  | 'truth_reveal'
  | 'relationship_shift'
  | 'resource_gain'
  | 'local_victory'
  | 'identity_reveal'
  | 'enemy_setback';
```

## 生成流程

调整后的流程：

```text
user idea
  -> generate narrative bible
  -> derive viral story protocol
  -> generate volume plans with viral protocol
  -> generate chapter cards with viral protocol
  -> generate tension budgets with viral protocol
  -> build story route plan
  -> write chapter with chapter card + tension budget + viral protocol
  -> audit chapter narrative quality + flatness + viral scoring
  -> revise or rewrite when needed
  -> persist chapter, audit, and narrative state
  -> checkpoint long-term payoff and hook cadence
```

### 协议生成时机

第一版推荐在故事圣经生成后派生 `ViralStoryProtocol`，理由：

- 故事圣经已经包含类型、主角、冲突、世界规则和长期线索。
- 爆款协议需要尊重故事圣经，而不是反过来覆盖它。
- 后续分卷计划、章节卡和张力预算都可以读取同一份协议。

如果用户在新建小说页显式填写爆款策略，系统应把用户输入作为高优先级约束，再由模型补全结构化字段。

## Prompt 注入

### 故事圣经

故事圣经 prompt 增加：

- 明确目标读者的核心情绪回报。
- 写出主角的强欲望和主动行动理由。
- 标注本书的类型承诺。
- 标注不允许使用的套路化处理。

### 分卷计划

分卷计划 prompt 增加：

- 每卷必须有一个阶段回报。
- 每卷必须升级长期追读问题。
- 每卷结尾必须改变主角和敌意结构的力量关系。
- 禁止连续两卷使用相同类型的大回报。

### 章节卡

章节卡 prompt 增加：

- 本章必须服务 `readerPromise`。
- 本章必须推进或复杂化 `longTermQuestion`。
- 按 `payoffCadence` 判断本章是否需要 minor payoff 或 major payoff。
- 若本章有回报，必须写出副作用。
- 若本章使用类型套路，必须说明新鲜变形点。

### 张力预算

张力预算 prompt 增加：

- `dominantTension` 应与本章回报类型形成配合。
- `readerQuestion` 必须具体到下一章行动压力。
- `costToPay` 必须承接本章爽点或突破。
- 连续低回报章节必须提高谜团、关系或危险压力。

### 章节草稿

写章 prompt 增加一个只读块：

```text
Viral story protocol:
- Reader promise: {readerPromise}
- Core desire: {coreDesire}
- Hook engine: {hookEngine}
- Payoff cadence: {payoffCadence}
- Current chapter expected payoff: {currentChapterExpectedPayoff}
- Anti-cliche rule for this chapter: {antiClicheRule}
```

## 审计规则

### ViralScoring

```ts
export type ViralScoring = {
  openingHook: number;
  desireClarity: number;
  payoffStrength: number;
  readerQuestionStrength: number;
  tropeFulfillment: number;
  antiClicheFreshness: number;
};
```

分数含义：

- `openingHook`：开头是否快速给出异常、欲望、冲突、危险或未解问题。
- `desireClarity`：主角本章行动是否能看出强欲望。
- `payoffStrength`：本章是否兑现了应有回报。
- `readerQuestionStrength`：章末是否形成具体追读问题。
- `tropeFulfillment`：类型承诺是否被看见。
- `antiClicheFreshness`：桥段是否有新鲜变形，而不是照搬常见套路。

### 新增审计问题类型

```ts
export type ViralAuditIssueType =
  | 'weak_reader_promise'
  | 'unclear_desire'
  | 'missing_payoff'
  | 'payoff_without_cost'
  | 'generic_trope'
  | 'weak_reader_question'
  | 'stale_hook_engine';
```

规则：

- 前 3 章 `openingHook < 80`：至少 `revise`。
- 任意章节 `desireClarity < 65`：至少 `revise`。
- 到达回报节奏点但 `payoffStrength < 70`：至少 `revise`。
- 出现 `payoff_without_cost`：至少 `revise`。
- 连续 2 章 `readerQuestionStrength < 70`：下一章预算必须提高 hook pressure。
- 连续 3 章 `generic_trope`：checkpoint 要求调整后续章节卡。
- `antiClicheFreshness < 50`：修订 prompt 必须要求替换桥段或增加反预期。

## Story Router 调整

在 `StorySkillRegistry` 增加三个技能。

### `viral-promise`

触发：

- `design_opening`
- `write_chapter`
- `revise_chapter`
- `audit_story`

规则：

- 本章必须服务作品读者承诺。
- 主角行动必须能看出核心欲望。
- 不允许只靠设定解释读者爽点。

### `payoff-cadence`

触发：

- `write_chapter`
- `revise_chapter`
- `audit_story`

规则：

- 按回报节奏判断本章是否需要 minor payoff 或 major payoff。
- 回报必须带副作用、债务、误判或新敌意。
- 连续压抑章节必须有补偿性信息、关系或能力推进。

### `anti-cliche`

触发：

- `design_opening`
- `write_chapter`
- `revise_chapter`

规则：

- 类型套路可以使用，但必须有具体变形。
- 禁止使用没有代价的万能系统、没有逻辑的突然打脸、没有铺垫的身份碾压。
- 熟悉桥段必须由人物独特选择或世界规则变形来获得新鲜感。

## 数据存储

第一版有两个选择。

### 方案 A：嵌入 Story Bible

把 `viralStoryProtocol` 作为故事圣经 JSON 的可选字段。

优点：

- 改动小。
- 与作品级设定天然绑定。
- 不需要新增表和迁移。

缺点：

- 后续如果要独立编辑爆款策略，读取和更新粒度不够细。

### 方案 B：新增独立表

新增 `viral_story_protocols` 表，按 `bookId` 存储。

优点：

- 独立演进空间更大。
- 适合未来做 UI 编辑、版本回滚和策略对比。

缺点：

- 第一版迁移和仓储代码更多。
- 容易让爆款协议看起来像独立流水线。

推荐第一版采用方案 A。等 UI 编辑需求明确后，再迁移到独立表。

## UI 调整

### 新建小说页

增加一个轻量区域：`爆款策略`。

字段：

- 读者爽点：逆袭、复仇、解谜、成长、权谋、甜宠、生存、被偏爱。
- 主角欲望：一句话输入。
- 类型承诺：多选。
- 节奏偏好：快爽、稳爽、悬疑递进、压抑后爆发。
- 反套路方向：可选一句话。

这些字段都应是可选项。用户不填时，由模型根据创意自动派生。

### 书籍详情页

在章节上下文或审计区域显示只读摘要：

- 本书读者承诺。
- 当前章节追读问题。
- 当前章节应兑现的回报。
- 当前章节爽点副作用。
- 爆款审计分数。
- 套路风险提示。

第一版不做复杂图表，只做可扫描文本和分数。

## 修订策略

当爆款审计失败时，修订 prompt 应优先做局部改写：

- 欲望不清：强化主角本章想要什么，以及为什么现在必须行动。
- 回报不足：增加局部胜利、信息突破、关系推进或能力使用。
- 回报无代价：增加副作用、敌意、误判、关系裂缝或资源消耗。
- 钩子弱：把章末停顿改成具体行动压力。
- 套路陈旧：保留类型承诺，替换达成路径。

只有当章节整体没有服务读者承诺或主角核心欲望时，才建议 `rewrite`。

## 测试策略

- `tests/core/viral-story-protocol.test.ts`
  - 断言能从故事圣经派生协议。
  - 断言用户显式输入会覆盖模型默认推断。
  - 断言协议包含 readerPromise、coreDesire、hookEngine、payoffCadence 和 antiClicheRules。

- `tests/core/narrative-prompts.test.ts`
  - 断言章节卡 prompt 包含 reader promise 和 payoff cadence。
  - 断言张力预算 prompt 包含 payoff side effect 要求。
  - 断言写章 prompt 包含 viral story protocol block。

- `tests/core/story-router.test.ts`
  - 断言 `write_chapter` 路由包含 `viral-promise` 和 `payoff-cadence`。
  - 断言 `design_opening` 路由包含 `anti-cliche`。

- `tests/core/narrative-audit.test.ts`
  - 断言前 3 章低 openingHook 会触发 revise。
  - 断言到达回报节奏点但 missing payoff 会触发 revise。
  - 断言 payoff_without_cost 会触发 revise。

- `tests/renderer/book-detail.test.tsx`
  - 断言书籍详情页展示读者承诺和当前章节回报摘要。
  - 断言无协议字段的旧书不会崩溃。

## 风险和缓解

- 风险：系统把爆款理解成固定套路。
  缓解：加入 `antiClicheRules` 和 `antiClicheFreshness`，并要求熟悉桥段必须有变形。

- 风险：爽点过密导致故事失去呼吸。
  缓解：`payoffCadence` 区分快爽、稳爽、慢热和压抑后爆发，不要求每章都强回报。

- 风险：回报破坏人物逻辑。
  缓解：Story Router 优先级规定人物逻辑、世界规则、章节卡和张力预算高于爆款增强。

- 风险：新增字段影响旧书兼容。
  缓解：`viralStoryProtocol` 为可选字段，旧书缺失时按现有流程运行。

- 风险：审计过严导致频繁重写。
  缓解：第一版大多数爆款问题触发 `revise`，只有章节整体偏离读者承诺或主角欲望时才 `rewrite`。

## 实施建议

第一版分三步实现：

1. 类型和 prompt 注入。
   新增 `ViralStoryProtocol`、`ViralScoring` 类型，并把协议文本注入故事圣经、章节卡、张力预算和写章 prompt。

2. 审计和路由。
   扩展审计 JSON，加入爆款分数和问题类型；在 Story Router 注册 `viral-promise`、`payoff-cadence`、`anti-cliche`。

3. UI 摘要。
   在新建小说页增加可选爆款策略输入，在书籍详情页展示只读协议和章节爆款审计结果。

## 验收标准

- 新建小说时，即使用户只输入一句创意，系统也能生成作品级爆款协议。
- 前 5 章 prompt 同时受到开篇留存协议和爆款协议约束。
- 章节审计能指出欲望不清、回报不足、回报无代价、套路陈旧和追读问题弱。
- 旧书缺少 `viralStoryProtocol` 时仍能正常打开和生成章节。
- UI 能让用户快速看到：这本书的读者承诺是什么，本章是否兑现了追读理由。
