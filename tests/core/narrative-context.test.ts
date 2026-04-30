import { describe, expect, it } from 'vitest';
import { buildNarrativeCommandContext } from '../../src/core/narrative/context';

describe('buildNarrativeCommandContext', () => {
  it('keeps chapter mission and forbidden moves when trimming', () => {
    const result = buildNarrativeCommandContext({
      bible: {
        themeQuestion: '人能否摆脱命运？',
        themeAnswerDirection: '自由需要承担代价。',
        voiceGuide: '中文网文。',
      },
      chapterCard: {
        title: '旧页初鸣',
        plotFunction: '建立旧案。',
        externalConflict: '宗门执事追捕。',
        internalConflict: '林牧想隐瞒却需要求助。',
        relationshipChange: '林牧欠下人情。',
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: '命簿吞记忆。',
        readerReward: 'truth',
        endingHook: '旧页浮现林家姓名。',
        mustChange: '林牧从逃避变为主动追查。',
        forbiddenMoves: ['不能揭示最终幕后主使。'],
      },
      hardContinuity: Array.from({ length: 20 }, (_, index) => `事实${index}: ${'很长'.repeat(20)}`),
      characterPressures: ['林牧: 欲望被旧页刺激，恐惧被遗忘。'],
      relationshipActions: ['林牧和阿照: trust +1 because shared risk.'],
      threadActions: ['main-ledger-truth advance: 确认旧案有关。'],
      worldRules: ['record-cost: 改写命簿会失去记忆。'],
      recentSummaries: ['上一章林牧失去身份。'],
      previousChapterEnding: '碎页发光。',
      maxCharacters: 650,
    });

    expect(result.length).toBeLessThanOrEqual(650);
    expect(result).toContain('Chapter Mission');
    expect(result).toContain('mustChange: 林牧从逃避变为主动追查。');
    expect(result).toContain('Forbidden Moves');
    expect(result).toContain('不能揭示最终幕后主使。');
  });

  it('includes tension budget in the command context', () => {
    const result = buildNarrativeCommandContext({
      bible: {
        themeQuestion: '人能否摆脱命运？',
        themeAnswerDirection: '自由需要承担代价。',
        voiceGuide: '紧凑中文网文。',
      },
      chapterCard: {
        title: '旧页',
        plotFunction: '开局。',
        externalConflict: '宗门追捕。',
        internalConflict: '林牧想保密却需要求助。',
        relationshipChange: '林牧欠下同伴人情。',
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: '命簿会吞记忆。',
        readerReward: 'truth',
        endingHook: '碎页浮现林家姓名。',
        mustChange: '林牧从逃避变为主动追查。',
        forbiddenMoves: [],
      },
      tensionBudget: {
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
      hardContinuity: [],
      characterPressures: [],
      relationshipActions: [],
      threadActions: [],
      worldRules: [],
      recentSummaries: [],
      previousChapterEnding: null,
    });

    expect(result).toContain('Tension Budget:');
    expect(result).toContain('pressureLevel: high');
    expect(result).toContain('forcedChoice: 保住证据，或救下同伴。');
    expect(result).toContain('Flatness Risks:');
    expect(result).toContain('不要用解释代替冲突。');
  });

  it('preserves tension budget when context is trimmed', () => {
    const result = buildNarrativeCommandContext({
      bible: {
        themeQuestion: '人能否摆脱命运？',
        themeAnswerDirection: '自由需要承担代价。',
        voiceGuide: '紧凑中文网文。',
      },
      chapterCard: {
        title: '旧页',
        plotFunction: '开局。',
        externalConflict: '宗门追捕。',
        internalConflict: '林牧想保密却需要求助。',
        relationshipChange: '林牧欠下同伴人情。',
        worldRuleUsedOrTested: 'record-cost',
        informationReveal: '命簿会吞记忆。',
        readerReward: 'truth',
        endingHook: '碎页浮现林家姓名。',
        mustChange: '林牧从逃避变为主动追查。',
        forbiddenMoves: [],
      },
      tensionBudget: {
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
      hardContinuity: ['x'.repeat(1000)],
      characterPressures: ['x'.repeat(1000)],
      relationshipActions: ['x'.repeat(1000)],
      threadActions: ['x'.repeat(1000)],
      worldRules: ['x'.repeat(1000)],
      recentSummaries: ['x'.repeat(1000)],
      previousChapterEnding: 'x'.repeat(1000),
      maxCharacters: 900,
    });

    expect(result).toContain('Tension Budget:');
    expect(result).toContain('mustChange: 林牧从逃避变为主动追查。');
    expect(result.length).toBeLessThanOrEqual(900);
  });
});
