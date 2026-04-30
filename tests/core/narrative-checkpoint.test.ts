import { describe, expect, it } from 'vitest';
import {
  buildTensionCheckpoint,
  shouldRunCheckpoint,
  shouldRunNarrativeCheckpoint,
} from '../../src/core/narrative/checkpoint';

describe('shouldRunNarrativeCheckpoint', () => {
  it('runs arc checkpoint every 10 chapters', () => {
    expect(shouldRunNarrativeCheckpoint(9)).toBe(false);
    expect(shouldRunNarrativeCheckpoint(10)).toBe(true);
    expect(shouldRunNarrativeCheckpoint(20)).toBe(true);
  });

  it('keeps the configurable checkpoint helper for custom intervals', () => {
    expect(shouldRunCheckpoint({ chapterIndex: 6, interval: 3 })).toBe(true);
    expect(shouldRunCheckpoint({ chapterIndex: 7, interval: 3 })).toBe(false);
  });
});

describe('buildTensionCheckpoint', () => {
  it('flags repeated tension patterns and low flatness chapters', () => {
    const checkpoint = buildTensionCheckpoint({
      chapterIndex: 10,
      budgets: [6, 7, 8, 9, 10].map((chapterIndex) => ({
        bookId: 'book-1',
        volumeIndex: 1,
        chapterIndex,
        pressureLevel: 'medium',
        dominantTension: 'mystery',
        requiredTurn: `第 ${chapterIndex} 章转折。`,
        forcedChoice: '保密或求助。',
        costToPay: '失去信任。',
        irreversibleChange: '无法回到旁观。',
        readerQuestion: '幕后是谁？',
        hookPressure: '新压力出现。',
        flatnessRisks: ['不要只解释。'],
      })),
      audits: [
        {
          chapterIndex: 8,
          scoring: {
            flatness: {
              conflictEscalation: 65,
              choicePressure: 75,
              consequenceVisibility: 65,
              irreversibleChange: 75,
              hookStrength: 65,
            },
          },
        },
        {
          chapterIndex: 9,
          scoring: {
            flatness: {
              conflictEscalation: 64,
              choicePressure: 76,
              consequenceVisibility: 64,
              irreversibleChange: 76,
              hookStrength: 64,
            },
          },
        },
      ],
    });

    expect(checkpoint.flatChapterIndexes).toEqual([8, 9]);
    expect(checkpoint.repeatedPatterns).toEqual([
      'dominantTension mystery repeated for 5 chapters',
    ]);
    expect(checkpoint.nextBudgetInstruction).toContain('Switch dominant tension');
    expect(checkpoint.recentPressureCurve).toHaveLength(5);
  });
});
