import { describe, expect, it } from 'vitest';
import type { NarrativeBible } from '../../src/core/narrative/types';
import {
  deriveViralStoryProtocol,
  formatViralProtocolForPrompt,
  getExpectedPayoffForChapter,
  validateViralStoryProtocol,
} from '../../src/core/narrative/viral-story-protocol';

function bible(overrides: Partial<NarrativeBible> = {}): NarrativeBible {
  return {
    premise: '被逐出宗门的少年发现旧案仍在吞噬同门命数。',
    genreContract: '仙侠复仇升级，宗门压迫，旧案揭密。',
    targetReaderExperience: '压抑后翻盘，持续真相突破。',
    themeQuestion: '弱者能否夺回命运解释权？',
    themeAnswerDirection: '真正的翻盘来自承担代价后的主动选择。',
    centralDramaticQuestion: '陆照能否查清旧案并反制宗门戒律？',
    endingState: {
      protagonistWins: '陆照夺回命簿解释权。',
      protagonistLoses: '他失去被宗门承认的旧身份。',
      worldChange: '宗门戒律被公开审判。',
      relationshipOutcome: '旧同盟因真相重组。',
      themeAnswer: '自由需要付出被误解的代价。',
    },
    voiceGuide: '紧凑中文网文，压迫感强，动作推动心理。',
    characterArcs: [
      {
        id: 'lu-zhao',
        name: '陆照',
        roleType: 'protagonist',
        desire: '洗清旧案并夺回命运解释权。',
        fear: '再次被宗门定义为罪人。',
        flaw: '习惯独自承担。',
        misbelief: '只要证明清白就能回到旧秩序。',
        wound: '被逐出山门。',
        externalGoal: '找到旧案证据。',
        internalNeed: '承认旧秩序本身有罪。',
        arcDirection: 'growth',
        decisionLogic: '先保护证据，再保护关系。',
        lineWillNotCross: '不牺牲无辜同门。',
        lineMayEventuallyCross: '公开挑战宗门戒律。',
        currentArcPhase: '被动求生。',
      },
    ],
    relationshipEdges: [],
    worldRules: [
      {
        id: 'fate-ledger-cost',
        category: 'power',
        ruleText: '命簿能改写记录。',
        cost: '每次改写都会失去一段被珍视的记忆。',
        whoBenefits: '执律堂',
        whoSuffers: '被记录者',
        taboo: '私自翻页',
        violationConsequence: '被宗门追捕',
        allowedException: null,
        currentStatus: '被隐藏',
      },
    ],
    narrativeThreads: [
      {
        id: 'main-old-case',
        type: 'main',
        promise: '旧案真相会反转宗门正义。',
        plantedAt: 1,
        expectedPayoff: 40,
        resolvedAt: null,
        currentState: 'open',
        importance: 'critical',
        payoffMustChange: 'plot',
        ownerCharacterId: 'lu-zhao',
        relatedRelationshipId: null,
        notes: null,
      },
    ],
    ...overrides,
  };
}

describe('viral story protocol', () => {
  it('derives a protocol from the narrative bible when none exists', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
    });

    expect(protocol.readerPromise).toContain('压抑后翻盘');
    expect(protocol.coreDesire).toContain('洗清旧案');
    expect(protocol.hookEngine).toContain('旧案');
    expect(protocol.payoffCadence.minorPayoffEveryChapters).toBe(2);
    expect(protocol.payoffCadence.majorPayoffEveryChapters).toBe(8);
    expect(protocol.tropeContract).toContain('weak_to_strong');
    expect(protocol.antiClicheRules).toContain(
      '每次翻盘必须付出记忆、关系、资源或身份代价。'
    );
  });

  it('keeps explicit protocol values from the bible', () => {
    const explicit = deriveViralStoryProtocol(
      bible({
        viralStoryProtocol: {
          readerPromise: '被所有人低估后，用真相和代价逐层反杀。',
          targetEmotion: 'revenge',
          coreDesire: '让旧案审判者付出代价。',
          protagonistDrive: '每次失去都逼他主动出手。',
          hookEngine: '每个证据都会指向更高层的伪证者。',
          payoffCadence: {
            mode: 'steady',
            minorPayoffEveryChapters: 3,
            majorPayoffEveryChapters: 12,
            payoffTypes: ['truth_reveal', 'enemy_setback'],
          },
          tropeContract: ['revenge_payback', 'weak_to_strong'],
          antiClicheRules: ['反派不能无理由降智。'],
          longTermQuestion: '真正改写命簿的人是谁？',
        },
      }),
      { targetChapters: 80 }
    );

    expect(explicit.readerPromise).toBe(
      '被所有人低估后，用真相和代价逐层反杀。'
    );
    expect(explicit.payoffCadence.minorPayoffEveryChapters).toBe(3);
    expect(explicit.antiClicheRules).toEqual(['反派不能无理由降智。']);
  });

  it('uses create-time viral strategy as derivation input', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
      viralStrategy: {
        readerPayoff: '复仇清算',
        protagonistDesire: '让伪证者付出代价。',
        tropeContracts: ['revenge_payback'],
        cadenceMode: 'suppressed_then_burst',
        antiClicheDirection: '胜利必须来自证据链，不来自身份碾压。',
      },
    });

    expect(protocol.readerPromise).toBe('复仇清算');
    expect(protocol.coreDesire).toBe('让伪证者付出代价。');
    expect(protocol.payoffCadence.mode).toBe('suppressed_then_burst');
    expect(protocol.tropeContract).toEqual(['revenge_payback']);
    expect(protocol.antiClicheRules[0]).toBe(
      '胜利必须来自证据链，不来自身份碾压。'
    );
  });

  it('validates required protocol fields', () => {
    expect(
      validateViralStoryProtocol({
        readerPromise: '',
        targetEmotion: 'revenge',
        coreDesire: '复仇',
        protagonistDrive: '主动查案',
        hookEngine: '旧案递进',
        payoffCadence: {
          mode: 'steady',
          minorPayoffEveryChapters: 2,
          majorPayoffEveryChapters: 8,
          payoffTypes: ['truth_reveal'],
        },
        tropeContract: ['revenge_payback'],
        antiClicheRules: ['反派不降智。'],
        longTermQuestion: '幕后是谁？',
      })
    ).toEqual({
      valid: false,
      issues: ['Viral story protocol must include readerPromise.'],
    });
  });

  it('formats a stable prompt block', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
    });

    const text = formatViralProtocolForPrompt(protocol, {
      chapterIndex: 4,
    });

    expect(text).toContain('Viral Story Protocol');
    expect(text).toContain('Reader promise:');
    expect(text).toContain('Current chapter expected payoff: minor payoff');
    expect(text).toContain('Anti-cliche rules:');
  });

  it('calculates expected payoff from cadence', () => {
    const protocol = deriveViralStoryProtocol(bible(), {
      targetChapters: 80,
    });

    expect(getExpectedPayoffForChapter(protocol, 2)).toBe('minor payoff');
    expect(getExpectedPayoffForChapter(protocol, 8)).toBe('major payoff');
    expect(getExpectedPayoffForChapter(protocol, 9)).toBe('pressure setup');
  });
});
