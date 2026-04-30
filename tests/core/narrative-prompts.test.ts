import { describe, expect, it } from 'vitest';
import {
  buildChapterAuditPrompt,
  buildChapterCardPrompt,
  buildNarrativeBiblePrompt,
  buildNarrativeDraftPrompt,
  buildRevisionPrompt,
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

  it('draft prompt includes command context and forbids explanation', () => {
    const prompt = buildNarrativeDraftPrompt({
      idea: '命簿',
      wordsPerChapter: 2000,
      commandContext: 'Chapter Mission: 林牧必须主动追查。',
    });

    expect(prompt).toContain('Return only the final chapter prose');
    expect(prompt).toContain('Chapter Mission');
    expect(prompt).toContain('approximately 2000 Chinese characters');
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
});

describe('parseJsonObject', () => {
  it('strips markdown code fences before parsing JSON', () => {
    expect(parseJsonObject<{ ok: boolean }>('```json\n{"ok":true}\n```')).toEqual({
      ok: true,
    });
  });
});
