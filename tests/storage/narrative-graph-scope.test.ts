import { describe, expect, it } from 'vitest';
import { createDatabase } from '@story-weaver/backend/storage/database';
import { createBookRepository } from '@story-weaver/backend/storage/books';
import { createCharacterArcRepository } from '@story-weaver/backend/storage/character-arcs';
import { createRelationshipEdgeRepository } from '@story-weaver/backend/storage/relationship-edges';
import { createWorldRuleRepository } from '@story-weaver/backend/storage/world-rules';
import { createNarrativeThreadRepository } from '@story-weaver/backend/storage/narrative-threads';
import type {
  CharacterArc,
  NarrativeThread,
  RelationshipEdge,
  WorldRule,
} from '@story-weaver/backend/core/narrative/types';

function createBooks() {
  const db = createDatabase(':memory:');
  const books = createBookRepository(db);

  books.create({
    id: 'book-1',
    title: 'Book 1',
    idea: 'A city remembers every promise.',
    targetChapters: 1,
    wordsPerChapter: 2500,
  });
  books.create({
    id: 'book-2',
    title: 'Book 2',
    idea: 'A lighthouse records every storm.',
    targetChapters: 1,
    wordsPerChapter: 2500,
  });

  return db;
}

function characterArc(name: string): CharacterArc {
  return {
    id: 'protagonist',
    name,
    roleType: 'protagonist',
    desire: `${name} desire`,
    fear: `${name} fear`,
    flaw: `${name} flaw`,
    misbelief: `${name} misbelief`,
    wound: null,
    externalGoal: `${name} goal`,
    internalNeed: `${name} need`,
    arcDirection: 'growth',
    decisionLogic: `${name} logic`,
    lineWillNotCross: null,
    lineMayEventuallyCross: null,
    currentArcPhase: 'denial',
  };
}

function relationshipEdge(label: string): RelationshipEdge {
  return {
    id: 'main-bond',
    fromCharacterId: 'protagonist',
    toCharacterId: 'ally',
    visibleLabel: label,
    hiddenTruth: null,
    dependency: null,
    debt: null,
    misunderstanding: null,
    affection: null,
    harmPattern: null,
    sharedGoal: null,
    valueConflict: null,
    trustLevel: 3,
    tensionLevel: 4,
    currentState: `${label} state`,
    plannedTurns: [],
  };
}

function worldRule(ruleText: string): WorldRule {
  return {
    id: 'core-rule',
    category: 'power',
    ruleText,
    cost: `${ruleText} cost`,
    whoBenefits: null,
    whoSuffers: null,
    taboo: null,
    violationConsequence: null,
    allowedException: null,
    currentStatus: 'active',
  };
}

function narrativeThread(promise: string): NarrativeThread {
  return {
    id: 'main-thread',
    type: 'main',
    promise,
    plantedAt: 1,
    expectedPayoff: 1,
    resolvedAt: null,
    currentState: 'open',
    importance: 'critical',
    payoffMustChange: 'plot',
    ownerCharacterId: 'protagonist',
    relatedRelationshipId: null,
    notes: null,
  };
}

describe('narrative graph repositories', () => {
  it('scope repeated model-generated ids to each book', () => {
    const db = createBooks();
    const characterArcs = createCharacterArcRepository(db);
    const relationshipEdges = createRelationshipEdgeRepository(db);
    const worldRules = createWorldRuleRepository(db);
    const narrativeThreads = createNarrativeThreadRepository(db);

    characterArcs.upsertMany('book-1', [characterArc('Book One Hero')]);
    characterArcs.upsertMany('book-2', [characterArc('Book Two Hero')]);
    relationshipEdges.upsertMany('book-1', [relationshipEdge('Book one bond')]);
    relationshipEdges.upsertMany('book-2', [relationshipEdge('Book two bond')]);
    worldRules.upsertMany('book-1', [worldRule('Book one rule')]);
    worldRules.upsertMany('book-2', [worldRule('Book two rule')]);
    narrativeThreads.upsertMany('book-1', [narrativeThread('Book one promise')]);
    narrativeThreads.upsertMany('book-2', [narrativeThread('Book two promise')]);

    expect(characterArcs.listByBook('book-1')[0]?.name).toBe('Book One Hero');
    expect(characterArcs.listByBook('book-2')[0]?.name).toBe('Book Two Hero');
    expect(relationshipEdges.listByBook('book-1')[0]?.visibleLabel).toBe(
      'Book one bond'
    );
    expect(relationshipEdges.listByBook('book-2')[0]?.visibleLabel).toBe(
      'Book two bond'
    );
    expect(worldRules.listByBook('book-1')[0]?.ruleText).toBe('Book one rule');
    expect(worldRules.listByBook('book-2')[0]?.ruleText).toBe('Book two rule');
    expect(narrativeThreads.listByBook('book-1')[0]?.promise).toBe(
      'Book one promise'
    );
    expect(narrativeThreads.listByBook('book-2')[0]?.promise).toBe(
      'Book two promise'
    );
  });
});
