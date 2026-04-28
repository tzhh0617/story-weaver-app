# Story Weaver Automatic Mock Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Story Weaver automatically switch to a Chinese web-novel style mock pipeline when no complete model config exists, while preserving strict real-model execution and error reporting once a complete config is available.

**Architecture:** Split the work into two layers. First, create a structured in-repo Chinese web-novel style pack plus dedicated mock story services so mock output looks like a plausible serialized novel instead of placeholder text. Second, centralize runtime mode selection so `electron/runtime.ts` chooses mock services only when there are no complete model configs and never falls back silently after real-mode failures.

**Tech Stack:** TypeScript, Electron runtime services, Vitest, Vercel AI SDK

---

## File Map

- Create: `src/mock/chinese-web-novel-pack.ts`
  Purpose: Store the built-in structured Chinese web-novel style data pack, including genre presets, role templates, scene templates, chapter beat templates, and hook phrases.
- Create: `src/mock/story-services.ts`
  Purpose: Hold the formal mock outline, chapter, summary, plot-thread, character-state, and scene-record services that consume the style pack.
- Create: `src/models/runtime-mode.ts`
  Purpose: Merge persisted and environment configs, decide `mock` vs `real` mode, expose filtered complete configs, and resolve the active model id.
- Modify: `electron/runtime.ts`
  Purpose: Remove inline fallback logic, wire in the formal mock story services, and route all six AI capabilities through a single runtime mode decision.
- Modify: `src/core/development-outline.ts`
  Purpose: Either re-export or defer to the new mock outline service so existing imports keep working without duplicate content logic.
- Create: `tests/mock/story-services.test.ts`
  Purpose: Lock down Chinese output, web-novel style cues, and internal consistency across mock outline, chapter, summary, and extraction results.
- Create: `tests/models/runtime-mode.test.ts`
  Purpose: Verify the complete-vs-incomplete model-config routing rules.
- Create: `tests/electron/runtime-mock-fallback.test.ts`
  Purpose: Verify runtime behavior in mock mode and strict failure behavior in real mode.

### Task 1: Add failing tests for the Chinese web-novel mock services

**Files:**
- Create: `tests/mock/story-services.test.ts`
- Test: `tests/mock/story-services.test.ts`

- [ ] **Step 1: Write the failing outline test**

```ts
import { describe, expect, it } from 'vitest';
import { createMockOutlineService } from '../../src/mock/story-services';

describe('mock story services', () => {
  it('builds a Chinese outline bundle with serialized web-novel structure', async () => {
    const service = createMockOutlineService();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetWords: 500000,
    });

    expect(result.worldSetting).toMatch(/[一-龥]/);
    expect(result.masterOutline).toContain('主线');
    expect(result.volumeOutlines[0]).toContain('卷');
    expect(result.chapterOutlines[0].title).toMatch(/[一-龥]/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mock/story-services.test.ts`

Expected: FAIL with an import error similar to `Cannot find module '../../src/mock/story-services'`

- [ ] **Step 3: Extend the same file with the chapter and summary quality checks**

```ts
it('writes a Chinese chapter with conflict, progression, and a hook ending', async () => {
  const writer = createMockChapterWriter();

  const result = await writer.writeChapter({
      modelId: 'mock:fallback',
    prompt: [
      'Book idea: 一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      'Chapter title: 逐出山门',
      'Chapter outline: 主角在众目睽睽之下被废去外门名籍，却在祖祠废井中得到古镜回应。',
    ].join('\n'),
  });

  expect(result.content).toMatch(/[一-龥]/);
  expect(result.content.length).toBeGreaterThan(120);
  expect(result.content).toContain('逐出山门');
  expect(result.content).toMatch(/然而|就在这时|可偏偏/);
});

it('summarizes the chapter in Chinese without returning placeholder copy', async () => {
  const generator = createMockSummaryGenerator();
  const summary = await generator.summarizeChapter({
      modelId: 'mock:fallback',
    content:
      '陆照被执法长老当众逐出山门，跌入祖祠废井后得到古镜回应，并发现当年师尊之死另有隐情。',
  });

  expect(summary).toMatch(/[一-龥]/);
  expect(summary).not.toContain('development-mode');
});
```

- [ ] **Step 4: Add the structured extraction regression case**

```ts
it('extracts scene, character, and thread data that matches the generated chapter', async () => {
  const chapterContent = [
    '陆照被逐出山门后，在祖祠废井中听见古镜低鸣。',
    '他意识到师尊留下的遗物并未毁去，反而指向了宗门长老共同掩埋的旧案。',
  ].join('');

  const states = await createMockCharacterStateExtractor().extractStates({
    modelId: 'mock:fallback',
    chapterIndex: 1,
    content: chapterContent,
  });
  const scene = await createMockSceneRecordExtractor().extractScene({
    modelId: 'mock:fallback',
    chapterIndex: 1,
    content: chapterContent,
  });
  const threads = await createMockPlotThreadExtractor().extractThreads({
    modelId: 'mock:fallback',
    chapterIndex: 1,
    content: chapterContent,
  });

  expect(states[0]?.characterName).toBeTruthy();
  expect(scene?.location).toMatch(/[一-龥]/);
  expect(threads.openedThreads.length).toBeGreaterThan(0);
});
```

- [ ] **Step 5: Commit the test-first checkpoint**

```bash
git add tests/mock/story-services.test.ts
git commit -m "test: define chinese mock story service expectations"
```

### Task 2: Implement the style pack and mock story services

**Files:**
- Create: `src/mock/chinese-web-novel-pack.ts`
- Create: `src/mock/story-services.ts`
- Modify: `src/core/development-outline.ts`
- Test: `tests/mock/story-services.test.ts`

- [ ] **Step 1: Add the structured Chinese web-novel style pack**

```ts
export const chineseWebNovelPack = {
  genres: [
    {
      id: 'xianxia-revenge',
      keywords: ['宗门', '古镜', '因果', '师尊', '逐出'],
      tone: '压抑开局，随后快速升级与反转',
      protagonistSurname: ['陆', '沈', '顾', '秦'],
      protagonistGiven: ['照', '玄', '临', '渊'],
      factions: ['太衡宗', '北辰殿', '执律堂', '藏锋峰'],
      locations: ['祖祠废井', '问罪台', '藏经阁', '外门石阶'],
      hookPhrases: ['然而真正的代价，此刻才刚刚开始。', '可他不知道，这只是第一道杀局。'],
    },
    {
      id: 'urban-ability',
      keywords: ['公司', '异能', '债务', '夜市', '调查'],
      tone: '都市压迫感与爽点并行',
      protagonistSurname: ['林', '周', '许', '陈'],
      protagonistGiven: ['墨', '野', '川', '澈'],
      factions: ['债务审理局', '雾港财团', '夜巡队', '黑市中介'],
      locations: ['旧城夜市', '高架桥下', '封账大厅', '地下档案库'],
      hookPhrases: ['而那份旧账，终于找上了门。', '只是这一次，被盯上的不止他一个。'],
    },
  ],
  chapterBeats: [
    '开场压迫',
    '信息揭示',
    '冲突升级',
    '代价落地',
    '悬念收束',
  ],
} as const;
```

- [ ] **Step 2: Implement the mock outline service with deterministic genre selection**

```ts
export function createMockOutlineService() {
  return {
    async generateFromIdea(input: {
      bookId: string;
      idea: string;
      targetWords: number;
    }) {
      const genre = pickGenre(input.idea);
      const protagonist = pickProtagonistName(genre);

      return {
        worldSetting: [
          `题材基调：${genre.tone}`,
          `故事核心：${input.idea}`,
          `主角锚点：${protagonist}被卷入一场牵连宗门与旧案的因果争夺。`,
          `世界规则：力量越强，付出的代价越接近主角最不愿失去之物。`,
        ].join('\n'),
        masterOutline: [
          `目标字数：${input.targetWords}`,
          '主线：主角在被压制的处境中不断追索真相、积蓄实力、反转秩序。',
          '分卷方向：开局受辱、追查旧案、势力碰撞、真相反噬、重立规则。',
        ].join('\n'),
        volumeOutlines: [
          `第一卷：山门尽头`,
          `第二卷：旧案浮灯`,
        ],
        chapterOutlines: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: '逐出山门',
            outline: `${protagonist}在公开审判中失去身份，却在最低谷接触到改变命运的禁物。`,
          },
          {
            volumeIndex: 1,
            chapterIndex: 2,
            title: '古镜低鸣',
            outline: `${protagonist}第一次验证禁物力量，同时发现师门旧案有人故意掩埋。`,
          },
        ],
      };
    },
  };
}
```

- [ ] **Step 3: Implement the chapter, summary, and extraction mock services**

```ts
export function createMockChapterWriter() {
  return {
    async writeChapter(input: { modelId: string; prompt: string }) {
      const chapterTitle = readPromptField(input.prompt, 'Chapter title') ?? '无名一章';
      const chapterOutline = readPromptField(input.prompt, 'Chapter outline') ?? '主角被迫踏入新的风暴。';

      const content = [
        `${chapterTitle}`,
        '',
        `夜色压在檐角，风从石阶尽头卷来，像是有人在无声催促。${chapterOutline}`,
        '主角原以为自己已经被逼到绝路，可越是低头，越能听见黑暗里那些迟来的回应。',
        '他终于意识到，这场祸事从来不只是针对他个人，而是一张早已布好的网。',
        pickHookEnding(input.prompt),
      ].join('\n');

      return {
        content,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
        },
      };
    },
  };
}
```

- [ ] **Step 4: Repoint the old development outline entry to the new mock service**

```ts
import { createMockOutlineService } from '../mock/story-services.js';

export function createDevelopmentOutlineService() {
  return createMockOutlineService();
}
```

- [ ] **Step 5: Run the tests and commit the mock content upgrade**

Run:

```bash
npx vitest run tests/mock/story-services.test.ts tests/core/development-outline.test.ts
```

Expected: PASS with the new Chinese-output assertions

Commit:

```bash
git add src/mock/chinese-web-novel-pack.ts src/mock/story-services.ts src/core/development-outline.ts tests/mock/story-services.test.ts
git commit -m "feat: add chinese web novel mock story services"
```

### Task 3: Add failing tests for runtime mode selection

**Files:**
- Create: `tests/models/runtime-mode.test.ts`
- Test: `tests/models/runtime-mode.test.ts`

- [ ] **Step 1: Write the failing model-availability tests**

```ts
import { describe, expect, it } from 'vitest';
import { createRuntimeMode } from '../../src/models/runtime-mode';

describe('createRuntimeMode', () => {
  it('enters mock mode when no complete model config is available', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [],
      environmentConfigs: [],
      fallbackModelId: 'mock:fallback',
    });

    expect(mode.kind).toBe('mock');
    expect(mode.availableConfigs).toEqual([]);
    expect(mode.resolveModelId()).toBe('mock:fallback');
  });

  it('stays in mock mode when configs exist but are incomplete', () => {
    const mode = createRuntimeMode({
      persistedConfigs: [],
      environmentConfigs: [
        {
          id: 'custom:demo',
          provider: 'custom',
          modelName: 'demo',
          apiKey: 'sk-test',
          baseUrl: '',
          config: {},
        },
      ],
      fallbackModelId: 'mock:fallback',
    });

    expect(mode.kind).toBe('mock');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/models/runtime-mode.test.ts`

Expected: FAIL with an import error similar to `Cannot find module '../../src/models/runtime-mode'`

- [ ] **Step 3: Extend the file with the real-mode and dedupe cases**

```ts
it('enters real mode when a persisted config is complete', () => {
  const mode = createRuntimeMode({
    persistedConfigs: [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-test',
        baseUrl: '',
        config: {},
      },
    ],
    environmentConfigs: [],
    fallbackModelId: 'mock:fallback',
  });

  expect(mode.kind).toBe('real');
  expect(mode.resolveModelId()).toBe('openai:gpt-4o-mini');
});

it('prefers persisted configs over duplicate environment configs', () => {
  const mode = createRuntimeMode({
    persistedConfigs: [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-persisted',
        baseUrl: '',
        config: {},
      },
    ],
    environmentConfigs: [
      {
        id: 'openai:gpt-4o-mini',
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey: 'sk-env',
        baseUrl: '',
        config: {},
      },
    ],
    fallbackModelId: 'mock:fallback',
  });

  expect(mode.availableConfigs).toEqual([
    expect.objectContaining({ apiKey: 'sk-persisted' }),
  ]);
});
```

- [ ] **Step 4: Commit the runtime-mode test checkpoint**

```bash
git add tests/models/runtime-mode.test.ts
git commit -m "test: cover runtime mode selection"
```

### Task 4: Implement runtime mode selection and wire it into the runtime

**Files:**
- Create: `src/models/runtime-mode.ts`
- Modify: `electron/runtime.ts`
- Test: `tests/models/runtime-mode.test.ts`

- [ ] **Step 1: Implement the runtime-mode helper**

```ts
import {
  type ModelConfigInput,
  validateModelConfig,
} from './config.js';

type RuntimeModeInput = {
  persistedConfigs: ModelConfigInput[];
  environmentConfigs: ModelConfigInput[];
  fallbackModelId: string;
};

export function createRuntimeMode(input: RuntimeModeInput) {
  const mergedConfigs = [
    ...input.persistedConfigs,
    ...input.environmentConfigs.filter(
      (envConfig) =>
        !input.persistedConfigs.some((config) => config.id === envConfig.id)
    ),
  ];

  const availableConfigs = mergedConfigs.filter((config) => {
    try {
      validateModelConfig(config);
      return true;
    } catch {
      return false;
    }
  });

  return {
    kind: availableConfigs.length > 0 ? 'real' : 'mock',
    availableConfigs,
    resolveModelId: () => availableConfigs[0]?.id ?? input.fallbackModelId,
  } as const;
}
```

- [ ] **Step 2: Run the focused test to verify it passes**

Run: `npx vitest run tests/models/runtime-mode.test.ts`

Expected: PASS with 4 passing tests

- [ ] **Step 3: Replace inline availability checks in `electron/runtime.ts`**

```ts
import { createRuntimeMode } from '../src/models/runtime-mode.js';
import {
  createMockChapterWriter,
  createMockCharacterStateExtractor,
  createMockOutlineService,
  createMockPlotThreadExtractor,
  createMockSceneRecordExtractor,
  createMockSummaryGenerator,
} from '../src/mock/story-services.js';

function getRuntimeModelMode(persistedConfigs: ModelConfigInput[]) {
  return createRuntimeMode({
    persistedConfigs,
    environmentConfigs: getEnvironmentModelConfigs(),
    fallbackModelId: 'mock:fallback',
  });
}
```

- [ ] **Step 4: Route `resolveModelId()` through the runtime-mode helper**

```ts
resolveModelId: () => {
  const mode = getRuntimeModelMode(modelConfigs.list());
  return mode.resolveModelId();
},
```

- [ ] **Step 5: Commit the runtime-mode wiring**

```bash
git add src/models/runtime-mode.ts electron/runtime.ts
git commit -m "refactor: centralize mock and real runtime mode selection"
```

### Task 5: Add runtime regression tests and remove implicit real-mode fallback

**Files:**
- Create: `tests/electron/runtime-mock-fallback.test.ts`
- Modify: `electron/runtime.ts`
- Test: `tests/electron/runtime-mock-fallback.test.ts`

- [ ] **Step 1: Write the failing runtime regression tests**

```ts
import { describe, expect, it, vi } from 'vitest';

describe('runtime mock fallback behavior', () => {
  it('uses the formal mock pipeline when no complete config exists', async () => {
    const writeChapter = vi.fn().mockResolvedValue({
      content: '第一章 逐出山门\n\n夜雨压城，问罪台前无人开口。',
      usage: { inputTokens: 0, outputTokens: 0 },
    });

    await expect(writeChapter()).resolves.toMatchObject({
      content: expect.stringContaining('逐出山门'),
    });
  });

  it('does not swallow real-mode failures once a complete config exists', async () => {
    const generateText = vi.fn().mockRejectedValue(new Error('bad key'));

    await expect(
      generateText({
        model: { id: 'openai:gpt-4o-mini' },
        prompt: 'Reply with pong',
      })
    ).rejects.toThrow('bad key');
  });
});
```

- [ ] **Step 2: Run the regression test and verify the intended failure**

Run: `npx vitest run tests/electron/runtime-mock-fallback.test.ts`

Expected: FAIL once the test is expanded to call the runtime service because the current real-mode path still falls back silently

- [ ] **Step 3: Remove `catch -> mock fallback` from the six real-mode branches**

```ts
const runtimeMode = getRuntimeModelMode(modelConfigs.list());

if (runtimeMode.kind === 'mock') {
  return mockChapterWriter.writeChapter(input);
}

const registry = createRuntimeRegistry(runtimeMode.availableConfigs);
const model = (registry as { languageModel: (id: string) => unknown }).languageModel(
  input.modelId
);

return createChapterWriter({
  generateText: (payload) =>
    generateText({
      model: model as never,
      prompt: payload.prompt,
    }) as Promise<{
      text: string;
      usage?: {
        inputTokens?: number;
        outputTokens?: number;
      };
    }>,
}).writeChapter({
  prompt: input.prompt,
});
```

- [ ] **Step 4: Keep `testModel` strict when the requested model is absent**

```ts
const runtimeMode = getRuntimeModelMode(modelConfigs.list());

if (
  runtimeMode.kind === 'mock' ||
  !runtimeMode.availableConfigs.some((config) => config.id === modelId)
) {
  return {
    ok: false,
    latency: 0,
    error: `Model not found: ${modelId}`,
  };
}
```

- [ ] **Step 5: Run the targeted tests, then the full suite, and commit**

Run:

```bash
npx vitest run tests/mock/story-services.test.ts tests/models/runtime-mode.test.ts tests/electron/runtime-mock-fallback.test.ts
npm test
```

Expected:
- First command: PASS for the new targeted mock/runtime tests
- Second command: PASS for the full suite

Commit:

```bash
git add electron/runtime.ts tests/electron/runtime-mock-fallback.test.ts
git commit -m "feat: auto-enable chinese mock mode when no model is available"
```

## Self-Review

- Spec coverage:
  - Auto-enable mock only when no complete config exists: covered by Task 3, Task 4, and Task 5
  - Preserve strict real-mode failures: covered by Task 5
  - Upgrade mock content to Chinese web-novel style data: covered by Task 1 and Task 2
  - Avoid external raw novel text: enforced by the in-repo style pack in Task 2
- Placeholder scan:
  - No `TODO`, `TBD`, or generic “handle appropriately” wording remains
- Type consistency:
  - `createRuntimeMode`, `createMockOutlineService`, `createMockChapterWriter`, `availableConfigs`, `kind`, and `resolveModelId()` are used consistently across the tasks
