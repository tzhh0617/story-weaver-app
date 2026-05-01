import { describe, expect, it, vi } from 'vitest';
import { createNarrativeWorldAggregate } from '@story-weaver/backend/core/aggregates/narrative-world';

describe('createNarrativeWorldAggregate', () => {
  const bookId = 'book-1';

  describe('getBible', () => {
    it('returns the story bible when the repo has one', () => {
      const bible = {
        premise: 'A test premise',
        themeQuestion: 'What is truth?',
        themeAnswerDirection: 'Truth is subjective',
        centralDramaticQuestion: 'Will the hero succeed?',
        voiceGuide: 'First person present',
      };
      const getByBook = vi.fn().mockReturnValue(bible);
      const aggregate = createNarrativeWorldAggregate({
        storyBibles: { saveGraph: vi.fn(), getByBook },
      });

      const result = aggregate.getBible(bookId);

      expect(result).toEqual(bible);
      expect(getByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns null when no bible exists', () => {
      const getByBook = vi.fn().mockReturnValue(null);
      const aggregate = createNarrativeWorldAggregate({
        storyBibles: { saveGraph: vi.fn(), getByBook },
      });

      expect(aggregate.getBible(bookId)).toBeNull();
    });

    it('returns null when storyBibles repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(aggregate.getBible(bookId)).toBeNull();
    });
  });

  describe('listCharacterArcs', () => {
    it('returns character arcs from the repo', () => {
      const arcs = [
        { id: 'char-1', name: 'Hero', currentArcPhase: 'setup' },
      ];
      const listByBook = vi.fn().mockReturnValue(arcs);
      const aggregate = createNarrativeWorldAggregate({
        characterArcs: { listByBook },
      });

      const result = aggregate.listCharacterArcs(bookId);

      expect(result).toEqual(arcs);
      expect(listByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns empty array when repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(aggregate.listCharacterArcs(bookId)).toEqual([]);
    });
  });

  describe('listRelationshipEdges', () => {
    it('returns relationship edges from the repo', () => {
      const edges = [
        { id: 'rel-1', fromCharacterId: 'a', toCharacterId: 'b' },
      ];
      const listByBook = vi.fn().mockReturnValue(edges);
      const aggregate = createNarrativeWorldAggregate({
        relationshipEdges: { listByBook },
      });

      const result = aggregate.listRelationshipEdges(bookId);

      expect(result).toEqual(edges);
      expect(listByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns empty array when repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(aggregate.listRelationshipEdges(bookId)).toEqual([]);
    });
  });

  describe('listWorldRules', () => {
    it('returns world rules from the repo', () => {
      const rules = [
        { id: 'rule-1', ruleText: 'Magic costs energy', cost: 'fatigue' },
      ];
      const listByBook = vi.fn().mockReturnValue(rules);
      const aggregate = createNarrativeWorldAggregate({
        worldRules: { listByBook },
      });

      const result = aggregate.listWorldRules(bookId);

      expect(result).toEqual(rules);
      expect(listByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns empty array when repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(aggregate.listWorldRules(bookId)).toEqual([]);
    });
  });

  describe('listNarrativeThreads', () => {
    it('returns narrative threads from the repo', () => {
      const threads = [
        { id: 'thread-1', promise: 'Who is the spy?', plantedAt: 1 },
      ];
      const listByBook = vi.fn().mockReturnValue(threads);
      const aggregate = createNarrativeWorldAggregate({
        narrativeThreads: { listByBook },
      });

      const result = aggregate.listNarrativeThreads(bookId);

      expect(result).toEqual(threads);
      expect(listByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns empty array when repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(aggregate.listNarrativeThreads(bookId)).toEqual([]);
    });
  });

  describe('loadBible', () => {
    it('delegates to storyBibles.saveGraph', () => {
      const saveGraph = vi.fn();
      const aggregate = createNarrativeWorldAggregate({
        storyBibles: { saveGraph, getByBook: vi.fn() },
      });

      const bible = {
        premise: 'Test',
        characterArcs: [],
        relationshipEdges: [],
        worldRules: [],
        narrativeThreads: [],
      } as any;
      aggregate.loadBible(bookId, bible);

      expect(saveGraph).toHaveBeenCalledWith(bookId, bible);
    });

    it('does nothing when storyBibles repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(() => aggregate.loadBible(bookId, {} as any)).not.toThrow();
    });
  });

  describe('saveCharacterArcState', () => {
    it('delegates to characterArcs.saveState', () => {
      const saveState = vi.fn();
      const aggregate = createNarrativeWorldAggregate({
        characterArcs: { listByBook: vi.fn().mockReturnValue([]), saveState },
      });

      const input = {
        bookId,
        characterId: 'char-1',
        characterName: 'Hero',
        volumeIndex: 1,
        chapterIndex: 3,
        emotion: 'determined',
      } as any;
      aggregate.saveCharacterArcState(input);

      expect(saveState).toHaveBeenCalledWith(input);
    });

    it('does nothing when saveState is absent', () => {
      const aggregate = createNarrativeWorldAggregate({
        characterArcs: { listByBook: vi.fn().mockReturnValue([]) },
      });

      expect(() =>
        aggregate.saveCharacterArcState({ bookId } as any)
      ).not.toThrow();
    });

    it('does nothing when characterArcs repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(() =>
        aggregate.saveCharacterArcState({ bookId } as any)
      ).not.toThrow();
    });
  });

  describe('saveRelationshipState', () => {
    it('delegates to relationshipStates.save', () => {
      const save = vi.fn();
      const aggregate = createNarrativeWorldAggregate({
        relationshipStates: { save },
      });

      const input = {
        bookId,
        relationshipId: 'rel-1',
        volumeIndex: 1,
        chapterIndex: 3,
        trustLevel: 5,
        tensionLevel: 3,
        currentState: 'strained',
      };
      aggregate.saveRelationshipState(input);

      expect(save).toHaveBeenCalledWith(input);
    });

    it('does nothing when relationshipStates repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(() =>
        aggregate.saveRelationshipState({ bookId } as any)
      ).not.toThrow();
    });
  });

  describe('upsertNarrativeThread', () => {
    it('delegates to narrativeThreads.upsertThread', () => {
      const upsertThread = vi.fn();
      const aggregate = createNarrativeWorldAggregate({
        narrativeThreads: { listByBook: vi.fn().mockReturnValue([]), upsertThread },
      });

      const thread = {
        id: 'thread-1',
        promise: 'Who is the spy?',
        plantedAt: 1,
      } as any;
      aggregate.upsertNarrativeThread(bookId, thread);

      expect(upsertThread).toHaveBeenCalledWith(bookId, thread);
    });

    it('does nothing when upsertThread is absent', () => {
      const aggregate = createNarrativeWorldAggregate({
        narrativeThreads: { listByBook: vi.fn().mockReturnValue([]) },
      });

      expect(() =>
        aggregate.upsertNarrativeThread(bookId, {} as any)
      ).not.toThrow();
    });

    it('does nothing when narrativeThreads repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(() =>
        aggregate.upsertNarrativeThread(bookId, {} as any)
      ).not.toThrow();
    });
  });

  describe('resolveNarrativeThread', () => {
    it('delegates to narrativeThreads.resolveThread', () => {
      const resolveThread = vi.fn();
      const aggregate = createNarrativeWorldAggregate({
        narrativeThreads: { listByBook: vi.fn().mockReturnValue([]), resolveThread },
      });

      aggregate.resolveNarrativeThread(bookId, 'thread-1', 5);

      expect(resolveThread).toHaveBeenCalledWith(bookId, 'thread-1', 5);
    });

    it('does nothing when resolveThread is absent', () => {
      const aggregate = createNarrativeWorldAggregate({
        narrativeThreads: { listByBook: vi.fn().mockReturnValue([]) },
      });

      expect(() =>
        aggregate.resolveNarrativeThread(bookId, 'thread-1', 5)
      ).not.toThrow();
    });

    it('does nothing when narrativeThreads repo is absent', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(() =>
        aggregate.resolveNarrativeThread(bookId, 'thread-1', 5)
      ).not.toThrow();
    });
  });

  describe('with all repos absent', () => {
    it('all read operations return safe defaults', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(aggregate.getBible(bookId)).toBeNull();
      expect(aggregate.listCharacterArcs(bookId)).toEqual([]);
      expect(aggregate.listRelationshipEdges(bookId)).toEqual([]);
      expect(aggregate.listWorldRules(bookId)).toEqual([]);
      expect(aggregate.listNarrativeThreads(bookId)).toEqual([]);
    });

    it('all write operations are no-ops', () => {
      const aggregate = createNarrativeWorldAggregate({});

      expect(() => aggregate.loadBible(bookId, {} as any)).not.toThrow();
      expect(() =>
        aggregate.saveCharacterArcState({ bookId } as any)
      ).not.toThrow();
      expect(() =>
        aggregate.saveRelationshipState({ bookId } as any)
      ).not.toThrow();
      expect(() =>
        aggregate.upsertNarrativeThread(bookId, {} as any)
      ).not.toThrow();
      expect(() =>
        aggregate.resolveNarrativeThread(bookId, 't-1', 5)
      ).not.toThrow();
    });
  });
});
