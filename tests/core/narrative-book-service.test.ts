import { describe, expect, it, vi } from 'vitest';
import { createBookService } from '../../src/core/book-service';
import { createDatabase, createRepositories } from '../../src/storage/database';
import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeBible,
  VolumePlan,
} from '../../src/core/narrative/types';

function bible(): NarrativeBible {
  return {
    premise: '命簿修复师追查旧案。',
    genreContract: '东方幻想。',
    targetReaderExperience: '真相、代价、反转。',
    themeQuestion: '人能否摆脱命运？',
    themeAnswerDirection: '自由来自承担代价。',
    centralDramaticQuestion: '林牧能否改写命簿？',
    endingState: {
      protagonistWins: '夺回选择权。',
      protagonistLoses: '失去匿名安全。',
      worldChange: '命簿公开。',
      relationshipOutcome: '并肩而非依附。',
      themeAnswer: '自由需要责任。',
    },
    voiceGuide: '中文网文。',
    characterArcs: [
      {
        id: 'lin-mu',
        name: '林牧',
        roleType: 'protagonist',
        desire: '查清真相。',
        fear: '被遗忘。',
        flaw: '独自承担。',
        misbelief: '掌控记录才能保护别人。',
        wound: '家族被抹除。',
        externalGoal: '寻找命簿。',
        internalNeed: '学会共享风险。',
        arcDirection: 'growth',
        decisionLogic: '保护弱者但隐瞒危险。',
        lineWillNotCross: '不抹除无辜者。',
        lineMayEventuallyCross: '公开身份。',
        currentArcPhase: 'denial',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'record-cost',
        category: 'power',
        ruleText: '改写命簿会交换记忆。',
        cost: '失去经历。',
        whoBenefits: '掌簿宗门',
        whoSuffers: '散修',
        taboo: '不可改死人命格',
        violationConsequence: '反噬',
        allowedException: '自愿献祭',
        currentStatus: 'active',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-ledger-truth',
        type: 'main',
        promise: '查清林家旧案。',
        plantedAt: 1,
        expectedPayoff: 2,
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

function volumePlans(): VolumePlan[] {
  return [
    {
      volumeIndex: 1,
      title: '命簿初鸣',
      chapterStart: 1,
      chapterEnd: 1,
      roleInStory: '建立旧案。',
      mainPressure: '宗门追捕。',
      promisedPayoff: '拿到碎页。',
      characterArcMovement: '林牧开始信任同伴。',
      relationshipMovement: '信任从零到一。',
      worldExpansion: '命簿代价显露。',
      endingTurn: '碎页指向师父。',
    },
  ];
}

function chapterCards(bookId: string): ChapterCard[] {
  return [
    {
      bookId,
      volumeIndex: 1,
      chapterIndex: 1,
      title: '旧页初鸣',
      plotFunction: '建立旧案目标。',
      povCharacterId: 'lin-mu',
      externalConflict: '宗门执事搜查旧页。',
      internalConflict: '林牧想隐瞒却必须求助。',
      relationshipChange: '林牧欠下同伴人情。',
      worldRuleUsedOrTested: 'record-cost',
      informationReveal: '命簿会吞记忆。',
      readerReward: 'truth',
      endingHook: '旧页浮现林家姓名。',
      mustChange: '林牧从逃避变成主动追查。',
      forbiddenMoves: ['不能揭示幕后主使。'],
    },
  ];
}

function tensionBudgets(bookId: string): ChapterTensionBudget[] {
  return [
    {
      bookId,
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
  ];
}

describe('narrative book-service integration', () => {
  it('persists planning bundle data and advances the planning-writing loop after a chapter is written', async () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);
    const service = createBookService({
      ...repos,
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            worldSetting: 'Loop world',
            masterOutline: 'Loop outline',
            volumeOutlines: ['Stage 1'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: '命簿开页',
                outline: '林牧被迫接下第一场追查。',
              },
            ],
            titleIdeaContract: {
              bookId: input.bookId,
              title: '命簿追猎',
              idea: input.idea,
              corePromise: '每次改命都要先失去一样东西。',
              titleHooks: ['命簿', '追猎'],
              forbiddenDrift: ['无代价升级'],
            },
            endgamePlan: {
              bookId: input.bookId,
              titleIdeaContract: '命簿追猎',
              protagonistEndState: '林牧主动公开真相。',
              finalConflict: '林牧必须在公开命簿和保住师门之间抉择。',
              finalOpponent: '司命监首座',
              worldEndState: '命簿不再由宗门垄断。',
              coreCharacterOutcomes: {
                linMu: '接受失去匿名的代价。',
              },
              majorPayoffs: ['旧案真凶现身'],
            },
            stagePlans: [
              {
                stageIndex: 1,
                chapterStart: 1,
                chapterEnd: 10,
                chapterBudget: 10,
                objective: '逼林牧接下旧案。',
                primaryResistance: '司命监封锁线索。',
                pressureCurve: 'ascending',
                escalation: '身边人被卷入。',
                climax: '林牧第一次公开违抗宗门。',
                payoff: '确认旧案不是意外。',
                irreversibleChange: '林牧被列入追捕名单。',
                nextQuestion: '谁在背后删改命簿？',
                titleIdeaFocus: '命簿代价',
                compressionTrigger: '若追查停滞则压缩支线',
                status: 'planned',
              },
            ],
            arcPlans: [
              {
                arcIndex: 1,
                stageIndex: 1,
                chapterStart: 1,
                chapterEnd: 5,
                chapterBudget: 5,
                primaryThreads: ['old-case'],
                characterTurns: [{ characterId: 'lin-mu', turn: '停止逃避' }],
                threadActions: [{ threadId: 'old-case', action: 'plant' }],
                targetOutcome: '林牧决定主动追查。',
                escalationMode: 'tightening',
                turningPoint: '旧页上浮现林家名字。',
                requiredPayoff: '确认命簿会吞记忆。',
                resultingInstability: '林牧不再安全。',
                titleIdeaFocus: '每次改命都要代价',
                minChapterCount: 4,
                maxChapterCount: 6,
                status: 'planned',
              },
            ],
            chapterPlans: [
              {
                batchIndex: 1,
                chapterIndex: 1,
                arcIndex: 1,
                goal: '让林牧接下旧案。',
                conflict: '司命监先一步搜查旧页。',
                pressureSource: '林牧害怕再次失去记忆。',
                changeType: 'commitment',
                threadActions: [{ threadId: 'old-case', action: 'plant' }],
                reveal: '旧页记录着林家名字。',
                payoffOrCost: '林牧失去一段自保记忆。',
                endingHook: '旧页浮现被删除的审判记录。',
                titleIdeaLink: '每次改命都要先失去一样东西。',
                batchGoal: '旧案起势',
                requiredPayoffs: ['旧案入场'],
                forbiddenDrift: ['轻松脱身'],
                status: 'planned',
              },
            ],
            narrativeBible: bible(),
            volumePlans: volumePlans(),
            chapterCards: chapterCards(input.bookId),
            chapterTensionBudgets: tensionBudgets(input.bookId),
            chapterThreadActions: [],
            chapterCharacterPressures: [],
            chapterRelationshipActions: [],
          })
        ),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '林牧触碰旧页后失去一段记忆，却确认林家旧案被人刻意抹除。',
        }),
      },
      chapterAuditor: {
        auditChapter: vi.fn().mockResolvedValue({
          passed: true,
          score: 91,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 14,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 10,
            threadManagement: 9,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 70,
              choicePressure: 75,
              consequenceVisibility: 70,
              irreversibleChange: 75,
              hookStrength: 70,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '自由来自承担代价。',
          },
        }),
      },
      narrativeStateExtractor: {
        extractState: vi.fn().mockResolvedValue({
          characterStates: [],
          relationshipStates: [],
          threadUpdates: [],
          scene: null,
          themeProgression: '自由来自承担代价。',
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('林牧确认旧案并决定追查。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId: () => 'mock',
    });

    const bookId = service.createBook({
      idea: '命簿旧案追查',
      targetChapters: 20,
      wordsPerChapter: 2000,
    });

    await service.startBook(bookId);

    expect(repos.endgamePlans.getByBook(bookId)).toMatchObject({
      finalOpponent: '司命监首座',
    });
    expect(repos.progress.getByBookId(bookId)).toMatchObject({
      phase: 'planning_init',
      currentStage: 1,
      currentArc: 1,
      activeTaskType: 'book:plan:init',
    });

    await service.writeNextChapter(bookId);

    const plans = repos.chapterPlans.listByBook(bookId);
    expect(plans.find((plan) => plan.chapterIndex === 1)).toMatchObject({
      chapterIndex: 1,
      status: 'completed',
    });
    expect(repos.storyStateSnapshots.getLatestByBook(bookId)).toMatchObject({
      chapterIndex: 1,
      remainingChapterBudget: 19,
    });
    expect(service.getBookDetail(bookId)?.chapters[0]?.content).toBeTruthy();
    expect(repos.progress.getByBookId(bookId)).toMatchObject({
      currentStage: 1,
      currentArc: 1,
      activeTaskType: 'book:plan:init',
    });
  });

  it('falls back to another writable outlined chapter when the next chapter plan drifts', async () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);
    const service = createBookService({
      ...repos,
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            worldSetting: 'Loop world',
            masterOutline: 'Loop outline',
            volumeOutlines: ['Stage 1'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: '命簿开页',
                outline: '林牧被迫接下第一场追查。',
              },
            ],
            chapterPlans: [
              {
                batchIndex: 1,
                chapterIndex: 99,
                arcIndex: 1,
                goal: '一个已经漂移的旧计划。',
                conflict: '该章节当前没有可写的章节行。',
                pressureSource: '计划已过期。',
                changeType: 'drift',
                threadActions: [{ threadId: 'old-case', action: 'misdirect' }],
                reveal: '这条计划已经失效。',
                payoffOrCost: '如果强绑会导致停滞。',
                endingHook: '无',
                titleIdeaLink: '每次改命都要先失去一样东西。',
                batchGoal: '失效计划',
                requiredPayoffs: ['不要阻塞写作'],
                forbiddenDrift: ['卡死在失效计划上'],
                status: 'planned',
              },
            ],
            narrativeBible: bible(),
            volumePlans: volumePlans(),
            chapterCards: chapterCards(input.bookId),
            chapterTensionBudgets: tensionBudgets(input.bookId),
            chapterThreadActions: [],
            chapterCharacterPressures: [],
            chapterRelationshipActions: [],
          })
        ),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '林牧没有被失效计划卡住，仍然推进了第一章。',
        }),
      },
      chapterAuditor: {
        auditChapter: vi.fn().mockResolvedValue({
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 65,
              choicePressure: 75,
              consequenceVisibility: 65,
              irreversibleChange: 75,
              hookStrength: 65,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '自由需要承担代价。',
          },
        }),
      },
      narrativeStateExtractor: {
        extractState: vi.fn().mockResolvedValue({
          characterStates: [],
          relationshipStates: [],
          threadUpdates: [],
          scene: null,
          themeProgression: '自由需要承担代价。',
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('林牧仍然推进了第一章。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId: () => 'mock',
    });

    const bookId = service.createBook({
      idea: '命簿旧案追查',
      targetChapters: 1,
      wordsPerChapter: 2000,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    expect(service.getBookDetail(bookId)?.chapters[0]).toMatchObject({
      chapterIndex: 1,
      content: '林牧没有被失效计划卡住，仍然推进了第一章。',
    });
    expect(
      repos.chapterPlans.listByBook(bookId).find((plan) => plan.chapterIndex === 99)
    ).toMatchObject({
      chapterIndex: 99,
      status: 'planned',
    });
  });

  it('persists non-resolving narrative thread state updates after an approved chapter', async () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);
    const service = createBookService({
      ...repos,
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) => Promise.resolve({
          worldSetting: 'World rules',
          masterOutline: 'Master outline',
          volumeOutlines: ['Volume 1'],
          chapterOutlines: [
            {
              volumeIndex: 1,
              chapterIndex: 1,
              title: '旧页初鸣',
              outline: '建立旧案目标。',
          },
        ],
          narrativeBible: bible(),
          volumePlans: volumePlans(),
          chapterCards: chapterCards(input.bookId),
          chapterTensionBudgets: tensionBudgets(input.bookId),
          chapterThreadActions: [],
          chapterCharacterPressures: [],
          chapterRelationshipActions: [],
        })),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '林牧触碰旧页，失去一段记忆并确认林家旧案被遮掩。',
        }),
      },
      chapterAuditor: {
        auditChapter: vi.fn().mockResolvedValue({
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 65,
              choicePressure: 75,
              consequenceVisibility: 65,
              irreversibleChange: 75,
              hookStrength: 65,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '自由需要承担代价。',
          },
        }),
      },
      narrativeStateExtractor: {
        extractState: vi.fn().mockResolvedValue({
          characterStates: [],
          relationshipStates: [],
          threadUpdates: [
            {
              threadId: 'main-ledger-truth',
              currentState: 'advanced',
              notes: '旧案证据被确认。',
            },
          ],
          scene: null,
          themeProgression: '自由需要承担代价。',
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('林牧确认旧案线索。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId: () => 'mock',
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 2000,
    });

    await service.startBook(bookId);
    await service.writeNextChapter(bookId);

    expect(repos.narrativeThreads.listByBook(bookId)[0]).toMatchObject({
      id: 'main-ledger-truth',
      currentState: 'advanced',
      notes: '旧案证据被确认。',
    });
    expect(service.getBookDetail(bookId)?.chapters[0]).toMatchObject({
      auditScore: 88,
      auditFlatnessScore: 69,
      draftAttempts: 1,
    });
    expect(repos.chapterTensionBudgets.listByBook(bookId)[0]).toMatchObject({
      bookId,
      chapterIndex: 1,
      dominantTension: 'moral_choice',
    });
    expect(
      service.getBookDetail(bookId)?.narrative?.chapterTensionBudgets[0]
    ).toMatchObject({
      bookId,
      chapterIndex: 1,
      pressureLevel: 'high',
    });
    expect(
      service.getBookDetail(bookId)?.chapters[0]?.content
    ).toBeTruthy();
  });

  it('maps structured narrative records back into compatible book detail fields', async () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);
    const service = createBookService({
      ...repos,
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            worldSetting: 'Legacy world',
            masterOutline: 'Legacy outline',
            volumeOutlines: ['Volume 1'],
            chapterOutlines: [
              {
                volumeIndex: 1,
                chapterIndex: 1,
                title: '旧页初鸣',
                outline: 'Legacy chapter outline',
              },
            ],
            narrativeBible: bible(),
            volumePlans: volumePlans(),
            chapterCards: chapterCards(input.bookId),
            chapterTensionBudgets: tensionBudgets(input.bookId),
            chapterThreadActions: [],
            chapterCharacterPressures: [],
            chapterRelationshipActions: [],
          })
        ),
      },
      chapterWriter: {
        writeChapter: vi.fn(),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn(),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId: () => 'mock',
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 1,
      wordsPerChapter: 2000,
    });

    await service.startBook(bookId);
    const detail = service.getBookDetail(bookId);

    expect(detail?.narrative?.storyBible).toMatchObject({
      themeQuestion: '人能否摆脱命运？',
      themeAnswerDirection: '自由来自承担代价。',
      centralDramaticQuestion: '林牧能否改写命簿？',
    });
    expect(detail?.context?.worldSetting).toContain('主题问题：人能否摆脱命运？');
    expect(detail?.context?.outline).toContain('第1卷 命簿初鸣');
    expect(detail?.chapters[0]?.outline).toContain('必须变化：林牧从逃避变成主动追查。');
    expect(detail?.narrative.chapterTensionBudgets[0]).toMatchObject({
      chapterIndex: 1,
      pressureLevel: 'high',
    });
  });

  it('runs and stores a checkpoint after completing chapter 10', async () => {
    const db = createDatabase(':memory:');
    const repos = createRepositories(db);
    const cards = Array.from({ length: 10 }, (_, index) => {
      const chapterIndex = index + 1;

      return {
        ...chapterCards('placeholder')[0],
        bookId: 'placeholder',
        chapterIndex,
        title: `旧页 ${chapterIndex}`,
        mustChange: `林牧完成第 ${chapterIndex} 次不可逆推进。`,
      };
    });
    const service = createBookService({
      ...repos,
      outlineService: {
        generateFromIdea: vi.fn().mockImplementation((input) =>
          Promise.resolve({
            worldSetting: 'World rules',
            masterOutline: 'Master outline',
            volumeOutlines: ['Volume 1'],
            chapterOutlines: cards.map((card) => ({
              volumeIndex: card.volumeIndex,
              chapterIndex: card.chapterIndex,
              title: card.title,
              outline: card.plotFunction,
            })),
            narrativeBible: {
              ...bible(),
              narrativeThreads: [
                {
                  ...bible().narrativeThreads[0],
                  expectedPayoff: 10,
                },
              ],
            },
            volumePlans: [
              {
                ...volumePlans()[0],
                chapterEnd: 10,
              },
            ],
            chapterCards: cards.map((card) => ({
              ...card,
              bookId: input.bookId,
            })),
            chapterTensionBudgets: cards.map((card) => ({
              ...tensionBudgets(input.bookId)[0],
              volumeIndex: card.volumeIndex,
              chapterIndex: card.chapterIndex,
            })),
            chapterThreadActions: [],
            chapterCharacterPressures: [],
            chapterRelationshipActions: [],
          })
        ),
      },
      chapterWriter: {
        writeChapter: vi.fn().mockResolvedValue({
          content: '林牧触碰旧页，失去一段记忆并确认旧案仍在推进。',
        }),
      },
      chapterAuditor: {
        auditChapter: vi.fn().mockResolvedValue({
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 65,
              choicePressure: 75,
              consequenceVisibility: 65,
              irreversibleChange: 75,
              hookStrength: 65,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '自由需要承担代价。',
          },
        }),
      },
      narrativeCheckpoint: {
        reviewCheckpoint: vi.fn().mockResolvedValue({
          checkpointType: 'arc',
          arcReport: { protagonist: '欲望仍清晰。' },
          threadDebt: { critical: [] },
          pacingReport: { readerRewards: '稳定。' },
          replanningNotes: '后续章节无需调整。',
        }),
      },
      narrativeStateExtractor: {
        extractState: vi.fn().mockResolvedValue({
          characterStates: [],
          relationshipStates: [],
          threadUpdates: [],
          scene: null,
          themeProgression: '自由需要承担代价。',
        }),
      },
      summaryGenerator: {
        summarizeChapter: vi.fn().mockResolvedValue('林牧确认旧案线索。'),
      },
      plotThreadExtractor: {
        extractThreads: vi.fn().mockResolvedValue({
          openedThreads: [],
          resolvedThreadIds: [],
        }),
      },
      characterStateExtractor: {
        extractStates: vi.fn().mockResolvedValue([]),
      },
      sceneRecordExtractor: {
        extractScene: vi.fn().mockResolvedValue(null),
      },
      resolveModelId: () => 'mock',
    });

    const bookId = service.createBook({
      idea: '命簿',
      targetChapters: 10,
      wordsPerChapter: 2000,
    });

    await service.startBook(bookId);
    await service.writeRemainingChapters(bookId);

    expect(repos.narrativeCheckpoints.listByBook(bookId)).toEqual([
      expect.objectContaining({
        bookId,
        chapterIndex: 10,
        checkpointType: 'arc',
        report: expect.objectContaining({
          arcReport: { protagonist: '欲望仍清晰。' },
          tensionCheckpoint: expect.objectContaining({
            flatChapterIndexes: [6, 7, 8, 9, 10],
            repeatedPatterns: [
              'dominantTension moral_choice repeated for 5 chapters',
            ],
          }),
        }),
      }),
    ]);
    expect(
      service.getBookDetail(bookId)?.narrative?.narrativeCheckpoints[0]
    ).toMatchObject({
      bookId,
      chapterIndex: 10,
      checkpointType: 'arc',
      futureCardRevisions: [
        {
          type: 'tension_budget_rebalance',
          instruction: expect.stringContaining(
            'Switch dominant tension in the next 2 chapters'
          ),
        },
      ],
    });
    expect(repos.progress.getByBookId(bookId)).toMatchObject({
      phase: 'planning_recheck',
      currentChapter: 10,
      activeTaskType: 'book:plan:rebuild-chapters',
    });
  });
});
