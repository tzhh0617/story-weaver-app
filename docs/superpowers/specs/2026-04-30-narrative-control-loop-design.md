# Story Weaver 叙事控制闭环设计

## 背景

Story Weaver 当前已经具备基础自动写作流水线：从 idea 生成标题、世界观、总纲、分卷纲、章节纲，再按章节写作，并在写后抽取摘要、人物状态、伏笔和场景记录。

这条链路能让模型连续产出，但对长篇小说来说还不够。长篇真正容易偏的地方不是“忘了某个名字”，而是人物欲望变弱、关系不再变化、支线热闹但不改变主线、世界规则被临时打破、伏笔越开越多、主题回答逐渐模糊。

本设计把系统从“章节生成器”升级为“叙事状态机 + 审计闭环”。每一章都必须回答：它推动了什么冲突，改变了谁，兑现或制造了什么期待，是否仍在靠近最终主题答案。

## 目标

- 开书阶段生成可长期约束写作的结构化故事圣经，而不是一段松散世界观文本。
- 章节大纲升级为章节任务卡，每章明确冲突、关系变化、信息揭露、伏笔动作、读者小满足和禁行项。
- 写章前构建叙事指挥台，把人物欲望、关系压力、世界规则代价、伏笔义务、主题方向注入 prompt。
- 写章后执行叙事审计，检查人物逻辑、主线推进、关系变化、世界规则、伏笔、节奏和主题。
- 审计失败时自动修订或重写，避免低质量章节直接污染后续上下文。
- 每隔固定章节做阶段复盘和后续重规划，防止 100 章以后大纲失效。
- 数据库存储直接升级为结构化叙事 schema，允许破坏性修改开发期数据结构。

## 非目标

- 不在本轮设计里实现完整可视化关系图。
- 不追求一次生成完美全书正文，系统仍然以章节迭代为核心。
- 不要求模型永远严格输出完美 JSON；实现层需要解析、校验、补救。
- 不把所有写作理论都变成硬规则。系统只硬控会导致长篇偏航的关键变量。

## 设计原则

1. 重要叙事承诺必须结构化保存。
   如果某个信息会影响后续 50 章，就不能只藏在自然语言大纲里。

2. 每章必须产生不可逆变化。
   可以是局势变化、人物认知变化、关系变化、世界信息变化、伏笔状态变化。日常章也必须有暗流。

3. 回收必须改变局势。
   伏笔回收不能只是解释“原来如此”，必须改变人物选择、关系格局、权力分布或主题答案。

4. 世界规则必须有代价。
   使用力量、身份、资源和权力时，需要记录代价、受益者、受害者和禁忌后果。

5. 审计先于入库。
   章节草稿生成后先审计，通过或修订后再保存为正式章节。

6. 总纲是磁场，不是铁轨。
   系统要保持最终方向稳定，但允许根据已生成状态周期性调整后续章节卡。

## 当前链路缺口

当前实现的主要支撑点：

- `book_context.world_setting` 保存世界观文本。
- `book_context.outline` 保存总纲文本。
- `chapters.outline` 保存章节大纲。
- `character_states` 保存每章后人物位置、状态、知识、情绪、实力。
- `plot_threads` 保存伏笔开启和回收。
- `scene_records` 保存最近场景。
- `buildStoredChapterContext` 写章前拼接连续性上下文。
- `extractChapterUpdate` 写后抽取摘要、伏笔、人物状态和场景。

这些结构适合连续性，但缺少叙事控制：

- 人物只有状态，没有欲望、恐惧、缺陷、误信、弧线和行动逻辑。
- 关系只是人物档案里的文本，没有独立追踪关系变化。
- 世界规则缺少代价、禁忌、阶层、资源归属和例外条件。
- 伏笔没有区分主线、支线、关系线、主题线、反派线。
- 章节大纲没有明确本章功能、冲突层级、信息揭露、读者满足和结尾钩子。
- 写后没有判断“这章是否偏航”，只要生成了文本就会进入后续上下文。

## 总体架构

目标流水线：

```text
idea
  -> generate title
  -> generate narrative bible
  -> validate narrative bible
  -> generate volume plan
  -> generate chapter cards
  -> validate chapter cards
  -> write chapter with narrative command context
  -> audit chapter draft
  -> revise or rewrite if needed
  -> extract state deltas
  -> persist chapter and narrative state
  -> checkpoint review every N chapters
  -> replan future chapter cards when needed
```

核心模块：

- `narrative-bible-service`: 生成和校验故事圣经。
- `chapter-card-service`: 生成分卷计划和章节任务卡。
- `narrative-context-builder`: 写章前构建叙事指挥台。
- `chapter-draft-auditor`: 写后审计章节草稿。
- `chapter-revision-service`: 根据审计问题修订或重写。
- `narrative-state-extractor`: 从通过审计的章节提取状态变化。
- `narrative-checkpoint-service`: 周期性检查弧线、线程债务和后续计划。
- `future-card-replanner`: 根据已发生事实重排未写章节卡。

## 数据模型

### Story Bible

故事圣经是全书最高层约束。它不是给读者看的设定集，而是给生成系统使用的叙事合同。

```ts
type NarrativeBible = {
  premise: string;
  genreContract: string;
  targetReaderExperience: string;
  themeQuestion: string;
  themeAnswerDirection: string;
  centralDramaticQuestion: string;
  endingState: {
    protagonistWins: string;
    protagonistLoses: string;
    worldChange: string;
    relationshipOutcome: string;
    themeAnswer: string;
  };
  voiceGuide: string;
};
```

### Character Arc

人物档案必须能解释人物为什么反复犯错，为什么会成长或堕落，以及什么压力会迫使他改变。

```ts
type CharacterArc = {
  id: string;
  name: string;
  roleType: 'protagonist' | 'deuteragonist' | 'supporting' | 'antagonist' | 'minor';
  desire: string;
  fear: string;
  flaw: string;
  misbelief: string;
  wound: string;
  externalGoal: string;
  internalNeed: string;
  arcDirection: 'growth' | 'fall' | 'corruption' | 'recovery' | 'flat';
  decisionLogic: string;
  lineWillNotCross: string;
  lineMayEventuallyCross: string;
  currentArcPhase: string;
};
```

写章时用它约束选择逻辑。审计时检查人物行为是否符合欲望、恐惧、缺陷、误信和当前弧线阶段。

### Relationship Edge

关系独立建模，因为长篇剧情大量来自关系变量变化。

```ts
type RelationshipEdge = {
  id: string;
  fromCharacterId: string;
  toCharacterId: string;
  visibleLabel: string;
  hiddenTruth: string | null;
  dependency: string | null;
  debt: string | null;
  misunderstanding: string | null;
  affection: string | null;
  harmPattern: string | null;
  sharedGoal: string | null;
  valueConflict: string | null;
  trustLevel: number;
  tensionLevel: number;
  currentState: string;
  plannedTurns: Array<{
    chapterRange: string;
    change: string;
  }>;
};
```

每章至少应有一个关系变量发生变化，除非章节卡明确标记为纯世界/战斗/解谜功能章。

### World Rule

世界规则必须带代价。

```ts
type WorldRule = {
  id: string;
  category: 'power' | 'society' | 'resource' | 'taboo' | 'law' | 'daily_life' | 'history';
  ruleText: string;
  cost: string;
  whoBenefits: string;
  whoSuffers: string;
  taboo: string | null;
  violationConsequence: string | null;
  allowedException: string | null;
  currentStatus: string;
};
```

审计时重点检查：

- 是否无代价使用能力、身份、资源或权力。
- 是否为了推进剧情临时打破已建立规则。
- 是否新增规则却没有登记。
- 是否把本应稀缺的资源写成随手可得。

### Narrative Thread

`plot_threads` 升级为统一叙事线程，覆盖主线、支线、关系线、谜团、主题、反派和世界线。

```ts
type NarrativeThread = {
  id: string;
  type: 'main' | 'subplot' | 'relationship' | 'mystery' | 'theme' | 'antagonist' | 'world';
  promise: string;
  plantedAt: number;
  expectedPayoff: number | null;
  resolvedAt: number | null;
  currentState: 'open' | 'advanced' | 'twisted' | 'paid_off' | 'abandoned';
  importance: 'critical' | 'normal' | 'minor';
  payoffMustChange: 'plot' | 'relationship' | 'world' | 'character' | 'theme';
  ownerCharacterId: string | null;
  relatedRelationshipId: string | null;
};
```

线程规则：

- critical 线程不能超过指定章节窗口不推进。
- 每章新增 minor 线程数量要限制，避免伏笔债务膨胀。
- 回收线程必须产生 `payoffMustChange` 指定的变化。
- abandoned 只能由 checkpoint 显式标记，不能被静默遗忘。

### Volume Plan

分卷计划负责管理长篇节奏，避免所有冲突都在单章层面漂移。

```ts
type VolumePlan = {
  volumeIndex: number;
  title: string;
  chapterStart: number;
  chapterEnd: number;
  roleInStory: string;
  mainPressure: string;
  promisedPayoff: string;
  characterArcMovement: string;
  relationshipMovement: string;
  worldExpansion: string;
  endingTurn: string;
};
```

### Chapter Card

章节卡是写章时的主要任务书。

```ts
type ChapterCard = {
  volumeIndex: number;
  chapterIndex: number;
  title: string;
  plotFunction: string;
  povCharacterId: string | null;
  externalConflict: string;
  internalConflict: string;
  relationshipChange: string;
  worldRuleUsedOrTested: string;
  informationReveal: string;
  readerReward: 'reversal' | 'breakthrough' | 'failure' | 'truth' | 'upgrade' | 'confession' | 'dread' | 'relief';
  endingHook: string;
  mustChange: string;
  forbiddenMoves: string[];
};
```

附属动作表：

```ts
type ChapterThreadAction = {
  chapterIndex: number;
  threadId: string;
  action: 'plant' | 'advance' | 'misdirect' | 'payoff';
  requiredEffect: string;
};

type ChapterCharacterPressure = {
  chapterIndex: number;
  characterId: string;
  desirePressure: string;
  fearPressure: string;
  flawTrigger: string;
  expectedChoice: string;
};

type ChapterRelationshipAction = {
  chapterIndex: number;
  relationshipId: string;
  action: 'strain' | 'repair' | 'betray' | 'reveal' | 'deepen' | 'reverse';
  requiredChange: string;
};
```

## 数据库设计

开发期允许直接改库，因此建议把初始 migration 改成新结构。若需要保留旧表名供 UI 兼容，可以短期保留 `chapters` 和 `book_context`，但叙事状态应以新表为主。

### Core Tables

```sql
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  idea TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  model_id TEXT NOT NULL,
  target_chapters INTEGER NOT NULL,
  words_per_chapter INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE story_bibles (
  book_id TEXT PRIMARY KEY,
  premise TEXT NOT NULL,
  genre_contract TEXT NOT NULL,
  target_reader_experience TEXT NOT NULL,
  theme_question TEXT NOT NULL,
  theme_answer_direction TEXT NOT NULL,
  central_dramatic_question TEXT NOT NULL,
  ending_state_json TEXT NOT NULL,
  voice_guide TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE character_arcs (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL,
  desire TEXT NOT NULL,
  fear TEXT NOT NULL,
  flaw TEXT NOT NULL,
  misbelief TEXT NOT NULL,
  wound TEXT,
  external_goal TEXT NOT NULL,
  internal_need TEXT NOT NULL,
  arc_direction TEXT NOT NULL,
  decision_logic TEXT NOT NULL,
  line_will_not_cross TEXT,
  line_may_eventually_cross TEXT,
  current_arc_phase TEXT NOT NULL,
  first_appear INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE relationship_edges (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  from_character_id TEXT NOT NULL,
  to_character_id TEXT NOT NULL,
  visible_label TEXT NOT NULL,
  hidden_truth TEXT,
  dependency TEXT,
  debt TEXT,
  misunderstanding TEXT,
  affection TEXT,
  harm_pattern TEXT,
  shared_goal TEXT,
  value_conflict TEXT,
  trust_level INTEGER NOT NULL DEFAULT 0,
  tension_level INTEGER NOT NULL DEFAULT 0,
  current_state TEXT NOT NULL,
  planned_turns_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (from_character_id) REFERENCES character_arcs(id),
  FOREIGN KEY (to_character_id) REFERENCES character_arcs(id)
);

CREATE TABLE world_rules (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  cost TEXT NOT NULL,
  who_benefits TEXT,
  who_suffers TEXT,
  taboo TEXT,
  violation_consequence TEXT,
  allowed_exception TEXT,
  current_status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE narrative_threads (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  type TEXT NOT NULL,
  promise TEXT NOT NULL,
  planted_at INTEGER NOT NULL,
  expected_payoff INTEGER,
  resolved_at INTEGER,
  current_state TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'normal',
  payoff_must_change TEXT NOT NULL,
  owner_character_id TEXT,
  related_relationship_id TEXT,
  notes TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (owner_character_id) REFERENCES character_arcs(id),
  FOREIGN KEY (related_relationship_id) REFERENCES relationship_edges(id)
);
```

### Planning Tables

```sql
CREATE TABLE volume_plans (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  chapter_start INTEGER NOT NULL,
  chapter_end INTEGER NOT NULL,
  role_in_story TEXT NOT NULL,
  main_pressure TEXT NOT NULL,
  promised_payoff TEXT NOT NULL,
  character_arc_movement TEXT NOT NULL,
  relationship_movement TEXT NOT NULL,
  world_expansion TEXT NOT NULL,
  ending_turn TEXT NOT NULL,
  PRIMARY KEY (book_id, volume_index),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE chapter_cards (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  plot_function TEXT NOT NULL,
  pov_character_id TEXT,
  external_conflict TEXT NOT NULL,
  internal_conflict TEXT NOT NULL,
  relationship_change TEXT NOT NULL,
  world_rule_used_or_tested TEXT NOT NULL,
  information_reveal TEXT NOT NULL,
  reader_reward TEXT NOT NULL,
  ending_hook TEXT NOT NULL,
  must_change TEXT NOT NULL,
  forbidden_moves_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'planned',
  revision INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, volume_index, chapter_index),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (pov_character_id) REFERENCES character_arcs(id)
);

CREATE TABLE chapter_thread_actions (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  thread_id TEXT NOT NULL,
  action TEXT NOT NULL,
  required_effect TEXT NOT NULL,
  PRIMARY KEY (book_id, volume_index, chapter_index, thread_id, action),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (thread_id) REFERENCES narrative_threads(id)
);

CREATE TABLE chapter_character_pressures (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  character_id TEXT NOT NULL,
  desire_pressure TEXT NOT NULL,
  fear_pressure TEXT NOT NULL,
  flaw_trigger TEXT NOT NULL,
  expected_choice TEXT NOT NULL,
  PRIMARY KEY (book_id, volume_index, chapter_index, character_id),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (character_id) REFERENCES character_arcs(id)
);

CREATE TABLE chapter_relationship_actions (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  relationship_id TEXT NOT NULL,
  action TEXT NOT NULL,
  required_change TEXT NOT NULL,
  PRIMARY KEY (book_id, volume_index, chapter_index, relationship_id, action),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (relationship_id) REFERENCES relationship_edges(id)
);
```

### Draft, Audit, and State Tables

```sql
CREATE TABLE chapters (
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  audit_score INTEGER,
  draft_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  PRIMARY KEY (book_id, volume_index, chapter_index),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE chapter_generation_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  attempt INTEGER NOT NULL,
  score INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  decision TEXT NOT NULL,
  issues_json TEXT NOT NULL,
  state_updates_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE character_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  location TEXT,
  status TEXT,
  knowledge TEXT,
  emotion TEXT,
  power_level TEXT,
  arc_phase TEXT,
  desire_state TEXT,
  fear_state TEXT,
  flaw_state TEXT,
  UNIQUE (book_id, character_id, volume_index, chapter_index),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (character_id) REFERENCES character_arcs(id)
);

CREATE TABLE relationship_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  relationship_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  trust_level INTEGER NOT NULL,
  tension_level INTEGER NOT NULL,
  current_state TEXT NOT NULL,
  last_change TEXT NOT NULL,
  UNIQUE (book_id, relationship_id, volume_index, chapter_index),
  FOREIGN KEY (book_id) REFERENCES books(id),
  FOREIGN KEY (relationship_id) REFERENCES relationship_edges(id)
);

CREATE TABLE scene_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  volume_index INTEGER NOT NULL,
  chapter_index INTEGER NOT NULL,
  location TEXT NOT NULL,
  time_in_story TEXT NOT NULL,
  characters_present TEXT NOT NULL,
  events TEXT,
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE narrative_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL,
  checkpoint_type TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  arc_report_json TEXT NOT NULL,
  thread_debt_json TEXT NOT NULL,
  pacing_report_json TEXT NOT NULL,
  replanning_notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id)
);
```

### Compatibility Decision

Because数据库可以直接改，推荐删除旧 `book_context`、`plot_threads`、`characters` 的旧语义，改用新表。为了降低 renderer 改动，可以在 service 层继续向旧 `BookDetail` 返回：

- `context.worldSetting`: 由 `story_bibles` + `world_rules` 渲染成可读文本。
- `context.outline`: 由 `volume_plans` + `chapter_cards` 渲染成可读文本。
- `plotThreads`: 从 `narrative_threads` 映射。
- `characterStates`: 从 `character_arcs` + 最新 `character_states` 映射。
- `chapters`: 从 `chapter_cards` + `chapters` 合并。

这样底层 schema 可以一次改干净，UI 可以分阶段升级。

## 生成流程

### 1. 生成故事圣经

输入：

- 用户 idea
- targetChapters
- wordsPerChapter

输出：

- `story_bibles`
- `character_arcs`
- `relationship_edges`
- `world_rules`
- 初始 `narrative_threads`

Prompt 要求：

- 输出严格 JSON。
- 所有人物必须有 desire、fear、flaw、misbelief、externalGoal、internalNeed、decisionLogic。
- 世界规则必须包含 cost。
- 至少生成一条 main thread、一条 theme thread、一条 antagonist 或 world thread。
- endingState 必须回答“赢什么、失去什么、世界如何变化、关系如何收束、主题答案是什么”。

校验：

- 主角必须存在。
- themeQuestion 和 themeAnswerDirection 不能为空。
- 每个重要人物必须有关联欲望、恐惧、缺陷。
- 每条世界规则必须有代价。
- relationship edge 引用的人物必须存在。
- thread 的 expectedPayoff 不能超过 targetChapters，除非为 null。

校验失败时，让模型修复 JSON，而不是继续生成章节。

### 2. 生成分卷计划

输入：

- story bible
- targetChapters
- wordsPerChapter

输出：

- `volume_plans`

规则：

- 所有卷的 chapter range 必须连续覆盖 1 到 targetChapters。
- 每卷必须有 `promisedPayoff` 和 `endingTurn`。
- 每卷至少推动一种人物弧线和一种关系变化。
- 最后一卷必须靠近 endingState，不允许新增大规模未承诺终局。

### 3. 生成章节卡

输入：

- story bible
- volume plans
- 已有 narrative threads

输出：

- `chapter_cards`
- `chapter_thread_actions`
- `chapter_character_pressures`
- `chapter_relationship_actions`

章节卡生成规则：

- 每章必须有 externalConflict 和 internalConflict。
- 每章必须有 `mustChange`。
- 每 1-3 章必须给一次 readerReward。
- 临近 expectedPayoff 的 critical thread 必须被推进或回收。
- 不允许连续 3 章没有主线推进。
- 不允许连续 3 章只新增不回收线程。
- 每卷结尾章必须完成 `volume_plans.promisedPayoff` 或制造明确反转。

### 4. 写章前构建叙事指挥台

写章 prompt 的上下文不再只是“前情摘要”，而是分区：

```text
Hard Continuity:
- 已发生事实、上一章结尾、角色位置、已知信息

Chapter Mission:
- chapter card 的 plotFunction、mustChange、readerReward、endingHook

Character Pressure:
- 本章涉及人物的欲望压力、恐惧压力、缺陷触发、预期选择

Relationship Delta:
- 本章必须改变的关系及变化方向

Thread Obligations:
- 本章必须 plant/advance/misdirect/payoff 的线程
- 临近回收窗口的线程

World Rule and Cost:
- 本章会触碰的世界规则
- 使用规则必须付出的代价

Theme Pressure:
- 本章人物选择如何靠近或反驳主题答案

Forbidden Moves:
- 本章不能提前揭露、不能无代价突破、不能改变的事实
```

预算优先级：

1. 当前章节卡和禁行项。
2. hard continuity。
3. 本章相关人物弧线。
4. 本章相关关系。
5. 临近 payoff 的 critical threads。
6. 本章世界规则和代价。
7. 最近 2 章摘要和上一章结尾。

上下文超限时，宁可删远期设定，也不能删本章任务和禁行项。

### 5. 写章

章节写作 prompt 必须包含硬约束：

- 返回正文，不解释。
- 必须完成 `mustChange`。
- 必须体现 externalConflict 和 internalConflict。
- 必须让 relationshipChange 或指定 relationship action 生效。
- 如果使用 world rule，必须体现 cost。
- 结尾必须留下 endingHook，但不能用空泛悬念代替真实推进。
- 不得提前完成 forbiddenMoves 里的终局、揭示或能力突破。

### 6. 章节审计

审计输入：

- 草稿正文
- story bible
- chapter card
- 本章相关人物、关系、线程、世界规则
- 最近章节摘要

审计输出：

```ts
type NarrativeAudit = {
  passed: boolean;
  score: number;
  decision: 'accept' | 'revise' | 'rewrite';
  issues: Array<{
    type:
      | 'character_logic'
      | 'relationship_static'
      | 'world_rule_violation'
      | 'mainline_stall'
      | 'thread_leak'
      | 'pacing_problem'
      | 'theme_drift'
      | 'chapter_too_empty'
      | 'forbidden_move'
      | 'missing_reader_reward';
    severity: 'blocker' | 'major' | 'minor';
    evidence: string;
    fixInstruction: string;
  }>;
  scoring: {
    characterLogic: number;
    mainlineProgress: number;
    relationshipChange: number;
    conflictDepth: number;
    worldRuleCost: number;
    threadManagement: number;
    pacingReward: number;
    themeAlignment: number;
  };
  stateUpdates: {
    characterArcUpdates: string[];
    relationshipUpdates: string[];
    threadUpdates: string[];
    worldKnowledgeUpdates: string[];
    themeUpdate: string;
  };
};
```

评分：

- 人物行动逻辑：20
- 主线推进：15
- 关系变化：15
- 冲突层级：15
- 世界规则与代价：10
- 伏笔和线程管理：10
- 节奏与读者满足：10
- 主题一致性：5

决策：

- `score >= 85` 且无 major/blocker：accept。
- `75 <= score < 85` 或存在 minor：accept，但保存审计问题。
- `60 <= score < 75` 或存在 major：revise。
- `score < 60` 或存在 blocker：rewrite。

blocker 示例：

- 主角做出完全违背既定欲望/恐惧/缺陷的选择，且文本没有足够压力铺垫。
- 世界规则被打破，但没有代价、例外或后果。
- 本章提前揭露 forbiddenMoves 中禁止揭露的真相。
- 本章完全没有完成 mustChange。

### 7. 修订和重写

修订 prompt：

- 保留可用正文。
- 针对 audit issues 增补冲突、代价、关系变化和信息揭露。
- 不改变章节卡方向。
- 不新增未经允许的大设定。

重写 prompt：

- 丢弃原草稿。
- 使用同一章节卡重新写。
- 明确指出上一稿失败原因。
- 限制新增人物、地点、线程。

最大尝试：

- 每章最多 2 次自动修订。
- 仍失败则保存为 `needs_review` 状态，暂停连续写作，避免错误污染后文。

### 8. 写后状态提取

通过审计后再提取并保存状态：

- chapter summary
- character states
- relationship states
- narrative thread updates
- scene record
- world rule changes 或新增世界知识
- theme progression note

状态提取必须以通过审计的最终文本为准。

### 9. 周期 checkpoint

每 10 章执行 `arc checkpoint`：

- 主角欲望是否仍清晰。
- 恐惧和缺陷是否仍在制造错误。
- 人物弧线是否有阶段变化。
- 关系是否长期静止。
- critical thread 是否超期未推进。
- readerReward 是否过密或过稀。

每 30-50 章执行 `volume replanning`：

- 对比已生成事实和后续 chapter cards。
- 保留 endingState 和 themeAnswerDirection。
- 重排未写 chapter cards。
- 标记 abandoned thread 时必须给出原因和替代 payoff。

每卷结束执行 `promise ledger review`：

- 本卷承诺了什么。
- 本卷兑现了什么。
- 哪些承诺延期。
- 下一卷读者期待是什么。

## Prompt Contract

所有结构化生成 prompt 都必须要求：

- Return valid JSON only.
- Do not wrap JSON in markdown fences.
- Use stable ids in kebab-case.
- If unsure, choose conservative continuity-preserving details.
- Do not create extra major characters unless requested by schema.
- Every rule, thread, and arc must be usable for future conflict.

实现层必须配套：

- `stripCodeFences`
- JSON parse fallback
- schema validator
- missing required fields repair prompt
- id normalization
- target chapter count normalization

## Repository and Service Changes

### Storage Repositories

新增或替换：

- `story-bibles.ts`
- `character-arcs.ts`
- `relationship-edges.ts`
- `world-rules.ts`
- `narrative-threads.ts`
- `volume-plans.ts`
- `chapter-cards.ts`
- `chapter-audits.ts`
- `relationship-states.ts`
- `narrative-checkpoints.ts`

保留但升级：

- `chapters.ts`: 正文、摘要、字数、审计分、尝试次数。
- `scene-records.ts`: 保留。
- `books.ts`: 保留核心书籍元信息。
- `progress.ts`: 增加审计、修订、checkpoint 阶段标签。

### Core Services

新增：

- `narrative-bible.ts`
  - 生成故事圣经。
  - 校验引用完整性。
  - 保存 bible、人物、关系、世界规则、初始线程。

- `chapter-card-planner.ts`
  - 生成分卷计划和章节卡。
  - 校验章节覆盖范围、线程动作、关系动作。

- `narrative-context.ts`
  - 构建写章前叙事指挥台。
  - 按预算裁剪上下文。

- `chapter-audit.ts`
  - 调用模型审计草稿。
  - 计算决策。
  - 保存审计记录。

- `chapter-revision.ts`
  - 根据 audit issues 修订或重写。

- `narrative-state.ts`
  - 提取并保存人物、关系、线程、世界和主题状态变化。

- `narrative-checkpoint.ts`
  - 周期复盘。
  - 必要时触发后续章节卡重规划。

改造：

- `prompt-builder.ts`
  - 拆出 story bible prompt、volume plan prompt、chapter card prompt、draft prompt、audit prompt、revision prompt。

- `book-service.ts`
  - `startBook` 从生成 outline 改为生成 bible、volumes、cards。
  - `writeNextChapter` 增加 audit -> revise/rewrite -> state extraction。

- `consistency.ts`
  - 升级为 narrative context builder，或保留旧 API 并委托新模块。

## Progress Phases

新增进度阶段：

- `building_bible`
- `validating_bible`
- `planning_volumes`
- `planning_chapter_cards`
- `writing`
- `auditing_chapter`
- `revising_chapter`
- `rewriting_chapter`
- `extracting_narrative_state`
- `checkpoint_review`
- `replanning_future_cards`
- `needs_review`

UI 可以先原样显示 stepLabel，不必一次性新增所有可视化。

## Error Handling

- JSON 解析失败：调用 repair prompt，最多 2 次。
- schema 引用不存在：自动要求模型修复 ids，不进入下一阶段。
- 章节卡不足：用 planner 补足到 targetChapters，而不是用空泛 fallback。
- 审计失败：按 revise/rewrite 策略处理。
- 连续三章进入 revise/rewrite：暂停并进入 checkpoint review。
- checkpoint 发现 critical thread 超期：优先重排未来 3-5 章卡片。

## Testing Strategy

### Unit Tests

- `narrative-bible` 校验：
  - 缺少主角时报错。
  - 世界规则缺少 cost 时不通过。
  - relationship edge 引用不存在人物时不通过。
  - thread payoff 超出 targetChapters 时不通过。

- `chapter-card-planner` 校验：
  - 章节范围必须连续覆盖目标章数。
  - 每张卡必须有 mustChange。
  - 连续 3 章没有 readerReward 时不通过。
  - critical thread 临近 payoff 未推进时给出警告。

- `narrative-context`：
  - 上下文超限时保留 chapter card、forbiddenMoves、hard continuity。
  - 删除低优先级远期设定。

- `chapter-audit`：
  - blocker 导致 rewrite。
  - major 导致 revise。
  - 高分无 major/blocker 导致 accept。

- `chapter-revision`：
  - 修订 prompt 包含 audit fixInstruction。
  - 重写 prompt 保留章节卡方向。

### Integration Tests

- 创建书籍后保存 story bible、人物弧线、关系、世界规则、线程、分卷、章节卡。
- 写下一章时调用 draft -> audit -> extraction -> save。
- 审计返回 rewrite 时不会保存第一版草稿。
- 通过审计后保存 relationship_states 和 narrative_threads 更新。
- checkpoint 到达第 10 章后生成 narrative_checkpoints。

### Mock Tests

mock 服务必须生成中文结构化故事圣经、章节卡和审计结果，避免开发模式仍停留在旧 outline 逻辑。

最低 mock 质量要求：

- 至少 1 名主角，2 名关键配角/对手。
- 至少 3 条世界规则，且都有代价。
- 至少 3 条叙事线程。
- 每章卡包含冲突、变化、读者奖励、结尾钩子。
- mock 章节能体现章节卡中的 mustChange。

## Implementation Order

1. 更新数据库 schema 和 repository。
2. 添加叙事类型定义和校验工具。
3. 改造 mock story services，先让测试和本地演示走通。
4. 实现 story bible 生成和保存。
5. 实现 volume plan 和 chapter card 生成。
6. 改造写章上下文和 prompt。
7. 增加 chapter audit。
8. 增加 revision/rewrite。
9. 增加 narrative state extraction。
10. 增加 checkpoint 和 future replanning。
11. 最后再升级 UI 展示故事圣经、关系变化、审计结果。

## Open Decisions

- 审计模型是否使用同一个写作模型，还是允许用户配置更便宜的审计模型。默认使用同一模型，后续再优化成本。
- `themeAnswerDirection` 是否允许中途改变。默认不允许自动改变，只能 checkpoint 提出建议。
- 每章最小 readerReward 密度是否可配置。默认每 1-3 章一次。
- 旧开发数据库是否需要迁移脚本。当前设计按“可以直接改掉”处理，不保留旧数据迁移。

## Acceptance Criteria

- 新书生成后，数据库中存在 story bible、人物弧线、关系边、世界规则、叙事线程、分卷计划和完整章节卡。
- 任意章节写作前的 prompt 能明确看到本章任务、人物压力、关系变化、线程义务、世界代价和禁行项。
- 审计分低或存在 blocker 时，章节不会直接保存为正式正文。
- 写后状态会更新人物、关系、线程、场景和主题推进。
- 连续写作不会只依赖最近摘要，而是持续引用结构化叙事状态。
- 测试覆盖 schema 校验、章节卡校验、上下文裁剪、审计决策和写章主流程。

## Spec Self-Review

- Placeholder scan: no unfinished placeholder markers remain.
- Internal consistency: architecture, schema, service changes, and flow all follow the same bible -> cards -> draft -> audit -> state loop.
- Scope check: this is a large but single coherent backend generation redesign; UI visualization is explicitly deferred.
- Ambiguity check: database compatibility is resolved by direct schema replacement with service-level renderer mapping for phased UI migration.
