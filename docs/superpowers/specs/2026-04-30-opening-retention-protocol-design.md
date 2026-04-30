# Story Weaver 开篇留存协议设计

## 背景

Story Weaver 当前已经具备长篇叙事控制闭环：故事圣经、分卷计划、章节任务卡、张力预算、写前叙事指挥台、写后审计、阶段 checkpoint。系统已经能约束“每章必须推进什么”，也能通过 flatness scoring 检查章节是否缺少选择、代价、变化和钩子。

但长篇小说的前几章有特殊任务。前几章不是普通章节，它们负责把读者从“随手点开”推到“愿意追读”。如果开篇没有快速建立异常、欲望、代价、不可逆入局和题材承诺，后续再稳的长篇控制也很难挽回流失。

本设计采用方案 C：复用现有 `ChapterCard`、`ChapterTensionBudget`、`story-router` 和审计闭环，在前 5 章叠加“开篇留存协议”，不新增独立存储表。

## 目标

- 前 5 章形成明确留存曲线：异常入场、问题变贵、不可逆入局、首次回报、长线敌意。
- 在章节卡和张力预算生成时，对前 5 章施加更具体的开篇约束。
- 写前 prompt 能识别当前章节是否属于开篇留存段，并携带对应任务。
- 写后审计对前 3 章提高钩子、选择压力和不可逆变化要求。
- 不新增独立写作流水线，不破坏现有 narrative control loop。

## 非目标

- 不新增 `OpeningRetentionPlan` 数据表。
- 不做完整留存数据分析或读者行为统计。
- 不强制所有题材使用同一种开篇事件，只规定叙事功能。
- 不要求前 5 章都高压。第 4 章允许释放，但必须给读者回报并带副作用。

## 设计原则

1. 开篇章节承担比普通章节更强的读者契约。
   普通章节可以服务中长期铺垫，前 5 章必须快速证明“这本书值得继续读”。

2. 留存靠问题、代价和回报交替，不靠纯悬念。
   只抛问题会疲劳；只给回报会卸力。开篇必须让未完成期待和阶段满足交替出现。

3. 复用现有结构，不发明平行系统。
   `ChapterCard` 继续负责剧情任务，`ChapterTensionBudget` 继续负责压力、选择、代价和章末问题。

4. 审计必须前置严格。
   前 3 章如果钩子软、选择弱、变化不可感，系统应优先修订或重写，而不是让弱开篇进入后续上下文。

## 开篇五章协议

### 第 1 章：异常入场

叙事任务：尽快让读者问“这到底怎么回事？”

字段约束：

- `dominantTension` 优先使用 `mystery` 或 `danger`。
- `readerReward` 优先使用 `dread` 或 `truth`。
- `mustChange` 必须让主角从日常状态被拖入异常。
- `forcedChoice` 必须让主角在隐藏、追查、逃避或利用异常之间选择。
- `costToPay` 必须包含名誉、关系、资源或安全感损失。
- `readerQuestion` 必须指向“为什么偏偏是主角？”
- `hookPressure` 必须出现更坏证据、危险目击者、期限或被盯上的迹象。

写作约束：前 300 到 500 字必须出现异常、欲望、冲突、危险或未解问题，不允许大段背景解释开局。

### 第 2 章：问题变贵

叙事任务：让读者发现“这不是小麻烦”。

字段约束：

- `dominantTension` 优先使用 `status_loss`、`relationship` 或 `resource_cost`。
- `mustChange` 必须让第一章问题产生可见后果。
- `forcedChoice` 必须让主角在保全自己和保全秘密、关系、机会或他人之间取舍。
- `costToPay` 必须在正文中被看见。
- `readerQuestion` 必须指向“谁在借这个事件逼主角入局？”
- `hookPressure` 必须把个人危机升级成更大的结构性危机。

### 第 3 章：不可逆入局

叙事任务：让读者理解本书的长期承诺。

字段约束：

- `pressureLevel` 优先使用 `high` 或 `peak`。
- `dominantTension` 优先使用 `moral_choice` 或 `deadline`。
- `mustChange` 必须让主角做出无法撤回的选择。
- `forcedChoice` 必须在安全旧生活和危险新秩序之间制造取舍。
- `irreversibleChange` 必须包含身份暴露、关系破裂、契约成立、敌人锁定或规则触发。
- `readerQuestion` 必须指向主角真正要对抗的东西。
- `hookPressure` 必须打开主线入口。

### 第 4 章：首次明确回报

叙事任务：证明读者会获得爽点、真相、成长或关系推进。

字段约束：

- `readerReward` 优先使用 `breakthrough`、`truth` 或 `upgrade`。
- `dominantTension` 不应重复前三章中最常见的张力来源。
- `mustChange` 必须让主角获得一个能力、线索、盟友、身份或局部胜利。
- `costToPay` 必须让回报带副作用。
- `readerQuestion` 必须让读者怀疑这个回报是否包含陷阱或更大代价。

### 第 5 章：长线敌意

叙事任务：把短钩子变成长钩子。

字段约束：

- `dominantTension` 优先使用 `relationship`、`mystery` 或 `danger`。
- `mustChange` 必须让主角确认自己已被更大力量盯上。
- `informationReveal` 必须揭开一点真相，同时制造更大的未知。
- `irreversibleChange` 必须改变关系阵营、敌我判断或目标方向。
- `hookPressure` 必须让下一章必须行动，而不是以后再说。

## 生成流程调整

现有流程保持不变：

```text
idea
  -> generate narrative bible
  -> generate volume plans
  -> generate chapter cards
  -> generate tension budgets
  -> write chapter with command context
  -> audit chapter
  -> revise or rewrite if needed
  -> persist chapter and narrative state
```

调整点：

- `buildChapterCardPrompt` 在 `targetChapters >= 5` 时加入开篇五章协议。
- `buildTensionBudgetPrompt` 在前 5 章加入推荐张力曲线：`medium -> high -> peak -> medium/high -> high`。
- 目标章节少于 5 章时，按已有章节数压缩协议：第 1 章异常入场，最后一章不可逆入局，中间章节问题变贵或首次回报。
- 开篇协议只影响前 5 章，不改变后续章节的常规生成规则。

## 写前上下文

`buildNarrativeCommandContext` 可增加一个可选 opening retention block，或在调用处拼入 route plan 文本。

推荐第一版不扩展数据模型，只在 route plan 或 prompt 中加入：

```text
Opening retention phase:
- chapter 1: abnormal entry
- chapter 2: rising cost
- chapter 3: irreversible entry
- chapter 4: first clear reward
- chapter 5: long-term hostility
Current opening phase: ...
Required opening effect: ...
```

这样能避免新增存储字段，同时让写章 prompt 明确当前开篇功能。

## Story Router 调整

`design_opening` 当前包含：

- `story-structure`
- `emotion-curve`
- `opening-hook`
- `hook-technique`
- `genre-pattern`

建议补充：

- `chapter-goal`：确保开篇不只是有钩子，也完成章节任务。
- `pacing-audit`：确保开篇有选择、代价、后果和变化。

`write_chapter` 现有路由已经包含这些技能，因此重点是让前 5 章的 route plan 文本更具体。

## 审计规则

前 3 章使用更严格的 flatness 阈值：

- `hookStrength < 80` 时至少 `revise`。
- `choicePressure < 70` 时至少 `revise`。
- `irreversibleChange < 75` 时至少 `revise`。
- 出现 `soft_hook` 时至少 `revise`。
- 出现 `flat_chapter` 时 `rewrite`。

第 4 到第 5 章维持常规 flatness 规则，但要求：

- 第 4 章必须有阶段回报和副作用。
- 第 5 章必须形成长线敌意或长期未知。

## UI 调整

第一版 UI 只做轻量提示，不新增复杂页面。

在 Book Detail 的章节上下文区域，如果章节索引在 1 到 5 之间，可以显示：

- 开篇阶段名称。
- 本章读者问题。
- 本章章末压力。
- 本章代价。
- 本章不可逆变化。
- flatness 分数和软钩子问题。

这能让用户在生成后快速判断：前几章到底有没有留人。

## 测试策略

- `tests/core/narrative-prompts.test.ts`
  - 断言 chapter card prompt 包含前 5 章协议。
  - 断言 tension budget prompt 包含开篇张力曲线。

- `tests/core/story-router.test.ts`
  - 断言 `design_opening` 包含 `chapter-goal` 和 `pacing-audit`。

- `tests/core/narrative-audit.test.ts`
  - 断言前 3 章低 `hookStrength` 会触发 revise。
  - 断言前 3 章 `flat_chapter` 会触发 rewrite。
  - 断言普通后续章节仍按现有 flatness 规则处理。

- `tests/renderer/book-detail.test.tsx`
  - 断言前 5 章显示开篇阶段提示。
  - 断言非开篇章节不显示开篇阶段提示。

## 风险和缓解

- 风险：前几章过度高压，导致题材气质变硬。
  缓解：第 4 章明确允许释放和回报，但必须带副作用。

- 风险：协议太模板化，所有故事开头长得像。
  缓解：协议只定义章节功能，不规定具体事件；题材承诺仍由 `genreContract` 和 `targetReaderExperience` 控制。

- 风险：短篇或少章节项目不适合完整五章协议。
  缓解：按章节数压缩协议。

- 风险：新增 UI 干扰现有 Book Detail 信息密度。
  缓解：只在已有章节上下文区域增加小型提示，不新增页面。

## 成功标准

- 前 5 章的章节卡能体现异常入场、问题变贵、不可逆入局、首次回报和长线敌意。
- 前 5 章的张力预算能体现推荐张力曲线和不同张力来源。
- 写章 prompt 能明确当前开篇阶段任务。
- 前 3 章弱钩子、弱选择、无不可逆变化会触发修订或重写。
- UI 能让用户直接看到开篇留存相关字段。

## 自检

- Placeholder scan：无 TBD、TODO 或空章节。
- Internal consistency：设计保持现有 narrative control loop，只在前 5 章叠加规则。
- Scope check：本设计聚焦 prompt、router、audit 和轻量 UI，不新增存储表，适合单轮实现计划。
- Ambiguity check：`ChapterCard` 继续负责剧情任务，`ChapterTensionBudget` 继续负责压力调度，开篇协议只规定前 5 章的功能和阈值。
