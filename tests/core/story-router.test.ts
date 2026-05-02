import { describe, expect, it } from 'vitest';
import {
  formatStoryRoutePlanForPrompt,
  routeStoryTask,
} from '@story-weaver/backend/core/story-router';

describe('story skill router', () => {
  it('routes chapter writing through structure, chapter goal, character, hook, and audit skills', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    expect(plan.taskType).toBe('write_chapter');
    expect(plan.requiredSkills.map((skill) => skill.id)).toEqual([
      'story-structure',
      'chapter-goal',
      'character-logic',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'dialogue-control',
      'genre-pattern',
      'viral-promise',
      'payoff-cadence',
      'anti-cliche',
      'prose-style',
      'consistency-audit',
      'pacing-audit',
      'red-flag-audit',
    ]);
    expect(plan.optionalSkills.map((skill) => skill.id)).toEqual([
      'de-ai-style',
    ]);
    expect(plan.hardConstraints).toContain(
      '低优先级规则不能推翻用户要求、作品设定、章节卡和张力预算。'
    );
    expect(plan.checklist).toContain('必须完成章节卡 mustChange。');
    expect(plan.checklist).toContain('必须服务作品读者承诺。');
    expect(plan.checklist).toContain('主线必须产生可描述位移，不能只停留在设定或背景。');
    expect(plan.checklist).toContain('结尾钩子必须由本章 mustChange、代价、揭示或强制选择触发。');
    expect(plan.checklist).toContain('标题承诺和读者承诺必须进入场景行动。');
  });

  it('routes de-ai work without outline or opening modules', () => {
    const plan = routeStoryTask({
      taskType: 'de_ai',
      context: {
        hasNarrativeBible: false,
        hasChapterCard: false,
        hasTensionBudget: false,
      },
    });

    const skillIds = plan.requiredSkills.map((skill) => skill.id);

    expect(skillIds).toEqual([
      'dialogue-control',
      'prose-style',
      'de-ai-style',
      'red-flag-audit',
    ]);
    expect(skillIds).not.toContain('story-structure');
    expect(skillIds).not.toContain('opening-hook');
  });

  it('records warnings for missing route context while keeping generation possible', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: false,
        hasChapterCard: false,
        hasTensionBudget: false,
      },
    });

    expect(plan.warnings).toEqual([
      'Narrative Bible missing: use book idea and available continuity as fallback.',
      'Chapter Card missing: use generic chapter-goal rules.',
      'Tension Budget missing: skip budget-specific pressure rules.',
    ]);
  });

  it('routes opening design through chapter goal and pacing audit', () => {
    const plan = routeStoryTask({
      taskType: 'design_opening',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    expect(plan.requiredSkills.map((skill) => skill.id)).toEqual([
      'story-structure',
      'chapter-goal',
      'emotion-curve',
      'opening-hook',
      'hook-technique',
      'genre-pattern',
      'viral-promise',
      'anti-cliche',
      'pacing-audit',
    ]);
  });

  it('throws for unsupported task types', () => {
    expect(() =>
      routeStoryTask({
        taskType: 'unknown' as never,
        context: {
          hasNarrativeBible: true,
          hasChapterCard: true,
          hasTensionBudget: true,
        },
      })
    ).toThrow('Unsupported story task type: unknown');
  });

  it('formats route plans for prompt injection', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    const text = formatStoryRoutePlanForPrompt(plan);

    expect(text).toContain('Story Skill Route Plan');
    expect(text).toContain('Priority Rules');
    expect(text).toContain('Required Skills');
    expect(text).toContain('story-structure');
    expect(text).toContain('Hard Constraints');
    expect(text).toContain('Red Flags');
    expect(text).toContain('Checklist');
    expect(text).toContain('主线必须产生可描述位移');
    expect(text).toContain('结尾钩子必须由本章');
    expect(text).toContain('主线漂移');
    expect(text).toContain('结尾松散');
    expect(text).toContain('空悬钩子');
    expect(text).not.toContain('Opening Retention');
  });

  it('formats opening retention lines only when provided', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    const text = formatStoryRoutePlanForPrompt({
      ...plan,
      openingRetentionLines: [
        'Opening retention phase:',
        'Current opening phase: chapter 1 - 异常入场 (abnormal entry)',
      ],
    });

    expect(text).toContain('Opening Retention');
    expect(text).toContain('Current opening phase: chapter 1');
  });

  it('formats viral protocol lines when provided', () => {
    const plan = routeStoryTask({
      taskType: 'write_chapter',
      context: {
        hasNarrativeBible: true,
        hasChapterCard: true,
        hasTensionBudget: true,
      },
    });

    const text = formatStoryRoutePlanForPrompt({
      ...plan,
      viralProtocolLines: [
        'Viral Story Protocol',
        'Reader promise: 压抑后翻盘。',
      ],
    });

    expect(text).toContain('Viral Protocol');
    expect(text).toContain('Reader promise: 压抑后翻盘。');
  });
});
