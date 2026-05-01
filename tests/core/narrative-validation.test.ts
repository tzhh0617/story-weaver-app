import { describe, expect, it } from 'vitest';
import {
  validateChapterCards,
  validateNarrativeBible,
  validateTensionBudgets,
  validateVolumePlans,
} from '@story-weaver/backend/core/narrative/validation';
import type {
  ChapterCard,
  ChapterTensionBudget,
  NarrativeBible,
  VolumePlan,
} from '@story-weaver/backend/core/narrative/types';

function validBible(): NarrativeBible {
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
        expectedPayoff: 20,
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

describe('validateNarrativeBible', () => {
  it('accepts a bible with a protagonist, costly world rule, and critical thread', () => {
    expect(validateNarrativeBible(validBible(), { targetChapters: 30 })).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('rejects missing character desire and world-rule cost', () => {
    const bible = validBible();
    bible.characterArcs[0] = {
      ...bible.characterArcs[0],
      name: '',
      desire: '',
      externalGoal: '',
      internalNeed: '',
      currentArcPhase: '',
    };
    bible.worldRules[0] = {
      ...bible.worldRules[0],
      ruleText: '',
      cost: '',
      currentStatus: '',
    };

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Character lin-mu must include name.');
    expect(result.issues).toContain('Character lin-mu must include desire.');
    expect(result.issues).toContain('Character lin-mu must include externalGoal.');
    expect(result.issues).toContain('Character lin-mu must include internalNeed.');
    expect(result.issues).toContain(
      'Character lin-mu must include currentArcPhase.'
    );
    expect(result.issues).toContain('World rule record-cost must include ruleText.');
    expect(result.issues).toContain('World rule record-cost must include cost.');
    expect(result.issues).toContain(
      'World rule record-cost must include currentStatus.'
    );
  });

  it('validates optional viral story protocol fields', () => {
    const bible = validBible();
    bible.viralStoryProtocol = {
      readerPromise: '',
      targetEmotion: 'revenge',
      coreDesire: '复仇',
      protagonistDrive: '主动追查。',
      hookEngine: '旧案递进。',
      payoffCadence: {
        mode: 'steady',
        minorPayoffEveryChapters: 2,
        majorPayoffEveryChapters: 8,
        payoffTypes: ['truth_reveal'],
      },
      tropeContract: ['revenge_payback'],
      antiClicheRules: ['反派不降智。'],
      longTermQuestion: '幕后是谁？',
    };

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Viral story protocol must include readerPromise.'
    );
  });

  it('rejects narrative threads that would fail persistence', () => {
    const bible = validBible();
    bible.narrativeThreads[0] = {
      ...bible.narrativeThreads[0],
      promise: '',
      currentState: '',
      importance: '',
      payoffMustChange: '',
    } as unknown as NarrativeBible['narrativeThreads'][number];

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Thread main-ledger-truth must include promise.');
    expect(result.issues).toContain(
      'Thread main-ledger-truth must include currentState.'
    );
    expect(result.issues).toContain(
      'Thread main-ledger-truth must include importance.'
    );
    expect(result.issues).toContain(
      'Thread main-ledger-truth must include payoffMustChange.'
    );
  });

  it('rejects relationship edges that would fail persistence', () => {
    const bible = validBible();
    bible.characterArcs.push({
      ...bible.characterArcs[0],
      id: 'ally-witness',
      name: '沈照',
      roleType: 'supporting',
    });
    bible.relationshipEdges = [
      {
        id: 'lin-mu-ally',
        fromCharacterId: 'lin-mu',
        toCharacterId: 'ally-witness',
        visibleLabel: '',
        hiddenTruth: null,
        dependency: null,
        debt: null,
        misunderstanding: null,
        affection: null,
        harmPattern: null,
        sharedGoal: null,
        valueConflict: null,
        trustLevel: Number.NaN,
        tensionLevel: Number.NaN,
        currentState: '',
        plannedTurns: [],
      },
    ];

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Relationship lin-mu-ally must include visibleLabel.'
    );
    expect(result.issues).toContain(
      'Relationship lin-mu-ally must include numeric trustLevel.'
    );
    expect(result.issues).toContain(
      'Relationship lin-mu-ally must include numeric tensionLevel.'
    );
    expect(result.issues).toContain(
      'Relationship lin-mu-ally must include currentState.'
    );
    expect(result.issues).toContain(
      'Relationship lin-mu-ally must include at least one plannedTurn.'
    );
  });

  it('rejects duplicate narrative bible graph ids before storage can overwrite them', () => {
    const bible = validBible();
    bible.characterArcs.push({
      ...bible.characterArcs[0],
      name: '重复角色',
    });
    bible.worldRules.push({
      ...bible.worldRules[0],
      ruleText: '重复规则。',
    });
    bible.narrativeThreads.push({
      ...bible.narrativeThreads[0],
      promise: '重复主线。',
    });
    bible.relationshipEdges = [
      {
        id: 'lin-mu-ally',
        fromCharacterId: 'lin-mu',
        toCharacterId: 'lin-mu',
        visibleLabel: '自我冲突',
        hiddenTruth: null,
        dependency: null,
        debt: null,
        misunderstanding: null,
        affection: null,
        harmPattern: null,
        sharedGoal: null,
        valueConflict: null,
        trustLevel: 1,
        tensionLevel: 5,
        currentState: '紧张。',
        plannedTurns: [{ chapterRange: '1-2', change: '加压。' }],
      },
      {
        id: 'lin-mu-ally',
        fromCharacterId: 'lin-mu',
        toCharacterId: 'lin-mu',
        visibleLabel: '重复关系',
        hiddenTruth: null,
        dependency: null,
        debt: null,
        misunderstanding: null,
        affection: null,
        harmPattern: null,
        sharedGoal: null,
        valueConflict: null,
        trustLevel: 1,
        tensionLevel: 5,
        currentState: '紧张。',
        plannedTurns: [{ chapterRange: '3-4', change: '反转。' }],
      },
    ];

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Character id lin-mu must not be duplicated.');
    expect(result.issues).toContain(
      'Relationship id lin-mu-ally must not be duplicated.'
    );
    expect(result.issues).toContain(
      'World rule id record-cost must not be duplicated.'
    );
    expect(result.issues).toContain(
      'Thread id main-ledger-truth must not be duplicated.'
    );
  });

  it('rejects invalid enum values in narrative bible output', () => {
    const bible = validBible();
    bible.characterArcs[0] = {
      ...bible.characterArcs[0],
      roleType: 'hero' as NarrativeBible['characterArcs'][number]['roleType'],
      arcDirection: 'sideways' as NarrativeBible['characterArcs'][number]['arcDirection'],
    };
    bible.worldRules[0] = {
      ...bible.worldRules[0],
      category: 'magic' as NarrativeBible['worldRules'][number]['category'],
    };
    bible.narrativeThreads[0] = {
      ...bible.narrativeThreads[0],
      type: 'primary' as NarrativeBible['narrativeThreads'][number]['type'],
      currentState: 'done' as NarrativeBible['narrativeThreads'][number]['currentState'],
      importance: 'urgent' as NarrativeBible['narrativeThreads'][number]['importance'],
      payoffMustChange: 'everything' as NarrativeBible['narrativeThreads'][number]['payoffMustChange'],
    };

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Character lin-mu has invalid roleType hero.');
    expect(result.issues).toContain(
      'Character lin-mu has invalid arcDirection sideways.'
    );
    expect(result.issues).toContain(
      'World rule record-cost has invalid category magic.'
    );
    expect(result.issues).toContain(
      'Thread main-ledger-truth has invalid type primary.'
    );
    expect(result.issues).toContain(
      'Thread main-ledger-truth has invalid currentState done.'
    );
    expect(result.issues).toContain(
      'Thread main-ledger-truth has invalid importance urgent.'
    );
    expect(result.issues).toContain(
      'Thread main-ledger-truth has invalid payoffMustChange everything.'
    );
  });
});

describe('validateVolumePlans', () => {
  it('requires continuous chapter coverage', () => {
    const volumes: VolumePlan[] = [
      {
        volumeIndex: 1,
        title: '命簿初鸣',
        chapterStart: 1,
        chapterEnd: 5,
        roleInStory: '建立追查目标。',
        mainPressure: '宗门追捕。',
        promisedPayoff: '发现账簿碎页。',
        characterArcMovement: '林牧开始信任同伴。',
        relationshipMovement: '师徒裂痕出现。',
        worldExpansion: '展示命簿代价。',
        endingTurn: '碎页指向师父。',
      },
      {
        volumeIndex: 2,
        title: '旧案反噬',
        chapterStart: 7,
        chapterEnd: 10,
        roleInStory: '扩大真相。',
        mainPressure: '各方夺页。',
        promisedPayoff: '确认林家并非叛徒。',
        characterArcMovement: '林牧承认自己也想掌控别人。',
        relationshipMovement: '同伴发现他隐瞒代价。',
        worldExpansion: '命簿影响凡人日常。',
        endingTurn: '旧盟友背叛。',
      },
    ];

    expect(validateVolumePlans(volumes, { targetChapters: 10 }).issues).toContain(
      'Volume 2 must start at chapter 6.'
    );
  });

  it('rejects volume plans with blank persistence fields', () => {
    const volumes: VolumePlan[] = [
      {
        volumeIndex: 1,
        title: '',
        chapterStart: 1,
        chapterEnd: 1,
        roleInStory: '',
        mainPressure: '',
        promisedPayoff: '',
        characterArcMovement: '',
        relationshipMovement: '',
        worldExpansion: '',
        endingTurn: '',
      },
    ];

    const result = validateVolumePlans(volumes, { targetChapters: 1 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Volume 1 must include title.');
    expect(result.issues).toContain('Volume 1 must include roleInStory.');
    expect(result.issues).toContain('Volume 1 must include mainPressure.');
    expect(result.issues).toContain('Volume 1 must include promisedPayoff.');
    expect(result.issues).toContain(
      'Volume 1 must include characterArcMovement.'
    );
    expect(result.issues).toContain(
      'Volume 1 must include relationshipMovement.'
    );
    expect(result.issues).toContain('Volume 1 must include worldExpansion.');
    expect(result.issues).toContain('Volume 1 must include endingTurn.');
  });

  it('rejects duplicate volume indexes before storage can overwrite them', () => {
    const volumes: VolumePlan[] = [
      {
        volumeIndex: 1,
        title: '命簿初鸣',
        chapterStart: 1,
        chapterEnd: 5,
        roleInStory: '建立追查目标。',
        mainPressure: '宗门追捕。',
        promisedPayoff: '发现账簿碎页。',
        characterArcMovement: '林牧开始信任同伴。',
        relationshipMovement: '师徒裂痕出现。',
        worldExpansion: '展示命簿代价。',
        endingTurn: '碎页指向师父。',
      },
      {
        volumeIndex: 1,
        title: '旧案反噬',
        chapterStart: 6,
        chapterEnd: 10,
        roleInStory: '扩大真相。',
        mainPressure: '各方夺页。',
        promisedPayoff: '确认林家并非叛徒。',
        characterArcMovement: '林牧承认自己也想掌控别人。',
        relationshipMovement: '同伴发现他隐瞒代价。',
        worldExpansion: '命簿影响凡人日常。',
        endingTurn: '旧盟友背叛。',
      },
    ];

    const result = validateVolumePlans(volumes, { targetChapters: 10 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Volume 1 must not be duplicated.');
  });
});

describe('validateChapterCards', () => {
  it('rejects cards without mustChange and external conflict', () => {
    const cards: ChapterCard[] = [
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        title: '',
        plotFunction: '',
        povCharacterId: 'lin-mu',
        externalConflict: '',
        internalConflict: '林牧想保密却需要求助。',
        relationshipChange: '林牧欠下同伴人情。',
        worldRuleUsedOrTested: '',
        informationReveal: '',
        readerReward: '' as ChapterCard['readerReward'],
        endingHook: '碎页浮现林家姓名。',
        mustChange: '',
        forbiddenMoves: 'not-an-array' as unknown as string[],
      },
    ];

    const result = validateChapterCards(cards, { targetChapters: 1 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Chapter 1 must include title.');
    expect(result.issues).toContain('Chapter 1 must include plotFunction.');
    expect(result.issues).toContain('Chapter 1 must include externalConflict.');
    expect(result.issues).toContain(
      'Chapter 1 must include worldRuleUsedOrTested.'
    );
    expect(result.issues).toContain('Chapter 1 must include informationReveal.');
    expect(result.issues).toContain('Chapter 1 must include readerReward.');
    expect(result.issues).toContain('Chapter 1 must include mustChange.');
    expect(result.issues).toContain('Chapter 1 must include forbiddenMoves array.');
  });

  it('rejects duplicate and out-of-range chapter cards', () => {
    const card: ChapterCard = {
      bookId: 'book-1',
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
    };

    const result = validateChapterCards(
      [
        card,
        { ...card, title: '重复旧页' },
        { ...card, chapterIndex: 3, title: '越界章节' },
      ],
      { targetChapters: 2 }
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Chapter card 1 must not be duplicated.');
    expect(result.issues).toContain(
      'Chapter card 3 exceeds target chapters 2.'
    );
    expect(result.issues).toContain('Chapter card 2 must exist.');
  });

  it('rejects invalid chapter card enum values', () => {
    const cards: ChapterCard[] = [
      {
        bookId: 'book-1',
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
        readerReward: 'surprise' as ChapterCard['readerReward'],
        endingHook: '碎页浮现林家姓名。',
        mustChange: '林牧从逃避变为主动追查。',
        forbiddenMoves: [],
      },
    ];

    const result = validateChapterCards(cards, { targetChapters: 1 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Chapter 1 has invalid readerReward surprise.'
    );
  });
});

function validTensionBudget(chapterIndex: number): ChapterTensionBudget {
  return {
    bookId: 'book-1',
    volumeIndex: 1,
    chapterIndex,
    pressureLevel: chapterIndex % 3 === 0 ? 'high' : 'medium',
    dominantTension:
      chapterIndex % 3 === 0
        ? 'moral_choice'
        : chapterIndex % 2 === 0
          ? 'relationship'
          : 'mystery',
    requiredTurn: `第 ${chapterIndex} 章出现不可忽视的局势转向。`,
    forcedChoice: '林牧必须在公开线索和保护同伴之间选择。',
    costToPay: '林牧失去一段可验证的记忆。',
    irreversibleChange: '林牧无法再回到旁观者身份。',
    readerQuestion: '真正操纵命簿的人是谁？',
    hookPressure: '章末出现更危险的命簿记录。',
    flatnessRisks: ['不要用解释代替冲突。'],
  };
}

describe('validateTensionBudgets', () => {
  it('accepts one complete budget per chapter', () => {
    expect(
      validateTensionBudgets([validTensionBudget(1), validTensionBudget(2)], {
        targetChapters: 2,
      })
    ).toEqual({ valid: true, issues: [] });
  });

  it('rejects missing budget and blank required fields', () => {
    const budget = {
      ...validTensionBudget(1),
      requiredTurn: '',
      forcedChoice: '',
      costToPay: '',
      irreversibleChange: '',
      readerQuestion: '',
      hookPressure: '',
      flatnessRisks: [],
    };

    const result = validateTensionBudgets([budget], { targetChapters: 2 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Tension budget 2 must exist.');
    expect(result.issues).toContain('Tension budget 1 must include requiredTurn.');
    expect(result.issues).toContain('Tension budget 1 must include forcedChoice.');
    expect(result.issues).toContain('Tension budget 1 must include costToPay.');
    expect(result.issues).toContain(
      'Tension budget 1 must include irreversibleChange.'
    );
    expect(result.issues).toContain('Tension budget 1 must include readerQuestion.');
    expect(result.issues).toContain('Tension budget 1 must include hookPressure.');
    expect(result.issues).toContain(
      'Tension budget 1 must include at least one flatnessRisk.'
    );
  });

  it('rejects more than three repeated dominant tension values', () => {
    const budgets = [1, 2, 3, 4].map((chapterIndex) => ({
      ...validTensionBudget(chapterIndex),
      dominantTension: 'mystery' as const,
    }));

    const result = validateTensionBudgets(budgets, { targetChapters: 4 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Tension budgets must not repeat dominantTension mystery for more than 3 consecutive chapters.'
    );
  });

  it('rejects three consecutive low-pressure chapters', () => {
    const budgets = [1, 2, 3].map((chapterIndex) => ({
      ...validTensionBudget(chapterIndex),
      pressureLevel: 'low' as const,
    }));

    const result = validateTensionBudgets(budgets, { targetChapters: 3 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Tension budgets must include medium or higher pressure within every 3 chapters.'
    );
  });

  it('rejects duplicate and out-of-range tension budgets', () => {
    const result = validateTensionBudgets(
      [
        validTensionBudget(1),
        validTensionBudget(1),
        validTensionBudget(3),
      ],
      { targetChapters: 2 }
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Tension budget 1 must not be duplicated.');
    expect(result.issues).toContain(
      'Tension budget 3 exceeds target chapters 2.'
    );
    expect(result.issues).toContain('Tension budget 2 must exist.');
  });

  it('rejects invalid tension budget enum values', () => {
    const result = validateTensionBudgets(
      [
        {
          ...validTensionBudget(1),
          pressureLevel: 'extreme' as ChapterTensionBudget['pressureLevel'],
          dominantTension: 'confusion' as ChapterTensionBudget['dominantTension'],
        },
      ],
      { targetChapters: 1 }
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContain(
      'Tension budget 1 has invalid pressureLevel extreme.'
    );
    expect(result.issues).toContain(
      'Tension budget 1 has invalid dominantTension confusion.'
    );
  });
});
