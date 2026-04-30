import { describe, expect, it } from 'vitest';
import { decideAuditAction } from '../../src/core/narrative/audit';
import { shouldRunCheckpoint } from '../../src/core/narrative/checkpoint';
import { normalizeNarrativeStateDelta } from '../../src/core/narrative/state';

describe('narrative audit helpers', () => {
  it('escalates blocker audits to rewrite', () => {
    expect(
      decideAuditAction({
        passed: false,
        score: 72,
        decision: 'accept',
        issues: [
          {
            type: 'world_rule_violation',
            severity: 'blocker',
            evidence: 'no cost',
            fixInstruction: 'rewrite with cost',
          },
        ],
        scoring: {
          characterLogic: 10,
          mainlineProgress: 10,
          relationshipChange: 10,
          conflictDepth: 10,
          worldRuleCost: 0,
          threadManagement: 8,
          pacingReward: 9,
          themeAlignment: 4,
        },
        stateUpdates: {
          characterArcUpdates: [],
          relationshipUpdates: [],
          threadUpdates: [],
          worldKnowledgeUpdates: [],
          themeUpdate: '',
        },
      })
    ).toBe('rewrite');
  });

  it('rewrites drafts with very low flatness average', () => {
    expect(
      decideAuditAction({
        passed: true,
        score: 88,
        decision: 'accept',
        issues: [],
        scoring: {
          characterLogic: 18,
          mainlineProgress: 13,
          relationshipChange: 13,
          conflictDepth: 14,
          worldRuleCost: 9,
          threadManagement: 8,
          pacingReward: 9,
          themeAlignment: 4,
          flatness: {
            conflictEscalation: 50,
            choicePressure: 55,
            consequenceVisibility: 50,
            irreversibleChange: 55,
            hookStrength: 50,
          },
        },
        stateUpdates: {
          characterArcUpdates: [],
          relationshipUpdates: [],
          threadUpdates: [],
          worldKnowledgeUpdates: [],
          themeUpdate: '',
        },
      })
    ).toBe('rewrite');
  });

  it('revises drafts with weak choice pressure even when the total audit score is acceptable', () => {
    expect(
      decideAuditAction({
        passed: true,
        score: 88,
        decision: 'accept',
        issues: [],
        scoring: {
          characterLogic: 18,
          mainlineProgress: 13,
          relationshipChange: 13,
          conflictDepth: 14,
          worldRuleCost: 9,
          threadManagement: 8,
          pacingReward: 9,
          themeAlignment: 4,
          flatness: {
            conflictEscalation: 75,
            choicePressure: 55,
            consequenceVisibility: 80,
            irreversibleChange: 80,
            hookStrength: 80,
          },
        },
        stateUpdates: {
          characterArcUpdates: [],
          relationshipUpdates: [],
          threadUpdates: [],
          worldKnowledgeUpdates: [],
          themeUpdate: '',
        },
      })
    ).toBe('revise');
  });

  it('revises first-three chapters when hook strength is below opening retention threshold', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 80,
              choicePressure: 75,
              consequenceVisibility: 80,
              irreversibleChange: 80,
              hookStrength: 79,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 1 }
      )
    ).toBe('revise');
  });

  it('keeps later chapters on regular flatness thresholds', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 88,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 80,
              choicePressure: 75,
              consequenceVisibility: 80,
              irreversibleChange: 80,
              hookStrength: 79,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 8 }
      )
    ).toBe('accept');
  });

  it('rewrites first-three chapters with flat chapter issues', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 86,
          decision: 'accept',
          issues: [
            {
              type: 'flat_chapter',
              severity: 'major',
              evidence: '有事件但没有选择、代价或变化。',
              fixInstruction: '重写为有可见选择和不可逆变化的开篇章。',
            },
          ],
          scoring: {
            characterLogic: 18,
            mainlineProgress: 13,
            relationshipChange: 13,
            conflictDepth: 14,
            worldRuleCost: 9,
            threadManagement: 8,
            pacingReward: 9,
            themeAlignment: 4,
            flatness: {
              conflictEscalation: 75,
              choicePressure: 75,
              consequenceVisibility: 80,
              irreversibleChange: 80,
              hookStrength: 82,
            },
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 3 }
      )
    ).toBe('rewrite');
  });
});

describe('normalizeNarrativeStateDelta', () => {
  it('keeps arrays stable when model fields are omitted', () => {
    expect(normalizeNarrativeStateDelta({})).toEqual({
      characterStates: [],
      relationshipStates: [],
      threadUpdates: [],
      scene: null,
      themeProgression: '',
    });
  });
});

describe('shouldRunCheckpoint', () => {
  it('runs on configured chapter intervals', () => {
    expect(shouldRunCheckpoint({ chapterIndex: 10, interval: 5 })).toBe(true);
    expect(shouldRunCheckpoint({ chapterIndex: 11, interval: 5 })).toBe(false);
  });
});
