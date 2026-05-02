# Book Title Generation Design

## Goal

新建作品时支持用户预填写书名。用户没有填写书名时，系统记录一个明确的自动生成标记，并且只在这个标记表示需要生成时才调用自动书名生成。确定后的书名要进入后续世界观、大纲、章节卡、张力预算和章节正文的生成上下文，让内容持续兑现标题承诺。

## Current Behavior

`NewBook` 表单只提交故事设想、目标章节数、每章字数和爆款策略。后端创建书本时统一保存初始标题 `新作品`。启动生成时，`outline-aggregate` 在 `naming_title` 阶段调用 `outlineService.generateTitleFromIdea()`，然后用生成结果更新书名。

这个流程有三个问题：

- 用户无法在创建时直接指定书名。
- 是否自动生成书名没有独立状态，只能从流程或标题文本推断，后续容易误判。
- 书名生成后没有作为明确输入贯穿后续生成 prompt。

## Data Model

为 book 增加标题来源/生成状态字段：

```ts
titleGenerationStatus: 'manual' | 'pending' | 'generated'
```

状态含义：

- `manual`: 用户创建时填写了书名，系统不得自动覆盖。
- `pending`: 用户创建时没有填写书名，启动生成时需要自动生成。
- `generated`: 系统已经为该书生成或 fallback 得到了标题，后续不再重复生成。

使用枚举而不是布尔值，是为了让数据能表达标题当前来源，便于调试、列表展示和后续扩展“重新生成书名”功能。

数据库中的既有书本需要迁移。兼容策略：

- 新列默认值为 `generated`，避免旧书在升级后被误判为等待生成。
- 新建书本根据创建输入明确写入状态。

## API Contract

`BookCreateSchema` 和共享 contract 增加可选字段：

```ts
title?: string
```

前端提交前 trim 标题：

- trim 后非空：发送 `title`。
- trim 后为空：不发送 `title`。

后端 `createBook` 的规则：

- 有 `title`：保存该标题，`titleGenerationStatus = 'manual'`。
- 无 `title`：保存占位标题 `新作品`，`titleGenerationStatus = 'pending'`。

后端仍负责最终判定状态，不能只依赖前端。

## Generation Flow

启动生成时，`outline-aggregate.generateFromIdea()` 读取书本的 `titleGenerationStatus`。

如果状态是 `pending`：

1. 进入 `naming_title` 阶段。
2. 调用 `outlineService.generateTitleFromIdea()`。
3. 生成结果 trim 并 normalize。
4. 如果结果为空，使用 `deriveTitleFromIdea(book.idea)` 作为 fallback。
5. 更新 `books.title`。
6. 更新 `titleGenerationStatus = 'generated'`。
7. 用更新后的标题继续生成世界观、大纲和章节规划。

如果状态不是 `pending`：

1. 跳过自动书名生成。
2. 直接使用当前 `book.title` 进入后续生成。

任何自动生成判断都不能使用 `title === '新作品'` 之类的文本比较。

## Title-Aware Prompts

`OutlineGenerationInput` 增加：

```ts
title: string
```

以下 prompt 都应接收并引用书名：

- 书名生成 prompt：使用故事设想、读者爽点、主角欲望、节奏偏好、反套路方向生成更贴主题、更有吸引力的中文网文书名。
- 世界观/叙事圣经 prompt：明确要求世界规则、主角目标和核心冲突兑现书名承诺。
- 总纲、分卷、章节卡、张力预算 prompt：用书名作为作品定位和读者预期约束。
- 章节正文 prompt：从书本记录读取最终标题并包含 `Book title`，要求章节内容持续服务标题承诺，不能写成与标题气质无关的故事。

标题 prompt 的质量要求：

- 贴合故事主题和主角欲望。
- 能暗示核心冲突、爽点或反套路卖点。
- 简短、有记忆点，适合作为中文网文书名。
- 避免泛泛词，如“传奇”“风云”“异世”等空泛组合，除非用户设想强相关。
- 只返回一个中文书名，不带引号、解释、候选列表或 Markdown。

## Frontend UX

`NewBook` 表单增加一个可选输入框：

- 标签：`书名`
- 位置：放在 `故事设想` 前，让用户先决定作品标题；也可以留空让系统生成。
- 输入为空不阻止提交。
- 提交按钮和现有 pending 逻辑保持不变。

创建成功后的提示调整：

- 如果用户填写了书名：提示“书本已创建，正在构建世界观...”
- 如果用户未填写书名：沿用“书本已创建，正在生成书名...”

## Components And Files

预计涉及文件：

- `packages/frontend/src/pages/NewBook.tsx`
- `packages/frontend/src/pages/NewBookRoute.tsx`
- `packages/shared/src/schemas/book-schemas.ts`
- `packages/shared/src/contracts.ts`
- `packages/backend/src/storage/schema.ts`
- `packages/backend/src/storage/books.ts`
- `packages/backend/src/storage/migrate.ts`
- `packages/backend/src/core/aggregates/book/book-aggregate.ts`
- `packages/backend/src/core/aggregates/book/book-aggregate-deps.ts`
- `packages/backend/src/core/aggregates/outline/outline-aggregate.ts`
- `packages/backend/src/core/aggregates/outline/outline-aggregate-deps.ts`
- `packages/backend/src/core/prompt-builder.ts`
- `packages/backend/src/core/types.ts`
- `packages/backend/src/core/narrative/prompts.ts`
- 相关 renderer、shared、storage、aggregate、prompt 测试。

## Testing

按 TDD 增加覆盖：

- shared schema 接受可选 `title`，拒绝非字符串类型。
- 新建书本传入 title 时，保存用户标题并标记 `manual`。
- 新建书本不传 title 时，保存占位标题并标记 `pending`。
- outline 聚合在 `pending` 时调用书名生成，并在成功/fallback 后标记 `generated`。
- outline 聚合在 `manual` 或 `generated` 时不调用书名生成。
- 后续 outline 生成输入包含最终标题。
- title prompt 包含读者爽点、主角欲望、反套路方向和吸引力约束。
- 前端新建表单能提交可选书名，空白书名不会发送。

## Non-Goals

- 不做创建后编辑书名。
- 不做手动“重新生成书名”按钮。
- 不在列表页展示标题来源状态。
- 不改变既有章节数、字数、爆款策略字段的交互方式。

## Acceptance Criteria

- 用户创建书本时可以填写书名。
- 用户填写书名后，系统不会自动覆盖该书名。
- 用户未填写书名时，系统用明确状态标记需要自动生成，而不是根据标题文本判断。
- 自动生成完成后，状态变为 `generated`，重复启动不会再次生成书名。
- 后续所有主要生成阶段都能读取并引用最终标题。
- 自动书名 prompt 更贴合主题，并更强调中文网文吸引力。
