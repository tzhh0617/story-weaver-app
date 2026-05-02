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

  it('rewrites blocker mainline drift', () => {
    const audit = {
      passed: false,
      score: 78,
      decision: 'revise' as const,
      issues: [
        {
          type: 'mainline_drift' as const,
          severity: 'blocker' as const,
          evidence: '整章离开命簿旧债主线。',
          fixInstruction: '重写为围绕旧债选择推进。',
        },
      ],
      scoring: {
        characterLogic: 90,
        mainlineProgress: 20,
        relationshipChange: 80,
        conflictDepth: 80,
        worldRuleCost: 80,
        threadManagement: 20,
        pacingReward: 80,
        themeAlignment: 80,
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '',
      },
    };

    expect(decideAuditAction(audit)).toBe('rewrite');
  });

  it('revises major loose endings and unearned hooks', () => {
    const baseAudit = {
      passed: true,
      score: 92,
      decision: 'accept' as const,
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
      },
      stateUpdates: {
        characterArcUpdates: [],
        relationshipUpdates: [],
        threadUpdates: [],
        worldKnowledgeUpdates: [],
        themeUpdate: '',
      },
    };

    expect(
      decideAuditAction({
        ...baseAudit,
        issues: [
          {
            type: 'loose_ending' as const,
            severity: 'major' as const,
            evidence: '章末只是停住，没有收束也没有具体压力。',
            fixInstruction: '用本章代价制造下一步压力。',
          },
        ],
      })
    ).toBe('revise');

    expect(
      decideAuditAction({
        ...baseAudit,
        issues: [
          {
            type: 'unearned_hook' as const,
            severity: 'major' as const,
            evidence: '章末突然抛出陌生敌人。',
            fixInstruction: '让钩子来自本章揭示或选择。',
          },
        ],
      })
    ).toBe('revise');
  });

  it('revises opening chapters with weak title promise', () => {
    expect(
      decideAuditAction(
        {
          passed: true,
          score: 90,
          decision: 'accept',
          issues: [
            {
              type: 'weak_title_promise',
              severity: 'minor',
              evidence: '第一章没有体现命簿旧债。',
              fixInstruction: '让异常入场直接触碰标题承诺。',
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
          },
          stateUpdates: {
            characterArcUpdates: [],
            relationshipUpdates: [],
            threadUpdates: [],
            worldKnowledgeUpdates: [],
            themeUpdate: '',
          },
        },
        { chapterIndex: 5 }
      )
    ).toBe('revise');
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

  it('filters malformed state rows before persistence', () => {
    expect(
      normalizeNarrativeStateDelta({
        characterStates: [
          {
            characterId: '',
            characterName: '无效角色',
          },
          {
            characterId: 'lin-mu',
            characterName: ' 林牧 ',
            location: ' 档案门 ',
            status: 'null',
          },
        ],
        relationshipStates: [
          {
            relationshipId: '',
            trustLevel: 1,
            tensionLevel: 2,
            currentState: '无效关系',
          },
          {
            relationshipId: 'lin-mu-ally',
            trustLevel: '3' as unknown as number,
            tensionLevel: 4,
            currentState: ' 互相试探 ',
            changeSummary: 'null',
          },
        ],
        threadUpdates: [
          {
            threadId: '',
            currentState: 'open',
          },
          {
            threadId: 'main-ledger-truth',
            currentState: 'done' as never,
          },
          {
            threadId: 'main-ledger-truth',
            currentState: 'advanced',
            resolvedAt: Number.NaN,
            notes: ' 推进线索 ',
          },
        ],
        scene: {
          location: '',
          timeInStory: '夜',
          charactersPresent: ['林牧'],
        },
        themeProgression: ' null ',
      })
    ).toEqual({
      characterStates: [
        {
          characterId: 'lin-mu',
          characterName: '林牧',
          location: '档案门',
          status: null,
          knowledge: null,
          emotion: null,
          powerLevel: null,
          arcPhase: null,
        },
      ],
      relationshipStates: [
        {
          relationshipId: 'lin-mu-ally',
          trustLevel: 3,
          tensionLevel: 4,
          currentState: '互相试探',
          changeSummary: null,
        },
      ],
      threadUpdates: [
        {
          threadId: 'main-ledger-truth',
          currentState: 'advanced',
          resolvedAt: null,
          notes: '推进线索',
        },
      ],
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
