# Story Skill Router Design

## Goal

把长篇小说写作技巧从“静态能力清单”升级为“可执行的创作路由系统”。

系统在每次写作、改写、诊断前，先识别任务类型，再选择必须调用的小说写作模块，生成硬约束、写作规则和质检清单。这样章节生成不再只依赖一次性 prompt，而是稳定经过：

- 任务识别
- 技能路由
- 上下文装配
- 硬约束注入
- 内容生成
- 章节审计
- 修订建议

## Background

当前项目已经具备较完整的长篇叙事控制基础：

- Narrative Bible：作品前提、类型契约、人物弧光、关系、世界规则、叙事线
- Volume Plan：卷目标、卷压力、承诺回报、结尾转折
- Chapter Card：章节功能、冲突、人物关系变化、信息揭示、读者回报、结尾钩子
- Tension Budget：压力等级、主导张力、强制选择、代价、不可逆变化、读者问题
- Chapter Audit：人物逻辑、世界规则、主线停滞、节奏、读者回报、平淡章节等检查
- Narrative Checkpoint：按章节间隔检查张力重复、平淡风险和后续调整建议

这些能力已经能描述“长篇应该怎样运行”，但还缺少一个入口层来回答：

> 本次用户任务到底需要调用哪些能力？哪些规则是强制的？哪些只是风格建议？写完后按什么标准验收？

Story Skill Router 用来补齐这个入口层。

## Scope

### In Scope

- 新增小说技能注册表
- 新增任务路由器
- 新增路由结果类型
- 将路由结果注入章节生成 prompt
- 将路由结果注入章节审计 prompt
- 在生成结果中保留本次调用的写作模块、硬约束和检查清单
- 在现有章节详情或生成结果区域展示一份只读路由摘要
- 增加针对路由规则的单元测试

### Out of Scope

- 不重写现有 Narrative Bible、Volume Plan、Chapter Card、Tension Budget 的生成逻辑
- 不替换现有模型调用层
- 不新增复杂可视化工作流编辑器
- 不做用户自定义技能 marketplace
- 不把所有写作技巧一次性做成可配置 UI

## Design Direction

采用规则注册表加轻量路由器的方案。

每个小说写作模块注册为一个 `StorySkill`。路由器根据用户任务、章节上下文、当前生成阶段选择相关模块，并产出 `StoryRoutePlan`。生成 prompt 和审计 prompt 都读取同一份 `StoryRoutePlan`，保证写作标准和验收标准一致。

这是一条保守路线：它不改变现有叙事资产的数据结构，只在生成链路前后增加调度层，便于测试，也便于后续扩展。

## Core Concepts

### Story Skill

`StorySkill` 是小说创作能力模块的结构化描述。

字段包括：

- `id`：稳定标识
- `name`：展示名称
- `type`：`process`、`execution`、`audit`
- `priority`：同类模块排序
- `rigidity`：`hard` 或 `soft`
- `triggers`：适用任务类型
- `requiredContext`：需要读取的上下文
- `promptRules`：生成时注入的规则
- `auditQuestions`：审计时追加的问题
- `redFlags`：写作红旗

`hard` 技能代表不能随意违反的约束，例如人物逻辑、世界规则、时间线、已发生剧情。`soft` 技能代表可根据文风和题材调整的建议，例如钩子强度、对白密度、文风颗粒度。

### Story Task Type

V1 支持这些任务类型：

- `write_chapter`
- `revise_chapter`
- `design_opening`
- `design_character`
- `audit_story`
- `de_ai`

任务类型可以由显式调用传入。若后续需要支持自然语言命令入口，再在外层增加分类器，不让路由器直接依赖自由文本判断。

### Story Route Plan

`StoryRoutePlan` 是路由器的主要输出。

它包括：

- `taskType`
- `requiredSkills`
- `optionalSkills`
- `hardConstraints`
- `promptRules`
- `auditQuestions`
- `redFlags`
- `checklist`

章节生成、章节审计、UI 展示和日志记录都使用这份计划。

## Priority Rules

路由器和 prompt 注入必须遵守以下优先级：

1. 用户本次明确要求
2. 已有作品设定：人物、关系、世界规则、叙事线
3. 当前章节卡
4. 当前张力预算
5. 被路由器选中的写作技能规则
6. 通用文风润色

低优先级规则不能推翻高优先级规则。尤其是文风优化、反转、爽点、钩子增强，不能破坏人物行为逻辑、世界规则和已发生剧情。

## Initial Skill Registry

V1 注册 13 个技能。

### Process Skills

#### `story-structure`

用于维持大纲和卷目标。

触发：

- `write_chapter`
- `revise_chapter`
- `audit_story`

核心规则：

- 本章必须服务当前卷计划
- 本章必须产生可描述的剧情位移
- 主线不能连续停滞

#### `chapter-goal`

用于确保当前章完成章节卡里的功能。

触发：

- `write_chapter`
- `revise_chapter`

核心规则：

- 必须完成 `mustChange`
- 必须体现 `plotFunction`
- 结尾必须承接或强化 `endingHook`

#### `character-logic`

用于保护人物动机、恐惧、缺陷和决策边界。

触发：

- `write_chapter`
- `revise_chapter`
- `design_character`
- `audit_story`

核心规则：

- 人物行动必须能从欲望、恐惧、缺陷、误信或当前压力中解释
- 不允许为了推动剧情让人物突然降智或突然变聪明
- 不能越过 `lineWillNotCross`，除非本章明确写出代价和转折原因

#### `emotion-curve`

用于设计期待、压迫、释放、失落、亲密或恐惧等情绪推进。

触发：

- `write_chapter`
- `revise_chapter`
- `design_opening`

核心规则：

- 本章需要有可感知的情绪方向
- 情绪变化应由事件、选择或关系动作触发
- 不能用解释性独白代替情绪推进

### Execution Skills

#### `opening-hook`

用于开头和章节起势。

触发：

- `write_chapter`
- `design_opening`

核心规则：

- 开头尽快给出异常、冲突、欲望、危险或未解问题
- 不用大段背景解释开局
- 前几段必须建立读者继续阅读的理由

#### `hook-technique`

用于章节钩子和段落牵引。

触发：

- `write_chapter`
- `revise_chapter`
- `design_opening`

核心规则：

- 章节结尾必须制造下一章必须承接的问题
- 信息揭示后要留下新的不确定性
- 冲突可以阶段性解决，但不能完全卸力

#### `dialogue-control`

用于对白节奏、潜台词和信息控制。

触发：

- `write_chapter`
- `revise_chapter`
- `de_ai`

核心规则：

- 对话必须带有目的、遮掩、试探、冲突或关系变化
- 不用对白整块解释设定
- 角色说话方式应符合身份、关系和当下压力

#### `genre-pattern`

用于保持题材承诺。

触发：

- `write_chapter`
- `design_opening`
- `audit_story`

核心规则：

- 本章需要回应 `genreContract`
- 读者回报必须符合题材预期
- 不能为了技巧破坏目标读者体验

#### `prose-style`

用于统一叙事声音和文风。

触发：

- `write_chapter`
- `revise_chapter`
- `de_ai`

核心规则：

- 遵守 `voiceGuide`
- 镜头、心理、动作和叙述密度要匹配当前场景
- 文风优化不能改变事实、关系和人物动机

#### `de-ai-style`

用于减少模板化、空泛、机械转折和总结腔。

触发：

- `revise_chapter`
- `de_ai`

核心规则：

- 删除泛泛总结和抽象情绪标签
- 用具体动作、选择、物件、环境反馈呈现心理
- 避免连续使用同构句式和套路化转场

### Audit Skills

#### `consistency-audit`

用于检查设定、人物、关系和世界规则一致性。

触发：

- `write_chapter`
- `revise_chapter`
- `audit_story`

核心检查：

- 是否违反世界规则
- 是否改变已建立人物逻辑
- 是否绕过既有关系状态
- 是否新增未授权的重要设定

#### `pacing-audit`

用于检查主线推进、节奏、张力重复和平淡风险。

触发：

- `write_chapter`
- `revise_chapter`
- `audit_story`

核心检查：

- 是否有剧情位移
- 是否有选择压力
- 是否有代价或后果
- 是否重复相同张力模式

#### `red-flag-audit`

用于发现长篇写作常见失控信号。

触发：

- `write_chapter`
- `revise_chapter`
- `audit_story`
- `de_ai`

核心检查：

- 人物为了剧情服务而失真
- 反派或配角不合理降智
- 对话只在解释设定
- 伏笔只埋不推
- 章末没有追读压力
- 爽点缺少压抑、代价或关系变化支撑

## Routing Rules

### `write_chapter`

Required:

- `story-structure`
- `chapter-goal`
- `character-logic`
- `emotion-curve`
- `opening-hook`
- `hook-technique`
- `dialogue-control`
- `genre-pattern`
- `prose-style`
- `consistency-audit`
- `pacing-audit`
- `red-flag-audit`

Optional:

- `de-ai-style`

### `revise_chapter`

Required:

- `story-structure`
- `chapter-goal`
- `character-logic`
- `emotion-curve`
- `hook-technique`
- `dialogue-control`
- `prose-style`
- `de-ai-style`
- `consistency-audit`
- `pacing-audit`
- `red-flag-audit`

### `design_opening`

Required:

- `story-structure`
- `emotion-curve`
- `opening-hook`
- `hook-technique`
- `genre-pattern`

### `design_character`

Required:

- `character-logic`

### `audit_story`

Required:

- `story-structure`
- `character-logic`
- `genre-pattern`
- `consistency-audit`
- `pacing-audit`
- `red-flag-audit`

### `de_ai`

Required:

- `dialogue-control`
- `prose-style`
- `de-ai-style`
- `red-flag-audit`

## Prompt Integration

### Draft Prompt

`buildNarrativeDraftPrompt` receives an optional `routePlanText`.

When present, the prompt includes:

- priority rules
- selected skills
- hard constraints
- prompt rules
- checklist

The existing hard requirements remain, especially:

- complete `mustChange`
- fulfill the tension budget
- make `forcedChoice` visible through action
- make `costToPay` visible before chapter end
- preserve `forbiddenMoves`
- show world-rule cost when a rule is used
- make relationship changes visible through action

The route plan adds structure around these requirements without replacing them.

### Audit Prompt

`buildChapterAuditPrompt` receives an optional `routePlanText`.

When present, the prompt includes:

- selected audit skills
- audit questions
- red flags
- hard constraint checks

The existing issue enum remains unchanged in V1. New route-specific findings should map to existing issue types where possible:

- 人物失真 -> `character_logic`
- 世界设定冲突 -> `world_rule_violation`
- 主线停滞 -> `mainline_stall`
- 节奏平 -> `flat_chapter`
- 章末无追读 -> `soft_hook`
- 未体现代价 -> `missing_consequence`
- 未体现读者回报 -> `missing_reader_reward`

## UI Surface

V1 只做轻量只读展示，不提供复杂配置。

在章节生成结果或详情区域展示“写作路由”摘要：

- 本次任务类型
- 已调用模块
- 硬约束数量
- 检查清单
- 审计风险

示例：

```text
写作路由：写下一章

已调用：
- 大纲排布
- 当前章目标
- 人物动机
- 情绪曲线
- 钩子技法
- 一致性检查

硬约束：
- 不违反世界规则
- 不新增主要角色
- 必须完成 mustChange
- 必须体现 costToPay
```

UI 不需要让用户手动切换每个技能。自动路由是 V1 的默认体验。展示层只读取生成流程返回的 `routePlan`，不在 UI 内重复实现路由逻辑。

## Error Handling

路由器不能因为上下文缺失而中断生成，除非缺失的是生成必需输入。

处理方式：

- 缺失章节卡：降级为通用章节目标规则，并在 route plan 中记录 warning
- 缺失张力预算：保留钩子、人物和节奏检查，但跳过预算专属规则
- 缺失 Narrative Bible：使用用户 idea 和已有章节摘要，但 route plan 记录高风险 warning
- 未知 task type：返回显式错误，由调用方决定是否重新提交为受支持任务类型

## Testing

### Unit Tests

新增路由器测试：

- `write_chapter` 必须选择章节目标、人物逻辑、钩子、审计技能
- `de_ai` 不应选择大纲和开头技能
- `audit_story` 不应选择纯生成技能
- hard 技能应排在 soft 技能之前或在输出中明确标注
- 未知任务类型应返回可预期错误

### Prompt Tests

新增 prompt 结构测试：

- draft prompt 包含 route plan 的 priority rules
- draft prompt 包含 hard constraints
- audit prompt 包含 red flags
- audit prompt 保留现有 issue enum

### Regression Tests

现有章节生成、审计和 mock service 测试应继续通过。Mock 生成服务不需要真正理解所有规则，但需要能接收增强后的 prompt。

## Success Criteria

- 每次章节生成都能得到一份确定的 `StoryRoutePlan`
- 生成 prompt 和审计 prompt 使用同一份路由结果
- 章节输出可以展示本次调用的小说技能模块
- 路由逻辑有单元测试覆盖
- V1 不破坏现有叙事圣经、章节卡、张力预算和章节审计流程

## Non-Goals

- 不把写作技能做成用户可安装插件
- 不支持作者自定义路由规则
- 不做自然语言分类器
- 不重写审计 issue enum
- 不引入复杂工作流图编辑
- 不改变数据库 schema，除非实现阶段需要持久化路由计划

## Implementation Notes

建议新增：

```text
src/core/story-router/types.ts
src/core/story-router/registry.ts
src/core/story-router/router.ts
src/core/story-router/prompt-rules.ts
src/core/story-router/__tests__/router.test.ts
```

建议小幅修改：

```text
src/core/narrative/prompts.ts
```

生成流程返回结构需要携带 `routePlan`，供章节详情或生成结果区域做只读展示。V1 的路由逻辑只在 core 层实现，UI 层不做二次推断。
