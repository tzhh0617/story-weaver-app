import { describe, expect, it } from 'vitest';
import {
  type BookDetail,
  type BookCreateRequest,
  type BookCreateResponse,
  type BookExportRequest,
  type BookExportResponse,
  type ModelTestResponse,
  type OkResponse,
  type SettingValueResponse,
} from '@story-weaver/shared/contracts';

function makeBookDetailContractFixture(): BookDetail {
  return {
    book: {
      id: 'book-1',
      title: '命簿',
      titleGenerationStatus: 'manual',
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

describe('shared contracts', () => {
  it('book detail supports narrative records while retaining existing display fields', () => {
    const detail = makeBookDetailContractFixture();

    expect(detail.context?.worldSetting).toEqual(expect.any(String));
    expect(detail.context?.outline).toEqual(expect.any(String));
    expect(detail.narrative?.storyBible?.themeQuestion).toEqual(expect.any(String));
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

describe('concrete server API contracts', () => {
  it('exports named request and response contracts for concrete routes', () => {
    const createRequest: BookCreateRequest = {
      idea: 'A library that writes itself.',
      targetChapters: 2,
      wordsPerChapter: 1200,
    };
    const createResponse: BookCreateResponse = { bookId: 'book-1' };
    const exportRequest: BookExportRequest = { format: 'txt' };
    const exportResponse: BookExportResponse = {
      filePath: '/tmp/story-weaver/book.txt',
      downloadUrl: '/api/exports/export-1',
    };
    const modelTest: ModelTestResponse = {
      ok: true,
      latency: 42,
      error: null,
    };
    const settingValue: SettingValueResponse = {
      key: 'scheduler.concurrencyLimit',
      value: '2',
    };
    const ok: OkResponse = { ok: true };

    expect(createRequest.targetChapters).toBe(2);
    expect(createResponse.bookId).toBe('book-1');
    expect(exportRequest.format).toBe('txt');
    expect(exportResponse.downloadUrl).toBe('/api/exports/export-1');
    expect(modelTest.ok).toBe(true);
    expect(settingValue.value).toBe('2');
    expect(ok.ok).toBe(true);
  });
});
