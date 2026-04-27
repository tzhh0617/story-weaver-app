# Story Weaver — AI 长篇小说全自动写作系统设计

## 概述

Story Weaver 是一个 Electron 桌面应用，面向个人作者/网文写手。用户只需提供一个 IDEA，AI 全自动完成世界观构建、大纲生成、章节写作，输出 50 万字以上的长篇小说。支持 50 本书同时写作，多模型切换，多格式导出。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33+ |
| 运行时 | Node.js 20+ LTS |
| 语言 | TypeScript（全项目） |
| 前端 | React + Vite |
| 数据库 | better-sqlite3（同步 API，仅主进程） |
| AI SDK | Vercel AI SDK (`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic` + `@ai-sdk/openai-compatible`) |
| 打包 | electron-builder |
| 导出 | epub-gen-memory |

## 架构

单体分层架构，Electron 主进程承载所有 IO 和 AI 调用，渲染进程纯 UI。

```
Electron Main Process
├── Scheduler（单例，管理所有 NovelEngine）
├── NovelEngine × N（每本书一个实例）
│   ├── 写作流水线（世界观 → 大纲 → 章节）
│   ├── ConsistencyChecker（写前构建上下文，写后提取更新）
│   └── PromptBuilder（组装 prompt）
├── ModelRegistry（Vercel AI SDK provider registry）
├── Database（better-sqlite3）
├── Exporter（TXT / Markdown / EPUB）
└── IPC handlers ←→ Renderer
```

## 项目结构

```
story-weaver-app/
├── electron/
│   ├── main.ts                # Electron 入口
│   ├── preload.ts             # contextBridge
│   └── ipc/                   # IPC channel handlers
├── src/
│   ├── core/
│   │   ├── engine.ts          # NovelEngine 状态机
│   │   ├── scheduler.ts       # 并发调度器
│   │   ├── outline.ts         # 大纲生成器
│   │   ├── chapter-writer.ts  # 单章写作
│   │   ├── consistency.ts     # 一致性校验（构建上下文 + 写后提取）
│   │   └── prompt-builder.ts  # Prompt 组装
│   ├── models/
│   │   ├── registry.ts        # createProviderRegistry 统一注册
│   │   ├── providers/
│   │   │   ├── openai.ts      # @ai-sdk/openai
│   │   │   ├── anthropic.ts   # @ai-sdk/anthropic
│   │   │   └── custom.ts      # @ai-sdk/openai-compatible（DeepSeek/Qwen/GLM）
│   │   └── config.ts          # 模型配置管理
│   ├── storage/
│   │   ├── database.ts        # SQLite 初始化、迁移、连接
│   │   ├── books.ts           # 书籍 CRUD
│   │   ├── chapters.ts        # 章节 CRUD
│   │   ├── characters.ts      # 人物档案 & 状态 CRUD
│   │   ├── plot-threads.ts    # 伏笔追踪 CRUD
│   │   ├── progress.ts        # 写作进度读写
│   │   ├── logs.ts            # API 调用日志
│   │   └── export.ts          # TXT / MD / EPUB 导出
│   └── utils/
│       ├── token-counter.ts   # Token 计数
│       └── text-splitter.ts   # 长文本分割
├── renderer/
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx      # 书架总览 + 批量控制
│   │   ├── NewBook.tsx        # 创建新书（输入 IDEA）
│   │   ├── BookDetail.tsx     # 单书详情（进度/章节/人物/伏笔）
│   │   └── Settings.tsx       # 模型配置 / API Key / 全局设置
│   ├── components/
│   │   ├── BookCard.tsx       # 书卡片
│   │   ├── ProgressBar.tsx    # 写作进度条
│   │   ├── ChapterList.tsx    # 章节列表 + 内容预览
│   │   ├── StatusBadge.tsx    # 状态标签
│   │   └── ModelForm.tsx      # 模型配置表单
│   └── hooks/
│       ├── useIpc.ts          # IPC 调用封装
│       └── useProgress.ts     # 实时进度订阅
├── package.json
├── electron-builder.yml
└── tsconfig.json
```

## 写作流水线

### 分层大纲

```
IDEA（用户输入，1-2 句话）
  ↓ AI 生成
世界观设定（人物表、力量体系、世界规则、核心冲突）~2000 字
  ↓ AI 生成
总大纲（全书主线、分卷结构、每卷核心事件）~5000 字
  ↓ AI 生成（逐卷）
卷大纲 × N（每卷 10-20 章，标注关键情节点）每卷 ~3000 字
  ↓ AI 生成（逐章）
章节大纲 × M（场景、角色行为、情感走向）每章 ~500 字
  ↓ AI 生成
章节正文 × M（每章 3000-5000 字）
```

### 引擎状态机

每本书独立状态机：

```
[creating] → [building_world] → [building_outline] → [writing] → [completed]
                                                          ↕
                                                      [paused]
                                                          ↓
                                                       [error]
```

`writing` 状态内部循环：取下一章节 → 构建上下文 → AI 写作 → 存储正文 → 提取更新 → 下一章。

## 一致性保障

50 万字长篇的核心难题，通过结构化数据表 + 写前写后双阶段机制解决。

### 结构化追踪表

**characters** — 人物档案（固定不变）：
- personality：性格描述（写作前生成，锚定用）
- speech_style：语言风格 + 示例对话（2-3 句）
- appearance：外貌
- abilities：能力/实力等级
- relationships：角色关系
- role_type：protagonist / supporting / antagonist / minor

**character_states** — 人物状态快照（每章更新）：
- location：当前位置
- status：当前状态描述
- knowledge：此刻已知的关键信息
- emotion：情绪状态
- power_level：实力等级

**plot_threads** — 伏笔 & 暗线：
- planted_at：埋设章节号
- expected_payoff：预计回收章节
- resolved_at：实际回收章节（NULL = 未回收）
- importance：critical / normal / minor

**world_settings** — 世界观规则（不可违反的设定）：
- category：power_system / geography / factions / rules / history
- key + content：设定名 + 详细描述

**scene_records** — 场景时空记录：
- location + time_in_story：时空定位
- characters_present：在场角色
- events：关键事件

### 写前：构建章节上下文

```ts
class ConsistencyChecker {
  async buildChapterContext(bookId: string, chapterIndex: number) {
    return {
      // 固定锚点
      worldRules:    world_settings 表 → category 分组,
      personalities: characters 表 → personality + speech_style,
      // 动态状态
      recentStates:  character_states 表 → 上章结束时的状态,
      // 伏笔提醒
      openThreads:   plot_threads 表 → 未回收且预计近期回收的伏笔,
      // 时空校验
      lastScene:     scene_records 表 → 上一章结尾场景,
      // 前情
      recentSummaries: chapters 表 → 近 2 章摘要,
      // 本章大纲
      currentChapterOutline: 当前章节大纲,
    };
  }
}
```

### 写后：提取更新

```ts
class ConsistencyChecker {
  async postChapterProcess(bookId: string, chapterIndex: number, content: string) {
    // 1. AI 提取该章信息变更（角色状态、新伏笔、伏笔回收、场景、知识变更）
    const extraction = await generateText({ ... });

    // 2. 更新 character_states
    // 3. 更新 plot_threads（新增 / 标记 resolved_at）
    // 4. 插入 scene_records
    // 5. 生成章节摘要
  }
}
```

## 并发调度

### Scheduler

```ts
class Scheduler {
  engines: Map<string, NovelEngine>;
  queue: PriorityQueue<string>;
  running: Set<string>;
  concurrencyLimit: number | null;  // null = 不限
  rateLimiter: TokenBucket | null;  // 可选限速
}
```

调度策略：每本书写完一章后释放槽位，重新排队，50 本书交替推进。

### 错误处理

| 错误类型 | 处理 |
|---------|------|
| API 限流 (429) | 指数退避重试 1s → 2s → 4s |
| API 超时 | 重试，同上 |
| AI 输出格式错误 | 换 prompt 重新生成 |
| API Key 失效 | 标记 error，通知用户 |
| 连续 3 次失败 | 该书暂停，其他书继续 |

### 断点恢复

crash 或暂停后重启：读 `writing_progress` 表 → 确认最后完成章节 → 从下一章继续。

## 数据模型

```sql
-- 书籍
CREATE TABLE books (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  idea          TEXT NOT NULL,
  status        TEXT DEFAULT 'creating',
  model_id      TEXT NOT NULL,
  target_words  INTEGER,
  created_at    TEXT,
  updated_at    TEXT
);

-- 世界观 & 大纲
CREATE TABLE book_context (
  book_id       TEXT PRIMARY KEY,
  world_setting TEXT,
  outline       TEXT,
  style_guide   TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 人物档案
CREATE TABLE characters (
  id            TEXT PRIMARY KEY,
  book_id       TEXT NOT NULL,
  name          TEXT NOT NULL,
  role_type     TEXT NOT NULL,
  personality   TEXT NOT NULL,
  speech_style  TEXT,
  appearance    TEXT,
  abilities     TEXT,
  background    TEXT,
  relationships TEXT,
  first_appear  INTEGER,
  is_active     INTEGER DEFAULT 1,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 人物状态快照
CREATE TABLE character_states (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id       TEXT NOT NULL,
  character_id  TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  location      TEXT,
  status        TEXT,
  knowledge     TEXT,
  emotion       TEXT,
  power_level   TEXT,
  UNIQUE (book_id, character_id, chapter_index)
);

-- 伏笔 & 暗线
CREATE TABLE plot_threads (
  id              TEXT PRIMARY KEY,
  book_id         TEXT NOT NULL,
  description     TEXT NOT NULL,
  planted_at      INTEGER NOT NULL,
  expected_payoff INTEGER,
  resolved_at     INTEGER,
  importance      TEXT DEFAULT 'normal',
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 世界观设定
CREATE TABLE world_settings (
  book_id   TEXT NOT NULL,
  category  TEXT NOT NULL,
  key       TEXT NOT NULL,
  content   TEXT NOT NULL,
  PRIMARY KEY (book_id, category, key),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 场景记录
CREATE TABLE scene_records (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id             TEXT NOT NULL,
  volume_index        INTEGER NOT NULL,
  chapter_index       INTEGER NOT NULL,
  location            TEXT NOT NULL,
  time_in_story       TEXT NOT NULL,
  characters_present  TEXT NOT NULL,
  events              TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- 章节
CREATE TABLE chapters (
  book_id       TEXT NOT NULL,
  volume_index  INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  title         TEXT,
  outline       TEXT,
  content       TEXT,
  summary       TEXT,
  word_count    INTEGER DEFAULT 0,
  created_at    TEXT,
  PRIMARY KEY (book_id, volume_index, chapter_index)
);

-- 写作进度
CREATE TABLE writing_progress (
  book_id         TEXT PRIMARY KEY,
  current_volume  INTEGER,
  current_chapter INTEGER,
  phase           TEXT,
  retry_count     INTEGER DEFAULT 0,
  error_msg       TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- API 日志
CREATE TABLE api_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id       TEXT,
  model_id      TEXT,
  phase         TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  duration_ms   INTEGER,
  created_at    TEXT
);

-- 模型配置
CREATE TABLE model_configs (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  model_name  TEXT NOT NULL,
  api_key     TEXT,
  base_url    TEXT,
  is_active   INTEGER DEFAULT 1,
  config_json TEXT
);

-- 全局设置
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

数据存储位置：`~/.story-weaver/data.db`（单文件，备份方便）。

## IPC 通道

```
book:create        → { idea, modelId, targetWords } → bookId
book:delete        → { bookId }
book:list          → → Book[]
book:detail        → { bookId } → BookDetail
book:start         → { bookId }
book:pause         → { bookId }
book:resume        → { bookId }
book:restart       → { bookId }
book:export        → { bookId, format } → filePath

scheduler:startAll
scheduler:pauseAll
scheduler:status   → → SchedulerStatus

scheduler:progress  → SchedulerStatus（推送）
book:chapterDone    → { bookId, chapterIndex, wordCount }（推送）
book:error          → { bookId, error }（推送）

model:list
model:save          → ModelConfig
model:test          → { modelId } → { ok, latency }
model:delete

settings:get
settings:set        → { key, value }
```

## UI 页面

### Dashboard（书架总览）
- 书卡片网格：每本显示标题、进度条、字数、状态、操作按钮（开始/暂停/查看/导出）
- 顶部批量操作：全部开始、全部暂停
- 统计栏：总进度（X/50 完成 | Y 写作中 | Z 排队）

### NewBook（创建新书）
- IDEA 输入框（多行文本）
- 模型选择下拉
- 目标字数输入
- 开始写作按钮

### BookDetail（单书详情）
- 顶部：状态、进度条、字数统计、写作速度、预计剩余时间
- 操作：暂停、导出（TXT/MD/EPUB）
- Tab 页：大纲 | 人物 | 章节 | 伏笔
  - 章节 Tab：按卷分组，显示章节标题、字数、状态（✓ 已完成 / ◉ 写作中 / 等待中），点击可查看正文

### Settings（设置）
- 模型管理：添加/编辑/删除模型配置（provider、model name、API Key、base URL、自定义参数）
- 连接测试
- 全局设置：并发限制、数据存储路径

## 多模型支持

使用 Vercel AI SDK 的 `createProviderRegistry` 统一管理：

```ts
const registry = createProviderRegistry({
  openai: createOpenAI({ apiKey }),
  anthropic,
  deepseek: createOpenAICompatible({ name: 'deepseek', baseURL: '...', apiKey }),
  qwen: createOpenAICompatible({ name: 'qwen', baseURL: '...', apiKey }),
});
```

调用方式：`generateText({ model: registry('deepseek.deepseek-chat'), ... })`，切换模型只改字符串。

用户在 Settings 页面配置 provider 和 API Key，运行时动态注册。
