import { describe, expect, it } from 'vitest';
import {
  buildChapterAuditPrompt,
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildNarrativeDraftPrompt,
  buildRevisionPrompt,
  buildTensionBudgetPrompt,
  parseJsonObject,
} from '../../src/core/narrative/prompts';

describe('narrative prompts', () => {
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
    expect(prompt).toContain('Chapter 2: rising cost');
    expect(prompt).toContain('Chapter 3: irreversible entry');
    expect(prompt).toContain('Chapter 4: first clear reward');
    expect(prompt).toContain('Chapter 5: long-term hostility');
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
});

describe('parseJsonObject', () => {
  it('strips markdown code fences before parsing JSON', () => {
    expect(parseJsonObject<{ ok: boolean }>('```json\n{"ok":true}\n```')).toEqual({
      ok: true,
    });
  });
});
