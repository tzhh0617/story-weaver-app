import { describe, expect, it } from 'vitest';
import {
  assertIpcPayload,
  ipcChannels,
  type BookDetail,
} from '../../src/shared/contracts';

function makeBookDetailContractFixture(): BookDetail {
  return {
    book: {
      id: 'book-1',
      title: '命簿',
      idea: '修复命簿的人发现家族被删除。',
      status: 'writing',
      targetChapters: 80,
      wordsPerChapter: 2200,
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    },
    context: {
      bookId: 'book-1',
      worldSetting: '主题问题：人能否摆脱命运？',
      outline: '第1卷 命簿初鸣: 1-10; 拿到碎页。',
      styleGuide: '中文网文。',
    },
    narrative: {
      storyBible: {
        themeQuestion: '人能否摆脱命运？',
        themeAnswerDirection: '自由来自承担代价。',
        centralDramaticQuestion: '林牧能否改写命簿？',
      },
      bookContract: {
        bookId: 'book-1',
        titlePromise: '命簿现世，改命必有代价。',
        corePremise: '修复命簿的人发现家族被删除。',
        mainlinePromise: '林牧必须在保住至亲和改写命簿之间做选择。',
        protagonistCoreDesire: '夺回林家被删除的人生。',
        protagonistNoDriftRules: ['不能放弃改命主线。'],
        keyCharacterBoundaries: [
          {
            characterId: 'lin-mu',
            publicPersona: '沉静的抄录员',
            hiddenDrive: '夺回家族存在',
            lineWillNotCross: '不会主动献祭无辜者',
            lineMayEventuallyCross: '会牺牲自身寿命',
          },
        ],
        mandatoryPayoffs: ['揭开林家被删除真相。'],
        antiDriftRules: ['每卷推进命簿删除真相。'],
        activeTemplate: 'mystery_serial',
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
      },
      latestLedger: {
        bookId: 'book-1',
        chapterIndex: 12,
        mainlineProgress: '林牧确认命簿缺页与林家旧案有关。',
        activeSubplots: [
          {
            threadId: 'sect-investigation',
            label: '师门调查',
            status: 'active',
            lastMovedChapter: 11,
            targetPayoffChapter: 15,
          },
          {
            threadId: 'archive-trail',
            label: '旧档案追查',
            status: 'cooling',
            lastMovedChapter: 10,
            targetPayoffChapter: null,
          },
        ],
        openPromises: [
          {
            promiseId: 'missing-pages',
            promise: '缺页下落',
            introducedAtChapter: 1,
            targetPayoffChapter: 14,
            priority: 'critical',
          },
          {
            promiseId: 'eraser-identity',
            promise: '幕后删除者身份',
            introducedAtChapter: 3,
            targetPayoffChapter: 20,
            priority: 'normal',
          },
        ],
        characterTruths: [
          {
            characterId: 'lin-mu',
            truth: '林牧知道父亲死因可能是伪造。',
            sourceChapter: 12,
            stability: 'volatile',
          },
        ],
        relationshipDeltas: [
          {
            relationshipId: 'linmu-shenyan',
            summary: '林牧与沈砚暂时结盟。',
            direction: 'improving',
            sourceChapter: 12,
          },
        ],
        worldFacts: [
          {
            factId: 'ledger-backlash',
            fact: '命簿能删除存在痕迹，但会留下反噬。',
            sourceChapter: 8,
            scope: 'systemic',
          },
        ],
        rhythmPosition: 'twist',
        riskFlags: [
          {
            code: 'payoff_gap',
            message: '连续两章未兑现师门线索',
            severity: 'major',
          },
        ],
        createdAt: '2026-04-30T00:12:00.000Z',
      },
      latestCheckpoint: {
        bookId: 'book-1',
        chapterIndex: 10,
        checkpointType: 'heavy',
        createdAt: '2026-04-30T00:10:00.000Z',
      },
      runState: {
        phase: 'chapter_window_ready',
        driftLevel: 'light',
        currentChapter: 12,
        starvationScore: 2,
        lastHealthyCheckpointChapter: 10,
        latestFailureReason: null,
        cooldownUntil: null,
      },
      chapterCards: [
        {
          volumeIndex: 1,
          chapterIndex: 1,
          mustChange: '林牧主动追查。',
          readerReward: 'truth',
          endingHook: '旧页浮现林家姓名。',
        },
      ],
      chapterTensionBudgets: [
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
      ],
      narrativeCheckpoints: [
        {
          bookId: 'book-1',
          chapterIndex: 10,
          checkpointType: 'arc',
          report: {
            checkpointType: 'arc',
            tensionCheckpoint: {
              nextBudgetInstruction:
                'Switch dominant tension in the next 2 chapters.',
            },
          },
          futureCardRevisions: [
            {
              type: 'tension_budget_rebalance',
              instruction: 'Switch dominant tension in the next 2 chapters.',
            },
          ],
          createdAt: '2026-04-30T00:10:00.000Z',
        },
      ],
    },
    chapters: [
      {
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex: 1,
        title: '旧页初鸣',
        outline: '必须变化：林牧主动追查。',
        content: null,
        summary: null,
        wordCount: 0,
        auditScore: 88,
        auditFlatnessScore: 74,
        auditFlatnessIssues: [
          {
            type: 'weak_choice_pressure',
            severity: 'major',
            evidence: '角色只是被线索推着走。',
            fixInstruction: '让角色主动做一个会损失关系信任的选择。',
          },
        ],
        draftAttempts: 1,
      },
    ],
    characterStates: [],
    plotThreads: [],
    latestScene: null,
    progress: null,
  };
}

describe('ipcChannels', () => {
  it('defines the required book and scheduler channels', () => {
    expect(ipcChannels.bookCreate).toBe('book:create');
    expect(ipcChannels.schedulerStatus).toBe('scheduler:status');
    expect(ipcChannels.bookError).toBe('book:error');
    expect(ipcChannels.executionLog).toBe('logs:event');
    expect('logsList' in ipcChannels).toBe(false);
  });

  it('validates payload-bearing IPC channels at runtime', () => {
    expect(() =>
      assertIpcPayload(ipcChannels.bookDetail, { bookId: 'book-1' })
    ).not.toThrow();
    expect(() =>
      assertIpcPayload(ipcChannels.bookExport, {
        bookId: 'book-1',
        format: 'md',
      })
    ).not.toThrow();
    expect(() =>
      assertIpcPayload(ipcChannels.bookList, undefined)
    ).not.toThrow();

    expect(() =>
      assertIpcPayload(ipcChannels.bookDetail, { bookId: '' })
    ).toThrow('Invalid payload for book:detail');
    expect(() =>
      assertIpcPayload(ipcChannels.bookExport, {
        bookId: 'book-1',
        format: 'pdf',
      })
    ).toThrow('Invalid payload for book:export');
    expect(() =>
      assertIpcPayload(ipcChannels.settingsSet, {
        key: 'scheduler.concurrencyLimit',
        value: 2,
      })
    ).toThrow('Invalid payload for settings:set');
    expect(() =>
      assertIpcPayload(ipcChannels.settingsSet, {
        key: 'logs.maxFileSizeBytes',
        value: '1048576',
      })
    ).not.toThrow();
    expect(() =>
      assertIpcPayload(ipcChannels.settingsSet, {
        key: 'logs.retentionDays',
        value: '14',
      })
    ).not.toThrow();
  });

  it('accepts optional viral strategy in book creation payloads', () => {
    expect(() =>
      assertIpcPayload(ipcChannels.bookCreate, {
        idea: '旧案复仇',
        targetChapters: 500,
        wordsPerChapter: 2500,
        viralStrategy: {
          readerPayoff: 'revenge',
          protagonistDesire: '洗清旧案',
          tropeContracts: ['revenge_payback'],
          cadenceMode: 'steady',
          antiClicheDirection: '反派不降智',
        },
      })
    ).not.toThrow();

    expect(() =>
      assertIpcPayload(ipcChannels.bookCreate, {
        idea: '旧案复仇',
        targetChapters: 500,
        wordsPerChapter: 2500,
        viralStrategy: {
          readerPayoff: 'revenge',
          tropeContracts: ['revenge_payback'],
          cadenceMode: 'not-a-mode',
        },
      })
    ).toThrow('Invalid payload for book:create');
  });

  it('book detail supports narrative records while retaining existing display fields', () => {
    const detail = makeBookDetailContractFixture();

    expect(detail.context?.worldSetting).toEqual(expect.any(String));
    expect(detail.context?.outline).toEqual(expect.any(String));
    expect(detail.narrative?.storyBible?.themeQuestion).toEqual(expect.any(String));
    expect(detail.narrative?.bookContract).toMatchObject({
      activeTemplate: 'mystery_serial',
      mainlinePromise: expect.any(String),
    });
    expect(detail.narrative?.bookContract?.keyCharacterBoundaries[0]).toMatchObject({
      characterId: 'lin-mu',
      publicPersona: '沉静的抄录员',
      lineWillNotCross: '不会主动献祭无辜者',
    });
    expect(detail.narrative?.latestLedger).toMatchObject({
      chapterIndex: 12,
      rhythmPosition: 'twist',
    });
    expect(detail.narrative?.latestLedger?.activeSubplots[0]).toMatchObject({
      threadId: 'sect-investigation',
      status: 'active',
      targetPayoffChapter: 15,
    });
    expect(detail.narrative?.latestLedger?.characterTruths[0]).toMatchObject({
      characterId: 'lin-mu',
      stability: 'volatile',
    });
    expect(detail.narrative?.latestLedger?.worldFacts[0]).toMatchObject({
      factId: 'ledger-backlash',
      scope: 'systemic',
    });
    expect(detail.narrative?.latestLedger?.openPromises[0]).toMatchObject({
      promiseId: 'missing-pages',
      priority: 'critical',
    });
    expect(detail.narrative?.latestLedger?.relationshipDeltas[0]).toMatchObject({
      direction: 'improving',
      sourceChapter: 12,
    });
    expect(detail.narrative?.latestLedger?.riskFlags[0]).toMatchObject({
      code: 'payoff_gap',
      severity: 'major',
    });
    expect(detail.narrative?.latestCheckpoint).toMatchObject({
      bookId: 'book-1',
      chapterIndex: 10,
      checkpointType: 'heavy',
      createdAt: '2026-04-30T00:10:00.000Z',
    });
    expect(detail.narrative?.runState).toMatchObject({
      phase: 'chapter_window_ready',
      currentChapter: 12,
      driftLevel: 'light',
      starvationScore: 2,
      latestFailureReason: null,
      cooldownUntil: null,
    });
    expect(Array.isArray(detail.narrative?.chapterCards)).toBe(true);
    expect(detail.narrative?.chapterTensionBudgets[0]).toMatchObject({
      chapterIndex: 1,
      pressureLevel: 'high',
      dominantTension: 'moral_choice',
    });
    expect(detail.narrative?.narrativeCheckpoints[0]).toMatchObject({
      chapterIndex: 10,
      checkpointType: 'arc',
    });
    expect(detail.chapters[0]?.auditScore).toBe(88);
    expect(detail.chapters[0]?.auditFlatnessScore).toBe(74);
    expect(detail.chapters[0]?.auditFlatnessIssues?.[0]).toMatchObject({
      type: 'weak_choice_pressure',
      severity: 'major',
    });
  });
});
