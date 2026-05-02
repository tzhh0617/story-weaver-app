import { describe, expect, it } from 'vitest';
import {
  buildChapterAuditPrompt,
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildNarrativeDraftPrompt,
  buildRevisionPrompt,
  buildTensionBudgetPrompt,
  buildVolumePlanPrompt,
  parseJsonObject,
} from '@story-weaver/backend/core/narrative/prompts';

const viralProtocol = {
  readerPromise: '压抑后翻盘。',
  targetEmotion: 'revenge' as const,
  coreDesire: '洗清旧案。',
  protagonistDrive: '证据每次出现都会带来更大代价。',
  hookEngine: '旧案证据逐层指向宗门高层。',
  payoffCadence: {
    mode: 'steady' as const,
    minorPayoffEveryChapters: 2,
    majorPayoffEveryChapters: 8,
    payoffTypes: ['truth_reveal' as const, 'enemy_setback' as const],
  },
  tropeContract: ['revenge_payback' as const, 'weak_to_strong' as const],
  antiClicheRules: ['每次反击必须付出代价。'],
  longTermQuestion: '谁改写了旧案？',
};

describe('narrative prompts', () => {
  it('anchors narrative planning prompts to the book title', () => {
    expect(
      buildNarrativeBiblePrompt({
        title: '月税奇谈',
        idea: '一个修复命簿的人发现自己的家族被命运删除。',
        targetChapters: 80,
        wordsPerChapter: 2200,
      })
    ).toContain('Book title: 月税奇谈');

    expect(
      buildVolumePlanPrompt({
        title: '月税奇谈',
        targetChapters: 80,
        bibleSummary: '主题：自由的代价。',
        viralStoryProtocol: viralProtocol,
      })
    ).toContain('Book title: 月税奇谈');

    expect(
      buildChapterCardPrompt({
        title: '月税奇谈',
        bookId: 'book-1',
        targetChapters: 3,
        bibleSummary: '主题：自由的代价。',
        volumePlansText: '第一卷：旧页初鸣，1-3章。',
      })
    ).toContain('Book title: 月税奇谈');
  });

  it('omits book-title reader promise guidance when no title is provided', () => {
    const prompt = buildNarrativeBiblePrompt({
      idea: '一个修复命簿的人发现自己的家族被命运删除。',
      targetChapters: 80,
      wordsPerChapter: 2200,
    });

    expect(prompt).not.toContain('Book title:');
    expect(prompt).not.toContain('Treat the book title as a reader promise');
  });

  it('requires costly rules and character arc anchors in bible prompts', () => {
    const prompt = buildNarrativeBiblePrompt({
      idea: '一个修复命簿的人发现自己的家族被命运删除。',
      targetChapters: 80,
      wordsPerChapter: 2200,
    });

    expect(prompt).toContain('Return valid JSON only');
    expect(prompt).toContain('desire');
    expect(prompt).toContain('fear');
    expect(prompt).toContain('flaw');
    expect(prompt).toContain('cost');
    expect(prompt).toContain('themeAnswerDirection');
    expect(prompt).toContain('characterArcs array');
    expect(prompt).toContain('relationshipEdges array');
    expect(prompt).toContain('worldRules array');
    expect(prompt).toContain('narrativeThreads array');
    expect(prompt).toContain('visibleLabel');
    expect(prompt).toContain('trustLevel');
    expect(prompt).toContain('plannedTurns');
  });

  it('requires volume plans to include volumeIndex for persistence', () => {
    const prompt = buildVolumePlanPrompt({
      targetChapters: 80,
      bibleSummary: '主题：自由的代价。',
    });

    expect(prompt).toContain('volumeIndex');
    expect(prompt).toContain('chapterStart');
    expect(prompt).toContain('chapterEnd');
  });

  it('requires chapter cards to include mustChange and readerReward', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 3,
      bibleSummary: '主题：自由的代价。',
      volumePlansText: '第一卷：旧页初鸣，1-3章。',
    });

    expect(prompt).toContain('mustChange');
    expect(prompt).toContain('readerReward');
    expect(prompt).toContain('forbiddenMoves');
    expect(prompt).toContain('threadActions items must include');
    expect(prompt).toContain('characterPressures items must include');
    expect(prompt).toContain('relationshipActions items must include');
  });

  it('injects the opening retention protocol into chapter card prompts', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '题材：命运悬疑。',
      volumePlansText: '第一卷：旧页初鸣，1-20章。',
    });

    expect(prompt).toContain('Opening Retention Protocol');
    expect(prompt).toContain('Chapter 1: abnormal entry');
    expect(prompt).toContain('make the title promise visible');
    expect(prompt).toContain('Chapter 2: rising cost');
    expect(prompt).toContain('show that it belongs to the mainline');
    expect(prompt).toContain('Chapter 3: irreversible entry');
    expect(prompt).toContain('locks the story onto the main thread');
    expect(prompt).toContain('Chapter 4: first clear reward');
    expect(prompt).toContain('Chapter 5: long-term hostility');
  });

  it('adds title promise and mainline entry guidance for short-book openings', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 4,
      bibleSummary: '题材：命运悬疑。',
      volumePlansText: '第一卷：旧页初鸣，1-4章。',
    });

    expect(prompt).toContain('establishes the title promise');
    expect(prompt).toContain('commits the protagonist to the mainline');
  });

  it('draft prompt includes command context and forbids explanation', () => {
    const prompt = buildNarrativeDraftPrompt({
      idea: '命簿',
      wordsPerChapter: 2000,
      commandContext: 'Chapter Mission: 林牧必须主动追查。',
    });

    expect(prompt).toContain('Return only the final chapter prose');
    expect(prompt).toContain('Do not include any chapter title');
    expect(prompt).toContain('Chapter Mission');
    expect(prompt).toContain('approximately 2000 Chinese characters');
  });

  it('centralizes AI-first style constraints in narrative draft and revision prompts', () => {
    const draftPrompt = buildNarrativeDraftPrompt({
      idea: '命簿',
      wordsPerChapter: 2000,
      commandContext: 'Chapter Mission: 林牧必须主动追查。',
    });
    const revisionPrompt = buildRevisionPrompt({
      originalPrompt: '写第一章。',
      draft: '林牧直接胜利。',
      issues: [
        {
          type: 'pacing_problem',
          severity: 'major',
          evidence: '没有动作推进。',
          fixInstruction: '改成通过动作和对话推进。',
        },
      ],
    });

    for (const prompt of [draftPrompt, revisionPrompt]) {
      expect(prompt).toContain('AI-first text policy');
      expect(prompt).toContain(
        'The model is responsible for producing text that already satisfies the requested style and format.'
      );
      expect(prompt).toContain(
        'Use Chinese web novel prose: short readable paragraphs, visible conflict, action and dialogue over exposition, and a forward-driving ending hook.'
      );
    }
  });

  it('injects story route plans into draft prompts', () => {
    const prompt = buildNarrativeDraftPrompt({
      idea: '命簿',
      wordsPerChapter: 2000,
      commandContext: 'Chapter Mission: 林牧必须主动追查。',
      routePlanText:
        'Story Skill Route Plan\nRequired Skills\n- story-structure',
    });

    expect(prompt).toContain('Story Skill Route Plan');
    expect(prompt).toContain('Required Skills');
    expect(prompt).toContain('story-structure');
    expect(prompt).toContain('Chapter Mission');
  });

  it('injects story route plans into audit prompts', () => {
    const prompt = buildChapterAuditPrompt({
      draft: '林牧直接改写命簿，没有代价。',
      auditContext: 'World Rule and Cost: 改写命簿会失去记忆。',
      routePlanText: 'Story Skill Route Plan\nRed Flags\n- 章末没有追读压力。',
    });

    expect(prompt).toContain('Story Skill Route Plan');
    expect(prompt).toContain('Red Flags');
    expect(prompt).toContain('章末没有追读压力。');
    expect(prompt).toContain('world_rule_violation');
  });

  it('audit and revision prompts carry issues into the fix request', () => {
    expect(
      buildChapterAuditPrompt({
        draft: '林牧直接改写命簿，没有代价。',
        auditContext: 'World Rule and Cost: 改写命簿会失去记忆。',
      })
    ).toContain('world_rule_violation');

    expect(
      buildRevisionPrompt({
        originalPrompt: '写第一章。',
        draft: '林牧直接胜利。',
        issues: [
          {
            type: 'world_rule_violation',
            severity: 'major',
            evidence: '没有体现代价。',
            fixInstruction: '加入记忆损失。',
          },
        ],
      })
    ).toContain('加入记忆损失');
  });

  it('builds a tension budget prompt with anti-flatness requirements', () => {
    const prompt = buildTensionBudgetPrompt({
      bookId: 'book-1',
      targetChapters: 3,
      bibleSummary: 'theme: freedom requires cost',
      volumePlansText: 'Volume 1: chapters 1-3',
      chapterCardsText: 'Chapter 1: must change',
    });

    expect(prompt).toContain('Create tension budgets');
    expect(prompt).toContain('forcedChoice');
    expect(prompt).toContain('costToPay');
    expect(prompt).toContain('irreversibleChange');
    expect(prompt).toContain('hookPressure');
    expect(prompt).toContain('Do not assign the same dominantTension');
  });

  it('injects the opening tension curve into tension budget prompts', () => {
    const prompt = buildTensionBudgetPrompt({
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: 'theme: freedom requires cost',
      volumePlansText: 'Volume 1: chapters 1-20',
      chapterCardsText: 'Chapter 1: must change',
    });

    expect(prompt).toContain('Opening Retention Protocol');
    expect(prompt).toContain('Recommended opening pressure curve');
    expect(prompt).toContain('medium -> high -> peak -> medium/high -> high');
    expect(prompt).toContain('Do not solve all opening questions by chapter 5');
  });

  it('compresses opening retention guidance for short books', () => {
    const prompt = buildChapterCardPrompt({
      bookId: 'book-1',
      targetChapters: 3,
      bibleSummary: '题材：短篇悬疑。',
      volumePlansText: '第一卷：1-3章。',
    });

    expect(prompt).toContain('Compressed opening retention for short books');
    expect(prompt).toContain('Chapter 1 still performs abnormal entry');
    expect(prompt).toContain(
      'The final available opening chapter performs irreversible entry'
    );
  });

  it('asks audits to score flatness', () => {
    const prompt = buildChapterAuditPrompt({
      draft: '林牧翻开旧页。',
      auditContext: 'Tension Budget: forcedChoice=保密或求助',
    });

    expect(prompt).toContain('flatness');
    expect(prompt).toContain('choice');
    expect(prompt).toContain('consequence');
    expect(prompt).toContain('ending create forward pressure');
  });

  it('injects viral protocol guidance into planning prompts', () => {
    expect(
      buildNarrativeBiblePrompt({
        idea: '旧案复仇',
        targetChapters: 80,
        wordsPerChapter: 2500,
      })
    ).toContain('viralStoryProtocol');

    expect(
      buildChapterCardPrompt({
        bookId: 'book-1',
        targetChapters: 80,
        bibleSummary: '旧案复仇。',
        volumePlansText: '第一卷：1-20章。',
        viralStoryProtocol: viralProtocol,
      })
    ).toContain('Viral Story Protocol');

    expect(
      buildTensionBudgetPrompt({
        bookId: 'book-1',
        targetChapters: 80,
        bibleSummary: '旧案复仇。',
        volumePlansText: '第一卷：1-20章。',
        chapterCardsText: 'Chapter 1: 入局。',
        viralStoryProtocol: viralProtocol,
      })
    ).toContain('costToPay must connect to this chapter payoff');
  });

  it('injects story arc control into planning, drafting, audit, and revision prompts', () => {
    const biblePrompt = buildNarrativeBiblePrompt({
      title: '命簿旧债',
      idea: '一个修复命簿的人发现自己的家族被命运删除。',
      targetChapters: 80,
      wordsPerChapter: 2200,
    });
    const volumePrompt = buildVolumePlanPrompt({
      title: '命簿旧债',
      targetChapters: 80,
      bibleSummary: '主线：命簿旧债必须偿还。',
      viralStoryProtocol: viralProtocol,
    });
    const cardPrompt = buildChapterCardPrompt({
      title: '命簿旧债',
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '主线：命簿旧债必须偿还。',
      volumePlansText: '第一卷：旧债初鸣，1-20章。',
      viralStoryProtocol: viralProtocol,
    });
    const tensionPrompt = buildTensionBudgetPrompt({
      title: '命簿旧债',
      bookId: 'book-1',
      targetChapters: 80,
      bibleSummary: '主线：命簿旧债必须偿还。',
      volumePlansText: '第一卷：旧债初鸣，1-20章。',
      chapterCardsText: 'Chapter 1: 旧债入场。',
      viralStoryProtocol: viralProtocol,
    });
    const draftPrompt = buildNarrativeDraftPrompt({
      title: '命簿旧债',
      idea: '旧案复仇',
      wordsPerChapter: 2500,
      commandContext: 'Chapter Mission: 林牧必须发现旧债代价。',
      viralStoryProtocol: viralProtocol,
      chapterIndex: 2,
    });
    const auditPrompt = buildChapterAuditPrompt({
      draft: '林牧发现旧债，却没有选择或后果。',
      auditContext: 'Chapter Mission: 旧债入局。',
      viralStoryProtocol: viralProtocol,
      chapterIndex: 2,
    });
    const revisionPrompt = buildRevisionPrompt({
      originalPrompt: draftPrompt,
      draft: '林牧发现旧债，却没有选择或后果。',
      issues: [
        {
          type: 'pacing_problem',
          severity: 'major',
          evidence: '章节离开旧债主线。',
          fixInstruction: '让旧债造成具体选择和代价。',
        },
      ],
    });

    for (const prompt of [
      biblePrompt,
      volumePrompt,
      cardPrompt,
      tensionPrompt,
      draftPrompt,
      auditPrompt,
      revisionPrompt,
    ]) {
      expect(prompt).toContain('Story Arc Control Protocol');
      expect(prompt).toContain('Title Promise Control');
      expect(prompt).toContain('Mainline Control');
      expect(prompt).toContain('Ending Control');
    }
    expect(auditPrompt).toContain('weak_title_promise');
    expect(auditPrompt).toContain('mainline_drift');
    expect(auditPrompt).toContain('loose_ending');
    expect(auditPrompt).toContain('unearned_hook');
  });

  it('injects viral protocol into draft and audit prompts', () => {
    const draftPrompt = buildNarrativeDraftPrompt({
      idea: '旧案复仇',
      wordsPerChapter: 2500,
      commandContext: 'Chapter Mission: 入局。',
      viralStoryProtocol: viralProtocol,
      chapterIndex: 2,
    });

    expect(draftPrompt).toContain('Viral Story Protocol');
    expect(draftPrompt).toContain('Current chapter expected payoff: minor payoff');

    const auditPrompt = buildChapterAuditPrompt({
      draft: '陆照赢了，但没有代价。',
      auditContext: 'Chapter Mission: 入局。',
      viralStoryProtocol: viralProtocol,
      chapterIndex: 2,
    });

    expect(auditPrompt).toContain('scoring.viral');
    expect(auditPrompt).toContain('payoff_without_cost');
    expect(auditPrompt).toContain('antiClicheFreshness');
  });
});

describe('parseJsonObject', () => {
  it('strips markdown code fences before parsing JSON', () => {
    expect(parseJsonObject<{ ok: boolean }>('```json\n{"ok":true}\n```')).toEqual({
      ok: true,
    });
  });
});
