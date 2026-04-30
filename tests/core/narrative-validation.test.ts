import { describe, expect, it } from 'vitest';
import {
  validateChapterCards,
  validateNarrativeBible,
  validateVolumePlans,
} from '../../src/core/narrative/validation';
import type {
  ChapterCard,
  NarrativeBible,
  VolumePlan,
} from '../../src/core/narrative/types';

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
    bible.characterArcs[0] = { ...bible.characterArcs[0], desire: '' };
    bible.worldRules[0] = { ...bible.worldRules[0], cost: '' };

    const result = validateNarrativeBible(bible, { targetChapters: 30 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Character lin-mu must include desire.');
    expect(result.issues).toContain('World rule record-cost must include cost.');
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
});

describe('validateChapterCards', () => {
  it('rejects cards without mustChange and external conflict', () => {
    const cards: ChapterCard[] = [
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        title: '旧页',
        plotFunction: '开局。',
        povCharacterId: 'lin-mu',
        externalConflict: '',
        internalConflict: '林牧想保密却需要求助。',
        relationshipChange: '林牧欠下同伴人情。',
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: '命簿会吞记忆。',
        readerReward: 'truth',
        endingHook: '碎页浮现林家姓名。',
        mustChange: '',
        forbiddenMoves: [],
      },
    ];

    const result = validateChapterCards(cards, { targetChapters: 1 });

    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Chapter 1 must include externalConflict.');
    expect(result.issues).toContain('Chapter 1 must include mustChange.');
  });
});
