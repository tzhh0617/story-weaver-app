# Layout Card Unification Design

## Goal

统一 Story Weaver 中“布局 Card”的视觉语言，让页面级容器和表单区块都回到同一套审美与层级规则下。

这次调整的目标是：

- 提升整体页面的一致性与完成度
- 保留当前暖色纸面工作台气质
- 增加设计感，但避免依赖夸张阴影制造层次
- 让页面容器默认更安静，把视觉注意力留给内容和操作

## Scope

本次只处理布局 Card，不处理内容 Card。

### In Scope

- `renderer/components/ui/card.tsx`
- `renderer/pages/Settings.tsx`
- `renderer/pages/NewBook.tsx`
- `renderer/pages/BookDetail.tsx`
- `renderer/components/ModelForm.tsx`

### Out of Scope

- `renderer/components/BookCard.tsx`
- `renderer/components/EmptyState.tsx`
- `renderer/components/ChapterList.tsx`
- 任何列表行、封面卡、内容预览卡、状态卡

## Current Problem

当前布局 Card 已经分成两套语言：

1. `Settings` 使用更精致的卡片风格：
   - 更大的圆角
   - 更细的边框与浅 ring
   - 更明确的 header 区分
   - 更明显但仍偏轻的阴影
2. `NewBook`、`BookDetail`、`ModelForm` 仍使用更基础的容器风格：
   - `rounded-lg`
   - `shadow-sm`
   - 较少的 header / body 节奏区分

结果是同一应用内的页面容器看起来不像来自同一套系统：设置页已经像成品，其他页面更像默认 UI 组件组合。

## Design Direction

采用 `Soft Panel` 方向。

这套方向强调：

- 像压在纸面工作台上的浅层卡片
- 主要依靠背景、边框、圆角、header 底色和轻微 ring 建立层次
- 阴影只保留一层柔和悬浮感，不使用厚重或高扩散的戏剧化阴影
- 默认静态，不给布局 Card 加 hover 浮起效果

视觉关键词：

- warm
- editorial
- quiet
- crafted
- paper-panel

## Unified Layout Card Rules

### 1. Base container

所有布局 Card 统一为一套基础容器样式：

- 更圆润的圆角，接近 `Settings` 当前气质
- `bg-card/95` 一类的实体卡面，而不是过于透明
- `border-border/70` 左右的柔和边框
- 极浅 `ring`，用于提升轮廓清晰度
- 轻量阴影，保持存在感但不过度抢戏

这套基础样式应当沉淀到通用 `Card` 组件上，作为布局 Card 默认语言，而不是继续在各页面手写不同组合。

### 2. Header rhythm

布局 Card 的标题区统一建立“卡头”概念：

- Header 和 Content 的分区更明确
- Header 可使用很浅的背景或渐变，但对比度必须克制
- Header 底部分隔线统一
- 标题、描述、辅助英文 eyebrow 的间距统一

这会让 `Settings`、`NewBook`、`BookDetail` 的容器拥有一致的结构节奏。

### 3. Content spacing

布局 Card 的内部间距统一到一致的节奏：

- 标题区与内容区的 padding 统一
- 表单项之间统一使用相近 gap
- 页面容器的 section header 与 card body 不再各写各的密度

目标不是所有内容看起来一样，而是让不同页面的“容器骨架”一致。

### 4. Static by default

布局 Card 默认不使用 hover 抬升、位移或明显阴影增强。

原因：

- 页面里通常会同时出现多个布局容器
- 如果这些容器都像可点击卡片一样浮动，会破坏页面稳定感
- 交互强调应优先留给按钮、tabs、列表项和内容卡

### 5. Inner section compatibility

`BookDetail` 内部的 `DetailSection` 也属于布局容器，应与新的布局 Card 语言保持一致，但可以采用略微简化的密度，避免详情页内部过于厚重。

## Implementation Approach

### Option A: Push everything into the base `Card` component

优点：

- 一次修改，所有 `Card` 立刻统一

缺点：

- 会误伤内容 Card，例如 `EmptyState`
- 还会影响当前故意手写样式的卡片，风险过大

### Option B: Keep `Card` generic, create a dedicated layout-card variant

优点：

- 布局 Card 与内容 Card 边界清晰
- 可以逐步迁移页面级容器
- 风险更低

缺点：

- 需要在页面里替换 class 或补一层 helper

### Option C: Keep page-level overrides only

优点：

- 改动最少

缺点：

- 统一效果不稳定
- 之后很容易再次分叉

## Recommendation

选择 Option B。

具体做法：

- 保持 `Card` 作为基础低假设组件
- 在 `renderer/components/ui/card.tsx` 中增加布局 Card 专用样式出口
- 让页面级容器显式使用 layout-card class / helper
- 统一 `CardHeader`、`CardContent` 的布局用法

这样既能完成统一，也不会把 `BookCard`、`EmptyState` 这类有独立设计职责的内容卡一起抹平。

## Affected Surfaces

### Settings

- 保留当前更成熟的审美方向
- 去掉不必要的 hover shadow 强化
- 作为其他布局 Card 的参考基准

### NewBook

- 顶部说明容器与主表单 Card 收口到同一语言
- 左侧索引 header 与右侧表单 body 的边框、底色、圆角层次统一

### BookDetail

- 顶部总览 header 统一为布局 Panel
- `DetailSection` 与 tabs 容器风格对齐
- 页面从“多个基础盒子”提升为“同一套工作台面板”

### ModelForm

- `variant="card"` 时跟随统一布局 Card
- `variant="inline"` 继续作为嵌入内容区使用，不重复加外层面板感

## Testing

需要覆盖两类验证：

1. 行为验证
   - 现有 `Settings`、`App shell` 相关测试继续通过
   - 不改变表单交互、按钮可用性、tabs 切换等行为
2. 结构约束验证
   - 为布局 Card 增加类名约束测试，避免页面再次回退到各自手写的旧容器样式

## Non-Goals

- 不重做整套主题
- 不统一内容卡的视觉风格
- 不引入 hover-card 风格的悬浮交互
- 不改变业务结构、页面信息架构或组件职责

## Success Criteria

- `Settings`、`NewBook`、`BookDetail`、`ModelForm(card)` 看起来来自同一套页面容器系统
- 卡片层次主要依赖边框、底色、分区与轻量阴影，而不是重阴影
- 页面稳定、克制，有设计感但不过度装饰
- `BookCard`、`EmptyState` 等内容卡继续保留独立表达
