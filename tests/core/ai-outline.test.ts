import { describe, expect, it, vi } from 'vitest';
import { createAiOutlineService } from '@story-weaver/backend/core/ai-outline/outline-service';
import type { NarrativeBible } from '@story-weaver/backend/core/narrative/types';

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
      title: '新作品',
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 2500,
      modelId: 'openai:gpt-4o-mini',
    });
    const result = await service.generateFromIdea({
      bookId: 'book-1',
      title,
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
      title: '命运重建',
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
      title: '月税奇谈',
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
      title: '月税奇谈',
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
      title: '月税奇谈',
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

  it('preserves pipe characters inside generated chapter outline text', async () => {
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
        text: '1|第一章|主角发现旧账|但线索指向更危险的人',
      });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      title: '月税奇谈',
      idea: 'The moon taxes miracles.',
      targetChapters: 1,
      wordsPerChapter: 180,
      modelId: 'openai:gpt-4o-mini',
    });

    expect(result.chapterOutlines[0]?.outline).toBe(
      '主角发现旧账|但线索指向更危险的人'
    );
  });

  it('generates tension budgets after chapter cards', async () => {
    const fakeModel = { id: 'model' };
    const prompts: string[] = [];
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
    const generateText = vi.fn().mockImplementation(async ({ prompt }) => {
      prompts.push(prompt);
      return {
        text: responses.shift() ?? '',
      };
    });
    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      title: '命簿初鸣',
      idea: '命簿修复师追查家族旧案。',
      targetChapters: 1,
      wordsPerChapter: 2000,
      modelId: 'model-1',
    });

    expect(result.narrativeBible?.viralStoryProtocol).toMatchObject({
      readerPromise: expect.any(String),
      coreDesire: expect.any(String),
      hookEngine: expect.any(String),
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
    expect(prompts.some((prompt) => prompt.includes('Viral Story Protocol'))).toBe(
      true
    );
    expect(generateText).toHaveBeenCalledTimes(4);
  });

  it('normalizes freeform narrative bible enum values before validation', async () => {
    const fakeModel = { id: 'model' };
    const modelBible = validNarrativeBible() as any;
    modelBible.genreContract = {
      primary: '档案悬疑',
      twist: '证据会被城市现实改写。',
    };
    modelBible.targetReaderExperience = [
      '每章给出可验证线索。',
      '每次验证都带来代价。',
    ];
    modelBible.endingState.relationshipOutcome = [
      '师徒关系破裂。',
      '双方承认彼此都隐瞒过真相。',
    ];
    modelBible.voiceGuide = ['冷峻', '快节奏', '证据驱动'];
    modelBible.characterArcs[0].arcDirection =
      '从孤立的修理者转向愿意承担真相后果的见证者与反抗者。';
    modelBible.characterArcs.push({
      id: 'mentor-shadow',
      name: '影子导师',
      roleType: 'mentor-shadow',
      desire: '让主角活到午夜。',
      fear: '真相再次毁掉家族。',
      flaw: '用隐瞒代替保护。',
      misbelief: '被保护的人不该知道代价。',
      wound: '曾经亲手封存关键记忆。',
      externalGoal: '留下修复怀表的线索。',
      internalNeed: '承认保护也会成为伤害。',
      arcDirection: '迟来忏悔弧。',
      decisionLogic: '优先保护主角，但会隐瞒危险。',
      lineWillNotCross: null,
      lineMayEventuallyCross: null,
      currentArcPhase: 'shadow',
    });
    modelBible.worldRules[0].category = 'time-and-causality';
    modelBible.narrativeThreads[0].type = 'main-plot';
    modelBible.narrativeThreads[0].currentState =
      '怀表停在23:47，修复难点指向第十三齿。';
    modelBible.narrativeThreads[0].importance = 'high';
    modelBible.narrativeThreads[0].payoffMustChange =
      '修表不能只是技术成功，必须迫使主角付出记忆或信任的代价。';
    modelBible.viralStoryProtocol = {
      readerPromise: '每章都有时间规则反转。',
    };
    const responses = [
      JSON.stringify(modelBible),
      JSON.stringify([
        {
          volumeIndex: 1,
          title: '午夜初鸣',
          chapterStart: 1,
          chapterEnd: 1,
          roleInStory: '建立午夜规则。',
          mainPressure: '钟声临近。',
          promisedPayoff: {
            visible: '确认怀表不会被改写。',
            cost: '主角必须丢失一段安全记忆。',
          },
          characterArcMovement: ['主角开始接受代价。'],
          relationshipMovement: '导师隐瞒暴露。',
          worldExpansion: '展示时间改写规则。',
          endingTurn: '怀表停在下一次改写前。',
        },
      ]),
      JSON.stringify({
        cards: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            title: '不响的怀表',
            plotFunction: '开局建立钟声规则。',
            povCharacterId: 'lin-mu',
            externalConflict: '午夜将至。',
            internalConflict: '主角必须决定是否相信导师。',
            relationshipChange: '主角发现导师隐藏线索。',
            worldRuleUsedOrTested: 'record-cost',
            informationReveal: '怀表可保存一次真相。',
            readerReward:
              '读者获得第一次明确的现实改写目击：事故、伤亡、围观记忆和物证同时发生冲突；同时获得情感钩子——沈砚真正想守住的可能不是父亲遗物，而是一个连他自己都快想不起的孩子。',
            endingHook: '怀表指针突然倒退。',
            mustChange: '主角从逃避转为主动修表。',
            forbiddenMoves: [],
          },
        ],
      }),
      JSON.stringify([
        {
          volumeIndex: 1,
          chapterIndex: 1,
          pressureLevel: 'high',
          dominantTension: 'deadline',
          requiredTurn: '修表会暴露被隐藏的真相。',
          forcedChoice: '相信导师，或独自拆表。',
          costToPay: '失去一段安全记忆。',
          irreversibleChange: '主角无法再相信城市记录。',
          readerQuestion: '谁让钟声改写结局？',
          hookPressure: '午夜提前响起。',
          flatnessRisks: ['不要只解释规则。'],
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
      title: '午夜怀表',
      idea: '钟表修理师在午夜前修好不被改写的怀表。',
      targetChapters: 1,
      wordsPerChapter: 300,
      modelId: 'model-1',
    });

    expect(result.narrativeBible?.characterArcs[0]?.arcDirection).toBe(
      'growth'
    );
    expect(result.narrativeBible?.characterArcs[1]?.roleType).toBe(
      'supporting'
    );
    expect(result.narrativeBible?.worldRules[0]?.category).toBe('power');
    expect(result.narrativeBible?.genreContract).toBe(
      'primary：档案悬疑；twist：证据会被城市现实改写。'
    );
    expect(result.narrativeBible?.targetReaderExperience).toBe(
      '每章给出可验证线索。；每次验证都带来代价。'
    );
    expect(result.narrativeBible?.endingState.relationshipOutcome).toBe(
      '师徒关系破裂。；双方承认彼此都隐瞒过真相。'
    );
    expect(result.narrativeBible?.voiceGuide).toBe('冷峻；快节奏；证据驱动');
    expect(result.narrativeBible?.narrativeThreads[0]).toMatchObject({
      type: 'main',
      currentState: 'open',
      importance: 'critical',
      payoffMustChange: 'relationship',
    });
    expect(
      result.narrativeBible?.viralStoryProtocol?.payoffCadence
        .minorPayoffEveryChapters
    ).toBeGreaterThan(0);
    const volumePlans = result.volumePlans;
    const chapterCards = result.chapterCards;
    expect(volumePlans).toBeDefined();
    expect(chapterCards).toBeDefined();
    if (!volumePlans || !chapterCards) {
      throw new Error('Expected bible-based outline data');
    }
    expect(volumePlans[0]).toMatchObject({
      promisedPayoff: 'visible：确认怀表不会被改写。；cost：主角必须丢失一段安全记忆。',
      characterArcMovement: '主角开始接受代价。',
    });
    expect(chapterCards[0]?.readerReward).toBe('truth');
  });

  it('filters malformed chapter action rows before returning generated outlines', async () => {
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
        threadActions: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            action: 'advance',
            requiredEffect: '主线线索推进。',
          },
          {
            volumeIndex: 1,
            chapterIndex: 1,
            threadId: 'main-ledger-truth',
            action: 'advance',
            requiredEffect: '碎页证明林家旧案与师父相关。',
          },
        ],
        characterPressures: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            desirePressure: '想立刻查明真相。',
            fearPressure: '害怕再次被抹除。',
            flawTrigger: '独自承担。',
            expectedChoice: '隐瞒危险。',
          },
          {
            volumeIndex: 1,
            chapterIndex: 1,
            characterId: 'lin-mu',
            desirePressure: '想立刻查明真相。',
            fearPressure: '害怕再次被抹除。',
            flawTrigger: '独自承担。',
            expectedChoice: '向同伴透露一半真相。',
          },
        ],
        relationshipActions: [
          {
            volumeIndex: 1,
            chapterIndex: 1,
            action: 'strain',
            requiredChange: '信任裂痕加深。',
          },
          {
            volumeIndex: 1,
            chapterIndex: 1,
            relationshipId: 'lin-mu-ally',
            action: 'strain',
            requiredChange: '同伴发现林牧仍在隐瞒。',
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
      title: '命簿初鸣',
      idea: '命簿修复师追查家族旧案。',
      targetChapters: 1,
      wordsPerChapter: 2000,
      modelId: 'model-1',
    });

    expect(result.chapterThreadActions).toEqual([
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        threadId: 'main-ledger-truth',
        action: 'advance',
        requiredEffect: '碎页证明林家旧案与师父相关。',
      },
    ]);
    expect(result.chapterCharacterPressures).toEqual([
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        characterId: 'lin-mu',
        desirePressure: '想立刻查明真相。',
        fearPressure: '害怕再次被抹除。',
        flawTrigger: '独自承担。',
        expectedChoice: '向同伴透露一半真相。',
      },
    ]);
    expect(result.chapterRelationshipActions).toEqual([
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        relationshipId: 'lin-mu-ally',
        action: 'strain',
        requiredChange: '同伴发现林牧仍在隐瞒。',
      },
    ]);
  });

  it('reports missing narrative bible arrays as validation errors', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi.fn().mockResolvedValueOnce({
      text: JSON.stringify({
        premise: '道侣越多我越无敌。',
        genreContract: '玄幻升级。',
        targetReaderExperience: '爽感推进。',
        themeQuestion: '力量是否必须依赖关系？',
        themeAnswerDirection: '真正的强大来自选择承担。',
        centralDramaticQuestion: '主角能否守住本心？',
        endingState: {
          protagonistWins: '成为强者。',
          protagonistLoses: '失去安稳。',
          worldChange: '宗门格局重洗。',
          relationshipOutcome: '道侣同盟成形。',
          themeAnswer: '力量需要责任。',
        },
        voiceGuide: '中文网文节奏。',
      }),
    });
    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      service.generateFromIdea({
        bookId: 'book-1',
        title: '道侣命契',
        idea: '道侣越多我越无敌。',
        targetChapters: 1,
        wordsPerChapter: 2000,
        modelId: 'model-1',
      })
    ).rejects.toThrow(
      'Invalid narrative bible: Narrative bible must include characterArcs array.'
    );
  });
});
