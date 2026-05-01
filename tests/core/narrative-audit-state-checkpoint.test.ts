import { describe, expect, it } from 'vitest';
import { decideAuditAction } from '@story-weaver/backend/core/narrative/audit';
import { shouldRunCheckpoint } from '@story-weaver/backend/core/narrative/checkpoint';
import { normalizeNarrativeStateDelta } from '@story-weaver/backend/core/narrative/state';

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

  it('revises strict opening chapters with weak viral opening hook', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 90,
          decision: 'accept',
          issues: [],
          scoring: {
            characterLogic: 90,
            mainlineProgress: 90,
            relationshipChange: 90,
            conflictDepth: 90,
            worldRuleCost: 90,
            threadManagement: 90,
            pacingReward: 90,
            themeAlignment: 90,
            viral: {
              openingHook: 79,
              desireClarity: 90,
              payoffStrength: 90,
              readerQuestionStrength: 90,
              tropeFulfillment: 90,
              antiClicheFreshness: 90,
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

  it('revises chapters with payoff without cost', () => {
    expect(
      decideAuditAction({
        passed: true,
        score: 92,
        decision: 'accept',
        issues: [
          {
            type: 'payoff_without_cost',
            severity: 'minor',
            evidence: '主角直接胜利，没有副作用。',
            fixInstruction: '增加关系代价。',
          },
        ],
        scoring: {
          characterLogic: 90,
          mainlineProgress: 90,
          relationshipChange: 90,
          conflictDepth: 90,
          worldRuleCost: 90,
          threadManagement: 90,
          pacingReward: 90,
          themeAlignment: 90,
          viral: {
            openingHook: 90,
            desireClarity: 90,
            payoffStrength: 90,
            readerQuestionStrength: 90,
            tropeFulfillment: 90,
            antiClicheFreshness: 90,
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

  it('rewrites chapters that miss both reader promise and desire', () => {
    expect(
      decideAuditAction({
        passed: false,
        score: 62,
        decision: 'revise',
        issues: [
          {
            type: 'weak_reader_promise',
            severity: 'major',
            evidence: '本章没有服务压抑后翻盘。',
            fixInstruction: '重建章节目标。',
          },
          {
            type: 'unclear_desire',
            severity: 'major',
            evidence: '主角没有主动目标。',
            fixInstruction: '重建主角行动线。',
          },
        ],
        scoring: {
          characterLogic: 70,
          mainlineProgress: 70,
          relationshipChange: 70,
          conflictDepth: 70,
          worldRuleCost: 70,
          threadManagement: 70,
          pacingReward: 70,
          themeAlignment: 70,
          viral: {
            openingHook: 70,
            desireClarity: 40,
            payoffStrength: 65,
            readerQuestionStrength: 70,
            tropeFulfillment: 70,
            antiClicheFreshness: 70,
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
