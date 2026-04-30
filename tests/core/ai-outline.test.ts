import { describe, expect, it, vi } from 'vitest';
import { createAiOutlineService } from '../../src/core/ai-outline';
import type { NarrativeBible } from '../../src/core/narrative/types';

function validNarrativeBible(): NarrativeBible {
  return {
    premise: '被剥夺记忆的档案修复师追查天命账簿。',
    genreContract: '东方幻想长篇，升级、悬疑、权谋并重。',
    targetReaderExperience: '持续获得真相推进、关系反转和规则代价。',
    themeQuestion: '人能否摆脱被记录好的命运？',
    themeAnswerDirection: '自由不是删除命运，而是承担改写命运的代价。',
    centralDramaticQuestion: '主角能否改写天命账簿而不成为新的审判者？',
    endingState: {
      protagonistWins: '夺回选择权。',
      protagonistLoses: '失去被世界遗忘的安全。',
      worldChange: '命运记录权从宗门垄断变成公开审议。',
      relationshipOutcome: '师徒信任重建但再无从属。',
      themeAnswer: '自由需要公开承受代价。',
    },
    voiceGuide: '中文网文节奏，冲突清楚，悬念持续。',
    characterArcs: [
      {
        id: 'lin-mu',
        name: '林牧',
        roleType: 'protagonist',
        desire: '查清家族被抹除的真相。',
        fear: '再次被所有人遗忘。',
        flaw: '遇到失控时会独自承担。',
        misbelief: '只要掌握记录权就能保护所有人。',
        wound: '幼年亲历族谱空白。',
        externalGoal: '找到天命账簿原本。',
        internalNeed: '学会与他人共享风险。',
        arcDirection: 'growth',
        decisionLogic: '优先保护弱者，但会隐瞒危险。',
        lineWillNotCross: '不主动抹除无辜者记忆。',
        lineMayEventuallyCross: '公开自己的禁忌身份。',
        currentArcPhase: 'denial',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'record-cost',
        category: 'power',
        ruleText: '改写命簿会交换等量记忆。',
        cost: '失去一段真实经历。',
        whoBenefits: '掌簿宗门',
        whoSuffers: '无名散修',
        taboo: '不可改写死人命格',
        violationConsequence: '改写者被命簿反噬',
        allowedException: '以自愿记忆为祭',
        currentStatus: 'active',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-ledger-truth',
        type: 'main',
        promise: '天命账簿为何抹除林家。',
        plantedAt: 1,
        expectedPayoff: 1,
        resolvedAt: null,
        currentState: 'open',
        importance: 'critical',
        payoffMustChange: 'world',
        ownerCharacterId: 'lin-mu',
        relatedRelationshipId: null,
        notes: null,
      },
    ],
  };
}

describe('createAiOutlineService', () => {
  it('resolves the selected model from the registry and generates layered outlines', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: '月税奇谈' })
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1' })
      .mockResolvedValueOnce({ text: '1|Chapter 1|Outline 1' });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });
    const onChapterOutlines = vi.fn();

    const title = await service.generateTitleFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
      modelId: 'openai:gpt-4o-mini',
    });
    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
      modelId: 'openai:gpt-4o-mini',
      onChapterOutlines,
    });

    expect(registry.languageModel).toHaveBeenCalledWith('openai:gpt-4o-mini');
    expect(title).toBe('月税奇谈');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: fakeModel })
    );
    expect(result.chapterOutlines).toEqual([
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
      }),
    ]);
    expect(onChapterOutlines).toHaveBeenCalledWith([
      expect.objectContaining({
        volumeIndex: 1,
        chapterIndex: 1,
        title: 'Chapter 1',
      }),
    ]);
  });

  it('falls back to a plain world prompt when the narrative bible response is markdown', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({
        text: [
          '# 长篇中文 web 小说设计方案',
          '## 一、硬性结构约束',
          '- **题材核心**：废柴逆袭',
        ].join('\n'),
      })
      .mockResolvedValueOnce({
        text: [
          '题材基调：废柴逆袭长篇。',
          '故事核心：废柴少年重建命运。',
          '世界规则：力量越强，代价越重。',
        ].join('\n'),
      })
      .mockResolvedValueOnce({ text: '主线：重建命运。' })
      .mockResolvedValueOnce({ text: '第1卷：命运初鸣' })
      .mockResolvedValueOnce({ text: '1|第一章|开局受辱后反击。' });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });
    const onWorldSetting = vi.fn();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '废柴少年重建命运。',
      targetChapters: 1,
      wordsPerChapter: 2000,
      modelId: 'model-1',
      onWorldSetting,
    });

    expect(result.worldSetting).toContain('题材基调：废柴逆袭长篇。');
    expect(result.worldSetting).not.toContain('# 长篇中文 web 小说设计方案');
    expect(result.worldSetting).not.toContain('**题材核心**');
    expect(onWorldSetting).toHaveBeenCalledWith(result.worldSetting);
    expect(generateText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        prompt: expect.stringContaining('Return world rules'),
      })
    );
  });

  it('normalizes model chapter outlines to the requested target chapter count', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1' })
      .mockResolvedValueOnce({
        text: [
          '1|第一章|开局',
          '2|第二章|升级',
          '3|第三章|超出设定',
        ].join('\n'),
      });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });
    const onChapterOutlines = vi.fn();

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 180,
      modelId: 'openai:gpt-4o-mini',
      onChapterOutlines,
    });

    expect(result.chapterOutlines).toHaveLength(2);
    expect(result.chapterOutlines.map((chapter) => chapter.chapterIndex)).toEqual([
      1, 2,
    ]);
    expect(onChapterOutlines).toHaveBeenCalledWith(result.chapterOutlines);
  });

  it('stops requesting chapter outlines once the target chapter count is reached', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1\n---\nVolume 2' })
      .mockResolvedValueOnce({
        text: ['1|第一章|开局', '2|第二章|升级'].join('\n'),
      });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 180,
      modelId: 'openai:gpt-4o-mini',
    });

    expect(result.chapterOutlines).toHaveLength(2);
    expect(generateText).toHaveBeenCalledTimes(5);
  });

  it('renumbers volume-local chapter outlines into cumulative book chapter numbers', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'world' })
      .mockResolvedValueOnce({ text: 'outline' })
      .mockResolvedValueOnce({ text: 'Volume 1\n---\nVolume 2' })
      .mockResolvedValueOnce({ text: '1|第一卷第一章|开局' })
      .mockResolvedValueOnce({ text: '1|第二卷第一章|新卷开局' });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: 'The moon taxes miracles.',
      targetChapters: 2,
      wordsPerChapter: 180,
      modelId: 'openai:gpt-4o-mini',
    });

    expect(result.chapterOutlines).toEqual([
      expect.objectContaining({ volumeIndex: 1, chapterIndex: 1 }),
      expect.objectContaining({ volumeIndex: 2, chapterIndex: 2 }),
    ]);
  });

  it('generates tension budgets after chapter cards', async () => {
    const fakeModel = { id: 'model' };
    const responses = [
      JSON.stringify(validNarrativeBible()),
      JSON.stringify([
        {
          volumeIndex: 1,
          title: '命簿初鸣',
          chapterStart: 1,
          chapterEnd: 1,
          roleInStory: '建立追查目标。',
          mainPressure: '宗门追捕。',
          promisedPayoff: '发现账簿碎页。',
          characterArcMovement: '林牧开始信任同伴。',
          relationshipMovement: '师徒裂痕出现。',
          worldExpansion: '展示命簿代价。',
          endingTurn: '碎页指向师父。',
        },
      ]),
      JSON.stringify({
        cards: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: '旧页',
            plotFunction: '开局。',
            povCharacterId: 'lin-mu',
            externalConflict: '宗门追捕。',
            internalConflict: '林牧想保密却需要求助。',
            relationshipChange: '林牧欠下同伴人情。',
            worldRuleUsedOrTested: 'record-cost',
            informationReveal: '命簿会吞记忆。',
            readerReward: 'truth',
            endingHook: '碎页浮现林家姓名。',
            mustChange: '林牧从逃避变为主动追查。',
            forbiddenMoves: [],
          },
        ],
      }),
      JSON.stringify([
        {
          volumeIndex: 1,
          chapterIndex: 1,
          pressureLevel: 'high',
          dominantTension: 'moral_choice',
          requiredTurn: '胜利会伤害同伴。',
          forcedChoice: '保住证据，或救下同伴。',
          costToPay: '失去同伴信任。',
          irreversibleChange: '林牧无法继续旁观。',
          readerQuestion: '谁安排了这次选择？',
          hookPressure: '章末出现更坏记录。',
          flatnessRisks: ['不要用解释代替冲突。'],
        },
      ]),
    ];
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi.fn().mockImplementation(async () => ({
      text: responses.shift() ?? '',
    }));
    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '命簿修复师追查家族旧案。',
      targetChapters: 1,
      wordsPerChapter: 2000,
      modelId: 'model-1',
    });

    expect(result.chapterTensionBudgets).toEqual([
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        pressureLevel: 'high',
        dominantTension: 'moral_choice',
        requiredTurn: '胜利会伤害同伴。',
        forcedChoice: '保住证据，或救下同伴。',
        costToPay: '失去同伴信任。',
        irreversibleChange: '林牧无法继续旁观。',
        readerQuestion: '谁安排了这次选择？',
        hookPressure: '章末出现更坏记录。',
        flatnessRisks: ['不要用解释代替冲突。'],
      },
    ]);
    expect(result.worldSetting).toContain('目标总章数：1');
    expect(result.worldSetting).toContain('故事前提：被剥夺记忆的档案修复师追查天命账簿。');
    expect(result.worldSetting).not.toContain('Premise:');
    expect(generateText).toHaveBeenCalledTimes(4);
  });
});
