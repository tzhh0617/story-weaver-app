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
