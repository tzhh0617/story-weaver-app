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
        idea: '道侣越多我越无敌。',
        targetChapters: 1,
        wordsPerChapter: 2000,
        modelId: 'model-1',
      })
    ).rejects.toThrow(
      'Invalid narrative bible: Narrative bible must include a protagonist.; Narrative bible must include a main thread.'
    );
  });

  it('normalizes richer real-model bible objects into the flat runtime schema', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi
      .fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          premise: {
            logline: '被逐少年得到吞噬因果的古镜。',
            setup: '宗门污名与追杀同时降临。',
          },
          genreContract: {
            primaryGenre: '东方玄幻复仇成长流',
            mustDeliver: ['主角逆转', '规则代价'],
          },
          targetReaderExperience: {
            openingEmotion: '愤懑',
            satisfactionSources: ['逆转', '真相'],
          },
          themeQuestion: '人能否摆脱被写好的命运？',
          themeAnswerDirection: '自由意味着承担代价。',
          centralDramaticQuestion: '主角能否复仇而不异化？',
          endingState: {
            seriesEndVision: '主角掌握改命权柄。',
            emotionalLanding: '他不再被污名定义。',
            finalMoralImage: '先照见自己。',
          },
          voiceGuide: {
            narrationStyle: '第三人称近距离',
            proseDo: ['冷峻', '锋利'],
          },
          characterArcs: [
            {
              id: 'lu-zhao',
              name: '陆照',
              roleType: 'protagonist',
              desire: '活下去并洗清污名',
              fear: '变成怪物',
              flaw: '不信任任何人',
              misbelief: '只有更狠才能活',
              wound: '被宗门污蔑逐出',
              externalGoal: '查明真相',
              internalNeed: '保留边界',
              arcDirection: '从复仇走向承担',
              decisionLogic: '优先活命与主动权',
              lineWillNotCross: '不吞噬无辜者因果',
              lineMayEventuallyCross: '会牺牲亲近者关系换更大结果',
              currentArcPhase: '谷底反抗',
            },
          ],
          worldRules: [
            {
              id: 'causality-visibility-rule',
              category: 'power-system',
              ruleText: '古镜能看见因果裂隙。',
              cost: '消耗寿元与记忆稳定性。',
              whoBenefits: '冷静观察者',
              whoSuffers: '鲁莽者',
              taboo: '窥探高阶命局',
              violationConsequence: '神魂崩裂',
              allowedException: '借祖祠愿力稳固',
              currentStatus: 'active',
            },
          ],
          narrativeThreads: [
            {
              id: 'who-framed-lu-zhao',
              type: 'mystery',
              promise: '查出是谁栽赃陆照。',
              plantedAt: 'chapter-1',
              expectedPayoff: 'chapter-12',
              resolvedAt: 'series-end',
              currentState: 'active',
              importance: 'core',
              payoffMustChange: '主角对宗门的仇恨对象会被修正',
              ownerCharacterId: 'lu-zhao',
              relatedRelationshipId: 'lu-zhao-han-beixuan',
              notes: '第一章先埋追杀和伪证。',
            },
          ],
          viralStoryProtocol: {
            readerPromise: {
              primary: '低谷反杀与因果代价并行',
            },
            targetEmotion: 'revenge',
            coreDesire: {
              want: '活下去并夺回命运',
            },
            protagonistDrive: ['求生', '复仇', '守住底线'],
            hookEngine: {
              question: '是谁把主角推进这面古镜？',
            },
            payoffCadence: {
              mode: 'steady',
              minorPayoffEveryChapters: '2',
              majorPayoffEveryChapters: '12',
              payoffTypes: ['truth_reveal', 'enemy_setback'],
            },
            tropeContract: ['revenge_payback', 'weak_to_strong'],
            antiClicheRules: ['反转必须带代价'],
            longTermQuestion: {
              value: '主角能否复仇而不异化？',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([
          {
            title: '命簿初鸣',
            chapterStart: 1,
            chapterEnd: 1,
            roleInStory: '建立主线压力。',
            mainPressure: '宗门追杀。',
            promisedPayoff: '发现古镜裂隙。',
            characterArcMovement: '主角从逃避转为反击。',
            relationshipMovement: '暂时没有关系修复。',
            worldExpansion: '展示古镜规则与代价。',
            endingTurn: '古镜首次显威。',
          },
        ]),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          cards: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: '照因初醒',
              plotFunction: '主角在被逐后第一次借古镜反杀。',
              povCharacterId: 'lu-zhao',
              externalConflict: '追兵逼近破庙。',
              internalConflict: '要不要使用邪异古镜。',
              relationshipChange: '与旧宗门彻底决裂。',
              worldRuleUsedOrTested: 'causality-visibility-rule',
              informationReveal: '古镜能吞裂因果。',
              readerReward: 'truth',
              endingHook: '主角发现真正黑手另有其人。',
              mustChange: '主角接受自己必须反击。',
              forbiddenMoves: [],
            },
          ],
          threadActions: [
            {
              threadId: 'who-framed-lu-zhao',
              action: 'plant',
              chapterIndex: 1,
              detail: '埋下真凶并非表面审判链条的悬念。',
            },
          ],
          characterPressures: [
            {
              characterId: 'lu-zhao',
              chapterIndex: 1,
              pressures: [
                '活下去并洗清污名',
                '害怕自己变成怪物',
                '不信任任何人',
                '主角必须接受自己要反击',
              ],
            },
          ],
          relationshipActions: [
            {
              fromCharacterId: 'lu-zhao',
              toCharacterId: 'han-beixuan',
              action: 'deepen',
              chapterIndex: 1,
              detail: '矛盾升级到不死不休。',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        text: JSON.stringify([
          {
            volumeIndex: 1,
            chapterIndex: 1,
            pressureLevel: 'high',
            dominantTension: 'danger',
            requiredTurn: '胜利伴随代价。',
            forcedChoice: '用镜或死。',
            costToPay: '神魂震荡。',
            irreversibleChange: '主角暴露了镜的存在。',
            readerQuestion: '谁在背后操盘？',
            hookPressure: '更高层追兵将至。',
            flatnessRisks: ['不要用设定说明代替冲突。'],
          },
        ]),
      });

    const service = createAiOutlineService({
      registry: registry as never,
      generateText: generateText as never,
    });

    const result = await service.generateFromIdea({
      bookId: 'book-1',
      idea: '一个被宗门逐出的少年，意外继承了会吞噬因果的古镜。',
      targetChapters: 1,
      wordsPerChapter: 1200,
      modelId: 'openai:gpt-5.4',
    });

    expect(result.narrativeBible).toMatchObject({
      premise: expect.stringContaining('被逐少年得到吞噬因果的古镜'),
      genreContract: expect.stringContaining('东方玄幻复仇成长流'),
      targetReaderExperience: expect.stringContaining('愤懑'),
      voiceGuide: expect.stringContaining('第三人称近距离'),
      endingState: {
        protagonistWins: expect.any(String),
        protagonistLoses: expect.any(String),
        worldChange: expect.any(String),
        relationshipOutcome: expect.any(String),
        themeAnswer: expect.any(String),
      },
      relationshipEdges: [],
      worldRules: [
        expect.objectContaining({
          category: 'power',
        }),
      ],
      narrativeThreads: [
        expect.objectContaining({
          type: 'main',
          plantedAt: 1,
          expectedPayoff: null,
          resolvedAt: null,
          currentState: 'open',
          importance: 'critical',
          payoffMustChange: 'plot',
          relatedRelationshipId: null,
        }),
      ],
      viralStoryProtocol: expect.objectContaining({
        readerPromise: expect.stringContaining('低谷反杀'),
        coreDesire: expect.stringContaining('活下去并夺回命运'),
        protagonistDrive: expect.stringContaining('求生'),
        hookEngine: expect.stringContaining('是谁把主角推进这面古镜'),
        payoffCadence: expect.objectContaining({
          minorPayoffEveryChapters: 2,
          majorPayoffEveryChapters: 12,
        }),
      }),
    });
    expect(result.volumePlans).toEqual([
      expect.objectContaining({
        volumeIndex: 1,
        title: '命簿初鸣',
      }),
    ]);
    expect(result.chapterThreadActions).toEqual([
      expect.objectContaining({
        threadId: 'who-framed-lu-zhao',
        action: 'plant',
        requiredEffect: expect.stringContaining('悬念'),
      }),
    ]);
    expect(result.chapterCharacterPressures).toEqual([
      expect.objectContaining({
        characterId: 'lu-zhao',
        expectedChoice: expect.stringContaining('主角必须'),
      }),
    ]);
    expect(result.chapterRelationshipActions).toEqual([
      expect.objectContaining({
        relationshipId: 'lu-zhao-han-beixuan',
        requiredChange: expect.stringContaining('不死不休'),
      }),
    ]);
  });
});
