# Story Weaver 自动 Mock 兜底设计

## 目标

为 Story Weaver 增加一套正式的运行时 `mock` 兜底机制，使应用在“没有任何完整可用模型配置”时仍然可以完整执行大纲生成、章节写作和写后提取流程，并输出更接近真实中文网文的内容与结构化数据。

本次设计的重点不是增加一个新的可选 provider，而是把当前零散存在的旧开发态 fallback 收口为清晰、可预测的产品行为。

## 已确认决策

### 1. 触发条件

- 只有在“没有任何完整可用模型配置”时，系统才自动启用 `mock`
- “完整可用模型配置”的判断沿用现有规则：
  - `id` 必填
  - `modelName` 必填
  - `apiKey` 必填
  - 对 `deepseek`、`qwen`、`glm`、`custom`，`baseUrl` 也必填
- 只要存在至少一个完整可用模型配置，系统就进入真实模型模式

### 2. 降级边界

- 自动 `mock` 只处理“当前没有可用模型”的场景
- 一旦存在完整模型配置，任何真实模型错误都必须直接暴露
- 以下情况都不能再自动切回 `mock`：
  - 模型 ID 不存在
  - provider registry 构建失败
  - API key 错误
  - 网络错误
  - 模型调用超时
  - 模型输出不符合预期

### 3. 设置页与存储层

- 不修改设置页表单校验
- 不允许为了本需求保存半成品模型配置
- 不新增 `mock` provider
- 不新增数据库字段或迁移

### 4. Mock 内容来源

- `mock` 输出必须使用中文
- `mock` 输出不能继续停留在英文占位文案或纯开发提示文本
- `mock` 需要基于一套内置的中文网文风格数据包生成结果
- 这套数据包应为仓库内自带的整理素材与示例，不直接内置外部小说原文

## 当前问题

当前代码已经存在一套 development 风格的 fallback 实现，但它还不是正式定义好的运行模式。

主要问题：

- `electron/runtime.ts` 在多个能力入口上各自判断并各自 `catch -> mock fallback`
- fallback 语义不统一，有的是“无模型时退回”，有的是“真实模型报错后也退回”
- 前端和用户认知上没有“系统正在使用 mock”的正式概念
- 真实模型调用失败时被 fallback 吃掉，会掩盖配置或连接问题
- 当前 development/mock 文本明显偏占位性质，章节正文、角色名和世界元素不足以体现中文网文的阅读质感

结果是：当前行为虽然“能跑”，但并不透明，也不符合“用户一旦配置真实模型，失败就应该明确可见”的目标。

## 设计原则

### 1. Mock 是运行模式，不是 provider

本次不把 `mock` 建模成新的 provider 类型，而是把它定义为 runtime 在特定条件下启用的一条备用执行路径。

### 2. 可用性判断统一

是否进入 `mock mode` 应由一处统一判断决定，而不是散落在每个服务调用里分别猜测。

### 3. 真实错误必须透明

当系统已经具备真实模型执行条件后，所有模型相关错误都应按真实失败处理，不能被悄悄伪装成成功。

### 4. 尽量复用现有 development 实现

当前已有 development outline、chapter、summary、extractor 系列实现，本次优先将它们正式化为 mock 能力，而不是再写一套平行逻辑。

### 5. 改动集中在 runtime

本次尽量把改动收敛在 `electron/runtime.ts` 及其直接依赖，避免触碰 renderer、IPC 契约和数据库结构。

### 6. Mock 数据要像作品，不像示例

`mock` 不只是为了让流程通过，还要让用户在无模型时看到“像一部中文网文正在生成”的结果。因此 mock 产物至少要满足：

- 标题、设定、卷纲、章纲、正文、摘要都以中文输出
- 章节正文具备网文常见的推进节奏，而不是一句解释性占位文本
- 角色、场景、伏笔、事件之间存在基本一致的叙事关系

### 7. 风格数据内置且可维护

风格数据应该以仓库内的结构化素材形式存在，便于后续扩展题材、角色模板、桥段库与章节模板，而不是把大量硬编码字符串散落在 runtime 中。

## 范围

### In Scope

- 明确定义“没有完整模型配置时自动使用 mock”
- 收口 runtime 内的 fallback 分支
- 统一 6 条 AI 能力的 mock / real 选择规则
- 将现有 development/mock 输出升级为基于中文网文风格数据包的正式 mock 实现
- 补充运行时行为测试

### Out of Scope

- 设置页新增 `mock` provider
- 放宽模型保存规则
- 数据库存储 mock 模式标记
- 变更 IPC channel 语义
- 新增 mock 专属 UI 提示或切换开关
- 直接内置外部中文小说原文或大段受版权保护语料

## 运行时模式设计

runtime 启动后不需要长期缓存模式，而是在每次相关调用前动态计算当前模式：

1. 读取 `modelConfigs.list()`
2. 通过现有 `getAvailableModelConfigs(...)` 过滤出完整可用配置
3. 根据过滤结果决定模式

模式规则：

- `availableConfigs.length === 0`：进入 `mock mode`
- `availableConfigs.length > 0`：进入 `real mode`

这样可以保证：

- 用户还未配置模型时立即可用
- 用户保存了第一个完整模型后立即切换到真实模型
- 用户删掉最后一个完整模型后又会自动回到 mock

## 能力分流规则

以下 6 条能力必须统一遵循同一条模式判断：

- `outlineService.generateFromIdea`
- `chapterWriter.writeChapter`
- `summaryGenerator.summarizeChapter`
- `plotThreadExtractor.extractThreads`
- `characterStateExtractor.extractStates`
- `sceneRecordExtractor.extractScene`

### Mock Mode

当没有任何完整可用模型配置时：

- `generateFromIdea` 直接调用基于中文网文风格包的 mock outline 服务
- `writeChapter` 直接调用基于中文网文风格包的 mock chapter writer
- `summarizeChapter` 直接调用基于中文网文风格包的 mock summary generator
- `extractThreads` 直接调用基于中文网文风格包的 mock plot thread extractor
- `extractStates` 直接调用基于中文网文风格包的 mock character state extractor
- `extractScene` 直接调用基于中文网文风格包的 mock scene record extractor

此时不构建 provider registry，也不尝试真实模型调用。

### Real Mode

当存在至少一个完整可用模型配置时：

- 构建 runtime registry
- 使用 `resolveModelId()` 选中当前默认模型
- 所有能力只执行真实模型逻辑
- 删除当前 `try/catch` 中“失败后回退到 mock fallback”的行为

此时任何错误都直接向上抛出。

## resolveModelId 语义

`resolveModelId()` 继续保留当前默认行为：

- 有完整模型配置时，返回第一个可用模型的 `id`
- 没有完整模型配置时，返回占位模型 ID，例如 `mock:fallback`

这个占位 ID 只服务于 mock 路径的入参一致性，不代表实际 provider，也不应参与真实 registry 构建。

## Mock 数据策略

mock 数据不采用“随机几句话”策略，而是采用“内置风格包 + 输入映射 + 模板拼装”的方式。

### 风格包内容

建议内置一组结构化中文网文素材，至少包含：

- 题材原型：如都市异能、仙侠升级、权谋复仇、规则怪谈、无限流等
- 世界规则模板：力量体系、代价机制、组织势力、社会秩序
- 角色原型：主角、宿敌、盟友、导师、执法者、情报商等
- 场景原型：宗门、古城、黑市、学宫、秘境、审讯厅、夜雨长街等
- 章节节奏模板：开场压迫、信息揭示、冲突升级、反转收束、钩子结尾
- 伏笔模板：旧债、禁术、误判、密令、血脉、遗物、门规、契约等
- 摘要与结构化抽取模板：确保场景、角色状态、伏笔和事件能互相对应

### 数据来源约束

- 素材以原创整理、类型化总结、短示例片段为主
- 不直接复制具体知名小说原文
- 不依赖运行时联网下载语料

### 输出策略

给定用户 `idea` 后，mock 服务应：

1. 从 `idea` 中抽取关键词或主题倾向
2. 选择最接近的题材原型
3. 组合角色、势力、场景、冲突和章节模板
4. 生成中文世界观、大纲、章节正文与写后结构化数据

不同题材不仅要切换世界观素材，也要切换卷纲与章纲骨架。例如仙侠题材和都市异能题材不应共享同一套章节标题、关键场景和冲突入口。

输出目标不是“高度随机”，而是“稳定、像样、可读”。

## testModel 语义

`testModel(modelId)` 保持严格模式，不参与自动 mock：

- 当 `availableConfigs` 中不存在目标模型时，返回失败结果
- 当存在目标模型时，执行真实连通性测试
- 不允许出现“没有模型也测试成功”的假象

这样可以保证设置页中的“测试连接”始终只表示真实模型联通状态。

## 错误处理

### Mock Mode

- 不应触发任何真实模型相关错误
- 如果 mock 实现自身抛错，按普通运行时错误处理

### Real Mode

以下错误必须原样暴露，不回退：

- `Model not found`
- provider 初始化错误
- 鉴权错误
- 网络错误
- 超时
- AI SDK 抛出的生成错误

这能确保用户在切换到真实模型后能立即感知配置或服务异常。

## 代码结构建议

本次实现建议在 `electron/runtime.ts` 中新增小型 helper，而不是继续复制条件分支。

推荐抽象：

- 一个 helper 负责读取当前 `persistedConfigs` 与 `availableConfigs`
- 一个 helper 负责判断 `isMockMode`
- 一个 helper 负责在 `real mode` 下构建 registry
- 一组独立的 mock story services 负责基于中文网文风格数据包生成内容与结构化结果

目标不是大规模重构，而是把现在“判断 + catch fallback”的重复逻辑压缩成一致的模式分流。

## 测试设计

本次优先补运行时行为测试，而不是改已有 renderer 测试。

### 必测用例

1. 当没有任何完整可用模型配置时，生成大纲会走 mock outline 服务。
2. 当没有任何完整可用模型配置时，章节写作与写后提取会走整套 mock 能力。
3. 当存在完整模型配置时，章节写作会调用真实 `generateText`。
4. 当存在完整模型配置且真实调用失败时，错误会向上抛出，不再回退到 mock。
5. 当模型不存在时，`testModel` 返回失败结果。
6. mock 大纲与章节输出为中文，并包含明确的网文题材和叙事元素。
7. mock 的角色、场景、事件与伏笔抽取结果能和生成正文保持基本一致。

### 保持不变的测试面

- 设置页表单校验测试不需要因本需求而修改
- 存储层 `model-configs` 测试不需要新增“半成品配置”场景
- renderer 测试只需要在已有快照或文本断言受影响时做必要更新

## 实施顺序

1. 先补一条或多条 runtime 行为测试，覆盖 mock mode 与 real mode 的边界
2. 为中文网文风格包和 mock story services 补测试
3. 在 `electron/runtime.ts` 收口模式判断
4. 删除真实模型路径中的隐式 fallback
5. 跑相关测试并确认旧用例没有被误伤

## 风险与缓解

### 风险 1：当前测试主要覆盖 service，不直接覆盖 runtime 分流

缓解方式：

- 为 runtime 新增聚焦行为测试，只验证模式选择与错误传播

### 风险 2：删除 `catch -> mock fallback` 后，可能暴露之前被掩盖的真实错误

缓解方式：

- 这是符合需求的预期变化
- 用测试明确锁定“有完整模型配置时必须报错”的新语义

### 风险 3：`resolveModelId()` 的占位 ID 可能被误用于真实路径

缓解方式：

- 在 real mode 分支中先验证 `availableConfigs` 非空，再构建 registry 并取模型
- 在 mock mode 分支中完全不触碰真实 registry

### 风险 4：mock 文本仍然显得像演示数据

缓解方式：

- 将题材、角色、场景、冲突、章节节奏拆成结构化风格包
- 用测试锁定“中文输出、章节长度、叙事元素存在、一致性抽取可用”等最低质量标准

## 验收标准

- 没有任何完整模型配置时，用户可以正常创建书籍并推进自动写作流程
- 一旦存在完整模型配置，系统只走真实模型链路
- 真实模型调用失败时，错误能向上暴露给 UI
- mock 输出表现为中文网文风格，而不是英文占位文案
- mock 章节、摘要、角色状态、场景和伏笔数据之间保持基本一致
- 设置页行为与现有校验保持一致
- 不新增 provider 类型、数据库字段或额外开关
