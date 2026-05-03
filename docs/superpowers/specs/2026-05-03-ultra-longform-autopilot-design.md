# Story Weaver 超长篇自动驾驶生成设计

## 背景

Story Weaver 当前已经具备多书本双循环自动生成的基础方向：系统能够围绕书本对象生成标题、世界观、总纲、阶段计划、章节计划，并在逐章写作后回写人物状态、线程状态和故事快照。

这条链路已经能支撑“自动写下去”，但对于 `500 - 2000` 章规模的超长篇小说，还缺少一层更强的运行控制。超长篇真正难的地方不是单章能不能写出来，而是系统能不能在多书并发、长期无人值守的前提下，持续守住以下底线：

- 主线不会在长周期运行中被支线和日常情节稀释掉。
- 关键人物的性格、欲望和行动逻辑不会为了局部剧情方便而跑偏。
- 节奏不会长期失真，出现连续几十章只铺不收、只推不变、只热闹不兑现的问题。
- 某一本书偏航时，系统能自动分级处理，而不是把错误持续滚入后续 100 章。
- 多本书同时运行时，调度器不会被某一本高风险书拖垮，仍能保持整体产量与公平性。

本设计不是再造一个“更会写提示词的章节生成器”，而是把 Story Weaver 升级为 `超长篇自动运行系统`。系统的第一目标不是单章最精细，而是 `多书并发、全自动优先、主线硬约束、偏航可恢复`。

本设计建立在现有双循环设计之上，可以视为对 `docs/superpowers/specs/2026-05-03-multi-book-dual-loop-generation-design.md` 的进一步收紧与落地：前者解决“多书本 + 双循环”，本设计解决“在这个架构下怎样真正跑稳 500 - 2000 章”。

## 目标

- 支持多本超长篇小说并发自动生成，并把每本书视为独立运行单元。
- 把 `主线不丢失` 从 prompt 目标升级为结构化约束、运行评分和停机规则。
- 建立 `规划层 + 账本层 + 审计层 + 检查点层` 的闭环，减少对模型短期记忆的依赖。
- 让系统在无人值守场景下仍能自动分辨 `继续写 / 轻修补 / 近程重规划 / 深度重规划`。
- 用 `2 - 3` 套题材模板提供不同节奏规则和审计规则，但保持底层引擎统一。
- 优先保证整体稳产能力、可恢复能力和多书公平调度，而不是把资源过度消耗在单章微调上。

## 非目标

- 不在本轮设计里实现多代理协同写作平台。
- 不在本轮设计里实现高度可视化的世界图谱、势力地图编辑器或关系图工作台。
- 不追求对所有小说类型一套通吃；本轮只优化 `2 - 3` 个高频长篇模板。
- 不要求模型一次生成即完美成章；系统仍然依靠审计、修补和检查点恢复工作。
- 不把所有文学理论硬编码成评分器；只硬控会导致超长篇持续偏航的关键变量。

## 设计原则

1. 一本书必须是独立运行单元。
   多书并发不是把任务堆进一个全局队列，而是同时维护多个彼此隔离、可单独暂停和恢复的书本状态机。

2. 主线必须是硬约束，不是软提醒。
   题眼、卖点、主线承诺、主角核心欲望和关键人物边界必须结构化保存，并参与每次规划和每次审计。

3. 计划负责方向，账本负责连续性。
   远中近分层规划告诉系统“未来要去哪里”，结构化账本告诉系统“现在已经走到哪里”。两者缺一不可。

4. 写作不能直接污染主时间线。
   章节初稿只有在通过审计并完成必要修补后，才可以进入正式故事状态。

5. 偏航必须分级处理。
   小偏移自动拉回，中偏移先重做近程计划，大偏移回退到检查点并从中层计划重启。

6. 系统优先保证长期稳产。
   第一版的成功标准不是偶尔写出神章节，而是在多书并发和长期运行下仍然可预测、可恢复、可持续出章。

7. 模板差异只作用于规则层。
   不为每个题材复制一套引擎；不同题材只提供不同的计划 rubric、节奏规则和审计标准。

## 当前链路缺口

现有实现已经具备一批重要基础：

- `books` 提供书本级元数据。
- `plot_threads` 已能追踪伏笔开启与回收。
- `story_state_snapshots` 已能保存章节后的综合故事快照。
- `character_states` 已能记录人物章节级状态变化。
- `writing_progress` 已能表示当前运行阶段。
- `chapter_plans`、`arc_plans`、`stage_plans`、`endgame_plans` 已经开始形成分层规划雏形。

但要支撑超长篇自动驾驶，当前结构仍有四个关键不足：

1. 现有状态更偏“结果归档”，不够像“运行账本”。
   例如 `story_state_snapshots` 存的是章节后的总结性数据，但后续决策真正需要的是稳定字段：主线推进度、活跃支线、未回收承诺、人物真相、节奏位置、风险标记。

2. 关键人物的一致性约束还不够强。
   现有 `character_states` 更擅长记录位置、状态、知识、情绪，却还缺少人物不会轻易改变的深层行动逻辑，例如核心欲望、底线、可跨越与不可跨越的界线。

3. 调度层仍偏“当前要做什么”，不够像“下一步最值得做什么”。
   `writing_progress` 能表示 phase，但多书并发时调度器还需要健康度、偏航等级、冷却时间、资源优先级和饥饿补偿。

4. 审计结果还没有成为强动作触发器。
   当前链路能够做章节后检查，但还没有把审计结果系统化为 `轻偏移 / 中偏移 / 重偏移` 三档，并与修补、重写、重规划和回退严格绑定。

## 总体架构

整体模型建议以 `Book Cell` 为核心。每本书都是一个独立的自动运行单元，内部固定包含五层：

1. `Idea Contract`
   冻结这本书最不能丢的部分：题眼、卖点、主线承诺、主角核心欲望、关键人物边界、必须兑现的重要承诺。

2. `Planning Loop`
   负责四层滚动规划：终局层、阶段层、中段层、近章层。它决定未来方向，但不直接产出正文。

3. `Writing Loop`
   负责逐章产出正文初稿、提取结构事件、执行审计、按需修补，并在通过后提交章节。

4. `State Ledger`
   负责把故事的当前真实局面以结构化方式持续回写，而不是依赖模型记忆或长上下文拼接。

5. `Correction Gate`
   负责根据完整性审计报告执行分级纠偏，决定下一步是继续运行、补计划、重规划，还是从检查点恢复。

目标流水线如下：

```text
book created
  -> build idea contract
  -> generate endgame plan
  -> generate stage plan
  -> generate arc plan
  -> generate chapter window plan
  -> write chapter draft
  -> extract structured events
  -> audit integrity
  -> patch or rewrite if needed
  -> commit chapter to timeline
  -> update ledger and checkpoint
  -> trigger continue / replan / recover
```

## Book Cell 模型

每本书不是一组松散表记录，而是一个独立运行体：

```ts
type BookCell = {
  bookId: string;
  contractId: string;
  activeTemplate: 'progression' | 'romance_growth' | 'mystery_serial';
  runState: RunState;
  currentPlanStack: PlanStack;
  currentLedger: StoryLedger;
  latestCheckpoint: CheckpointRef | null;
};
```

Book Cell 的价值在于：

- 支持多本书彼此隔离运行。
- 一本书可以单独暂停、修复、恢复，不影响其他书。
- 调度器可以对每本书做独立评分，而不是把全局任务视为同质工作。
- 后续无论接 OpenAI、Anthropic 或自定义模型，运行协议保持一致。

## 核心数据模型

### Book Contract

Book Contract 是全书最高层约束。它不是普通世界观文本，而是系统长期执行时必须反复核对的故事合同。

```ts
type BookContract = {
  bookId: string;
  titlePromise: string;
  corePremise: string;
  mainlinePromise: string;
  protagonistCoreDesire: string;
  protagonistNoDriftRules: string[];
  keyCharacterBoundaries: Array<{
    characterId: string;
    publicPersona: string;
    hiddenDrive: string;
    lineWillNotCross: string;
    lineMayEventuallyCross: string;
  }>;
  mandatoryPayoffs: string[];
  antiDriftRules: string[];
};
```

写作、规划和审计都要回看它，确保系统没有逐渐忘掉这本书一开始 promised 的东西。

### Plan Stack

Plan Stack 是四层滚动规划栈。它不是静态大纲，而是会随着写作推进不断展开和重算的执行框架。

```ts
type PlanStack = {
  endgamePlan: EndgamePlan;
  activeStagePlan: StagePlan;
  activeArcPlan: ArcPlan;
  activeChapterWindowPlan: ChapterWindowPlan;
};
```

其中各层建议至少包含：

```ts
type EndgamePlan = {
  finalState: string;
  finalConflict: string;
  protagonistOutcome: string;
  mandatoryClosures: string[];
  contractResponse: string;
};

type StagePlan = {
  chapterRange: { start: number; end: number };
  stageGoal: string;
  primaryResistance: string;
  irreversibleShift: string;
  promisedPayoff: string;
  suspenseCarryover: string;
  titleIdeaAlignment: string;
  pressureCurve: string;
  latestAllowedCompletionChapter: number;
};

type ArcPlan = {
  chapterRange: { start: number; end: number };
  mainlineTargets: string[];
  subplotTargets: string[];
  characterMovements: string[];
  requiredPayoffs: string[];
  turningPoint: string;
  endingInstability: string;
  rhythmPattern: string;
  adaptiveRange: { minEnd: number; maxEnd: number };
};

type ChapterWindowPlan = {
  chapterRange: { start: number; end: number };
  chapterGoals: Array<{
    chapterIndex: number;
    function: 'setup' | 'escalation' | 'payoff' | 'twist' | 'cost';
    mainlineTask: string;
    requiredChange: string;
    activeCharacters: string[];
    threadDuty: string[];
    endingHook: string;
  }>;
  fallbackRecoveryHooks: string[];
};
```

### Story Ledger

Story Ledger 是主线不丢的关键总账。它和 snapshot 最大的区别是：字段要稳定、可比较、可被调度器和审计器直接消费。

```ts
type StoryLedger = {
  bookId: string;
  chapterIndex: number;
  mainlineProgress: string;
  activeSubplots: Array<{
    threadId: string;
    state: 'active' | 'stalled' | 'due_for_payoff' | 'cooling';
    chapterDebt: number;
  }>;
  openPromises: Array<{
    id: string;
    promise: string;
    introducedAt: number;
    dueBy: number | null;
    severity: 'critical' | 'normal' | 'minor';
  }>;
  characterTruths: Array<{
    characterId: string;
    currentDesire: string;
    currentFear: string;
    currentMask: string;
    stabilityRisk: 'low' | 'medium' | 'high';
  }>;
  relationshipDeltas: Array<{
    edgeId: string;
    currentState: string;
    trustLevel: number;
    tensionLevel: number;
  }>;
  worldFacts: Array<{
    fact: string;
    status: 'stable' | 'fragile' | 'changed';
  }>;
  rhythmPosition: 'setup' | 'escalation' | 'payoff' | 'twist' | 'cost';
  riskFlags: string[];
};
```

系统不需要每次读完整章回忆故事，只需要从 ledger 读出“当前主时间线真实状态”。

### Event Log

Event Log 记录每章真正发生了什么，并作为后续审计、复盘和重规划的事实源。

```ts
type StoryEvent = {
  bookId: string;
  chapterIndex: number;
  eventType:
    | 'mainline_advance'
    | 'subplot_shift'
    | 'promise_opened'
    | 'promise_paid'
    | 'character_turn'
    | 'relationship_turn'
    | 'world_change'
    | 'cost_paid';
  summary: string;
  affectedIds: string[];
  irreversible: boolean;
};
```

重规划时优先读取事件链，而不是全文扫描正文。

### Checkpoint

Checkpoint 用于在大偏航时恢复稳定状态。

```ts
type Checkpoint = {
  bookId: string;
  chapterIndex: number;
  checkpointType: 'light' | 'heavy';
  contractDigest: string;
  planDigest: string;
  ledgerDigest: StoryLedger;
  createdAt: string;
};
```

建议：

- 每 `10` 章生成一次 `light checkpoint`
- 每 `50` 章生成一次 `heavy checkpoint`
- 重偏移优先回退到最近 `heavy checkpoint`

### Run State

Run State 用于驱动多书并发调度。

```ts
type RunState = {
  bookId: string;
  phase:
    | 'bootstrapping'
    | 'planning_ready'
    | 'chapter_window_ready'
    | 'writing'
    | 'auditing'
    | 'patching'
    | 'replanning'
    | 'blocked'
    | 'cooldown'
    | 'completed';
  currentChapter: number | null;
  driftLevel: 'none' | 'light' | 'medium' | 'heavy';
  lastHealthyCheckpointChapter: number | null;
  latestFailureReason: string | null;
  cooldownUntil: string | null;
  starvationScore: number;
};
```

## 状态机设计

每本书都运行在明确状态机上，而不是仅用一个“生成中”状态。

1. `bootstrapping`
   创建 Book Contract、终局计划和初始阶段计划。

2. `planning_ready`
   远中期计划已经具备，等待生成近章窗口。

3. `chapter_window_ready`
   当前 `5 - 15` 章窗口已展开，允许进入写章。

4. `writing`
   生成当前章节草稿。

5. `auditing`
   从正文抽取事件并执行完整性检查。

6. `patching`
   轻偏移下执行低成本修补。

7. `replanning`
   中偏移或重偏移下重做近章或中段计划。

8. `blocked`
   连续失败、数据冲突或模型质量异常时暂停。

9. `cooldown`
   高成本操作后让出调度优先级。

10. `completed`
   达成目标章节并完成终局回收。

这组状态让调度器不仅知道“哪本书有活”，还知道“哪本书该优先拿什么类型的资源”。

## 多书调度策略

在 `全自动优先 + 多书并发` 模式下，不能使用简单 round-robin。建议每轮为每本书计算 `run score`：

```ts
type RunScore = {
  urgency: number;
  health: number;
  driftRisk: number;
  noveltyBalance: number;
  cooldownPenalty: number;
  starvationBoost: number;
  total: number;
};
```

评分因子建议如下：

- `urgency`
  近章计划快耗尽、需要续计划或长期未推进的书优先。

- `health`
  最近连续通过审计、失败少的书更适合继续稳产。

- `driftRisk`
  风险高的书降低写章优先级，转而优先进入修补或重规划。

- `noveltyBalance`
  防止系统过度倾斜到单一本势头最好的书。

- `cooldownPenalty`
  刚经历大修补或重规划的书短时间降权。

- `starvationBoost`
  长时间没获得运行机会的书自动加权，避免饿死。

建议拆成三个队列：

1. `write queue`
   只放健康且已有近章计划的书，以稳定出章为目标。

2. `repair queue`
   放轻偏移和中偏移书，优先修补或重做近章窗口。

3. `deep-replan queue`
   放重偏移书，只做检查点恢复和中层重规划，不直接写章。

这样即使某一本书持续高风险，也不会拖垮所有书的产量。

## 模板化题材支持

本轮只支持 `2 - 3` 个模板，但底层引擎统一。模板只提供规则，不改变 Book Cell、Plan Stack 和 Ledger 结构。

建议首批模板：

1. `progression`
   面向升级流 / 成长流长篇。
   重点规则：阶段目标清晰、爽点兑现频率稳定、支线不能长期挤占主线、实力与代价必须同步变化。

2. `romance_growth`
   面向关系递进 / 情感成长长篇。
   重点规则：关系变化密度、情绪转折、误解与回收节奏、角色动机一致性优先。

3. `mystery_serial`
   面向悬疑 / 线索型连载长篇。
   重点规则：线索账本、信息暴露顺序、嫌疑转移、误导与真相回收比例。

模板输出内容建议包括：

- 计划层 rubric
- 节奏函数定义
- 支线最大并发数
- 承诺最晚兑现密度
- 常见跑偏信号
- 审计层阈值偏置

## 主线完整性控制

`主线不丢失` 必须变成结构化审计，而不是一句 prompt 祝愿。建议每章写完后都执行 `Story Integrity Check`。

### Integrity Report

```ts
type IntegrityReport = {
  mainlineAlignmentScore: number;
  characterStabilityScore: number;
  subplotControlScore: number;
  payoffProgressScore: number;
  rhythmFitScore: number;
  driftLevel: 'none' | 'light' | 'medium' | 'heavy';
  repairAction:
    | 'continue'
    | 'patch_current_draft'
    | 'rewrite_current_chapter'
    | 'rebuild_chapter_window'
    | 'rollback_to_checkpoint';
  findings: string[];
};
```

### 审计维度

每章至少检查以下五项：

1. `主线对齐`
   本章是否服务当前主线目标，而不是只制造热闹。

2. `人物边界`
   关键角色的行为、语气、动机是否跨越了既定边界。

3. `支线健康`
   支线是否合理推进，还是开始反向吞噬主线篇幅。

4. `承诺兑现节奏`
   是否长期只铺不收，或对关键承诺推进不足。

5. `节奏位置`
   当前章在近章窗口中应承担的节奏角色是否命中。

### 偏移等级定义

#### 轻偏移

特征：

- 本章仍服务主线，但推进较弱。
- 角色语气略飘，但核心动机未变。
- 某条支线有膨胀迹象，但还未抢走主线中心。
- 连续 `1 - 2` 章没有兑现，但仍在为同一承诺铺垫。

动作：

- 不停机。
- 对当前章执行低成本修补。
- 在下一章强制追加主线回钩任务。

#### 中偏移

特征：

- 本章和当前近章目标明显脱节。
- 关键角色开始做出不符合既定行动逻辑的决策。
- 支线占比明显过高。
- 近 `5 - 10` 章承诺积压过多，实质回收不足。
- 节奏连续错位，例如应拉升却长期平铺。

动作：

- 停止直接写下一章。
- 重做 `chapter_window_plan`。
- 回看最近章节的 event log 和 ledger，再生成未来修正路径。

#### 重偏移

特征：

- 主线目标被替换、遗忘或逻辑断裂。
- 主角核心欲望发生非计划性变形。
- 关键关系或世界事实产生明显矛盾。
- 支线形成新的事实中心，主线失去牵引。
- 连续多章审计失败，轻修补和近章重规划都无效。

动作：

- 暂停该书。
- 回退到最近 `heavy checkpoint`。
- 从 `arc plan` 或 `stage plan` 层重规划。
- 重建近章窗口后再恢复运行。

## 最小上下文组装

超长篇不能依赖“把更多历史塞给模型”。写章时必须只注入 `最小必要上下文`：

1. `Book Contract 摘要`
   题眼、卖点、主角核心欲望、禁跑偏边界。

2. `当前计划锚点`
   当前 stage / arc / chapter window 的目标、阻力、兑现点、转折点。

3. `主线账本`
   当前主线推进到哪一步，下一步必须完成什么。

4. `角色活跃集`
   仅注入本章相关的 `3 - 8` 个关键角色状态。

5. `未回收事项`
   当前必须处理的伏笔、支线和承诺，不超过固定上限。

6. `最近事实带`
   最近 `1 - 3` 章的事件摘要，而不是正文全文。

这样模型看到的是当前操作台，而不是整本书回放。

## 章节生产流水线

单章不能只做 `生成 -> 保存`。建议固定走以下八步：

1. `Pick`
   调度器选择一本当前最值得运行的书，并确认它已经拥有可执行的近章计划。

2. `Assemble`
   组装最小上下文，明确本章目标、必需变化、涉及角色、线程义务和节奏角色。

3. `Draft`
   生成章节初稿。prompt 必须明确规定本章必须完成的推进和禁止破坏的边界。

4. `Extract`
   从初稿反抽结构化事件、角色变化、线程变化、承诺变化和节奏落点。

5. `Audit`
   运行完整性检查，得到结构化 `IntegrityReport`。

6. `Patch`
   轻偏移执行低成本修补；中偏移整章重写；重偏移停止当前章并回到计划层。

7. `Commit`
   审计通过后再正式入库：保存正文、写 event log、更新 ledger、保存 checkpoint、更新 run state。

8. `Trigger`
   判断是否继续写下一章，或转入补计划、重规划、恢复流程。

这一闭环的关键是：正文初稿在通过审计前不算进入主时间线。

## 成本控制策略

本设计强调 `全自动优先`，因此必须防止单书和单章过度消耗资源。建议第一版使用克制策略：

- 每章默认只允许 `1` 次初稿和 `1` 次轻修补。
- 中偏移才允许整章重写，且整章重写次数必须有限。
- 重规划只在达到明确阈值时触发，不能频繁发生。
- Event log 和 ledger 以短结构化字段为主，避免每章写长篇总结。
- 只有到重检查点时才生成较完整的阶段复盘。
- 多书并发时优先保障总体吞吐，不为了单书精修长期阻塞其他书。

## 失败恢复与可观测性

为了让系统适合长期无人值守运行，至少需要以下可恢复和可观测能力：

- 记录每本书最近一次失败原因和失败阶段。
- 明确区分模型失败、解析失败、审计失败和规划失败。
- 保留最近通过的 `light checkpoint` 与 `heavy checkpoint`。
- 能够在 UI 上直接看到一本书当前处于 `写作 / 审计 / 修补 / 重规划 / 阻塞` 哪一类状态。
- 能够查看一本书最近几次偏航原因，避免同类问题反复发生。

## 测试策略

本设计的验证重点不是文学主观优劣，而是运行控制是否稳定。建议测试分四层：

1. `模型无关单元测试`
   校验 Book Contract、Plan Stack、Ledger、IntegrityReport、Run State 的 schema、转换和阈值逻辑。

2. `章节流水线测试`
   用 mock draft / mock audit 结果验证 `Draft -> Extract -> Audit -> Patch -> Commit` 的状态迁移。

3. `多书调度测试`
   构造健康书、高风险书、饥饿书和冷却书，验证 run score 和队列转移是否符合预期。

4. `长周期回放测试`
   用 mock 模型跑数十到上百章缩略模拟，验证线程债务、偏航处理、检查点恢复和计划续写是否稳定。

## 风险与折中

1. 规则过重会压制创造性。
   需要控制审计维度数量，避免系统把长篇写作收窄成机械执行。

2. 审计过频会损失吞吐。
   第一版应优先做短结构化审计，而不是每章执行昂贵的深评估。

3. 模板化不足会让通用引擎失焦。
   因此本轮只支持 `2 - 3` 个明确模板，不追求全题材泛化。

4. 检查点过稀会提高恢复成本，过密会增加存储和计算成本。
   `10` 章轻检查点、`50` 章重检查点是建议起点，后续可按真实运行数据调整。

## 实施建议

建议按以下顺序落地：

1. 先把 `Book Contract`、`Story Ledger`、`IntegrityReport`、`Run State` 这些运行核心对象建立起来。
2. 再重构章节流水线，让 `Audit` 和 `Patch` 真正成为 `Commit` 前置条件。
3. 接着把多书调度从简单 phase 驱动升级为带健康度和偏航等级的运行评分。
4. 最后再叠加题材模板，让规则差异作用在规划和审计层，而不是破坏统一引擎。

## 结论

要让 AI 自动完成 `500 - 2000` 章规模的小说，关键不是让模型“记得更多”，而是让系统更像一个长期运行控制器：

- 用 `Book Contract` 守住主线和人物边界。
- 用 `Plan Stack` 保持远中近滚动规划。
- 用 `Story Ledger + Event Log` 记住已经发生的事实。
- 用 `Integrity Check + Drift Levels` 识别跑偏并自动分级纠偏。
- 用 `Checkpoint + Run State + Scheduler` 支撑多书并发、长期稳产和故障恢复。

这套设计的核心价值不在单章修辞，而在于把“长篇不会慢慢写丢”这件事真正做成系统能力。
