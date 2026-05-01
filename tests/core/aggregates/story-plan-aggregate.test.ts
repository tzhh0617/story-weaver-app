import { describe, expect, it, vi } from 'vitest';
import { createStoryPlanAggregate } from '@story-weaver/backend/core/aggregates/story-plan';

describe('createStoryPlanAggregate', () => {
  const bookId = 'book-1';

  describe('createFromBundle', () => {
    it('saves volume plans, chapter cards, and tension budgets', () => {
      const upsertManyPlans = vi.fn();
      const upsertManyCards = vi.fn();
      const upsertManyBudgets = vi.fn();

      const aggregate = createStoryPlanAggregate({
        volumePlans: { upsertMany: upsertManyPlans },
        chapterCards: { upsertMany: upsertManyCards },
        chapterTensionBudgets: { upsertMany: upsertManyBudgets },
      });

      const plans = [
        {
          volumeIndex: 0,
          title: 'Volume 1',
          chapterStart: 1,
          chapterEnd: 10,
          roleInStory: 'Setup',
          mainPressure: 'Discovery',
          promisedPayoff: 'First climax',
          characterArcMovement: 'Growth',
          relationshipMovement: 'Bonding',
          worldExpansion: 'Reveal',
          endingTurn: 'Betrayal',
        },
      ];
      const cards = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          title: 'Chapter 1',
          plotFunction: 'Setup',
          povCharacterId: null,
          externalConflict: 'External threat',
          internalConflict: 'Self doubt',
          relationshipChange: 'Meet ally',
          worldRuleUsedOrTested: 'Magic rule',
          informationReveal: 'Secret revealed',
          readerReward: 'breakthrough' as const,
          endingHook: 'Cliffhanger',
          mustChange: 'Must learn courage',
          forbiddenMoves: [],
        },
      ];
      const budgets = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          pressureLevel: 'high' as const,
          dominantTension: 'danger' as const,
          requiredTurn: 'Plot twist',
          forcedChoice: 'Sacrifice',
          costToPay: 'Loss of ally',
          irreversibleChange: 'World shift',
          readerQuestion: 'Who survives?',
          hookPressure: 'Immediate danger',
          flatnessRisks: [],
        },
      ];

      aggregate.createFromBundle(bookId, {
        worldSetting: '',
        masterOutline: '',
        volumeOutlines: [],
        chapterOutlines: [],
        volumePlans: plans,
        chapterCards: cards,
        chapterTensionBudgets: budgets,
      });

      expect(upsertManyPlans).toHaveBeenCalledWith(bookId, plans);
      expect(upsertManyCards).toHaveBeenCalledWith(cards);
      expect(upsertManyBudgets).toHaveBeenCalledWith(budgets);
    });

    it('saves thread actions, character pressures, and relationship actions per card', () => {
      const upsertThreadActions = vi.fn();
      const upsertCharacterPressures = vi.fn();
      const upsertRelationshipActions = vi.fn();

      const aggregate = createStoryPlanAggregate({
        chapterCards: {
          upsertMany: vi.fn(),
          upsertThreadActions,
          upsertCharacterPressures,
          upsertRelationshipActions,
        },
      });

      const cards = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          title: 'Chapter 1',
          plotFunction: 'Setup',
          povCharacterId: null,
          externalConflict: 'External threat',
          internalConflict: 'Self doubt',
          relationshipChange: 'Meet ally',
          worldRuleUsedOrTested: 'Magic rule',
          informationReveal: 'Secret',
          readerReward: 'breakthrough' as const,
          endingHook: 'Hook',
          mustChange: 'Must change',
          forbiddenMoves: [],
        },
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 2,
          title: 'Chapter 2',
          plotFunction: 'Rising action',
          povCharacterId: null,
          externalConflict: 'Conflict',
          internalConflict: 'Doubt',
          relationshipChange: 'Strained',
          worldRuleUsedOrTested: 'Taboo',
          informationReveal: 'None',
          readerReward: 'reversal' as const,
          endingHook: 'Cliff',
          mustChange: 'Must grow',
          forbiddenMoves: [],
        },
      ];

      const threadActions = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          threadId: 'thread-1',
          action: 'plant' as const,
          requiredEffect: 'Plant mystery',
        },
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 2,
          threadId: 'thread-1',
          action: 'advance' as const,
          requiredEffect: 'Deepen mystery',
        },
      ];

      const characterPressures = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          characterId: 'char-1',
          desirePressure: 'Want power',
          fearPressure: 'Fear loss',
          flawTrigger: 'Hubris',
          expectedChoice: 'Rash action',
        },
      ];

      const relationshipActions = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 2,
          relationshipId: 'rel-1',
          action: 'strain' as const,
          requiredChange: 'Trust broken',
        },
      ];

      aggregate.createFromBundle(bookId, {
        worldSetting: '',
        masterOutline: '',
        volumeOutlines: [],
        chapterOutlines: [],
        chapterCards: cards,
        chapterThreadActions: threadActions,
        chapterCharacterPressures: characterPressures,
        chapterRelationshipActions: relationshipActions,
      });

      // Chapter 1 should get thread action for thread-1
      expect(upsertThreadActions).toHaveBeenCalledWith(
        bookId,
        0,
        1,
        [threadActions[0]]
      );
      // Chapter 2 should get thread action for thread-1
      expect(upsertThreadActions).toHaveBeenCalledWith(
        bookId,
        0,
        2,
        [threadActions[1]]
      );

      // Chapter 1 should get character pressure
      expect(upsertCharacterPressures).toHaveBeenCalledWith(
        bookId,
        0,
        1,
        characterPressures
      );
      // Chapter 2 gets empty character pressures
      expect(upsertCharacterPressures).toHaveBeenCalledWith(
        bookId,
        0,
        2,
        []
      );

      // Chapter 1 gets empty relationship actions
      expect(upsertRelationshipActions).toHaveBeenCalledWith(
        bookId,
        0,
        1,
        []
      );
      // Chapter 2 should get relationship action
      expect(upsertRelationshipActions).toHaveBeenCalledWith(
        bookId,
        0,
        2,
        relationshipActions
      );
    });

    it('skips optional bundle fields when absent', () => {
      const upsertManyPlans = vi.fn();
      const upsertManyCards = vi.fn();
      const upsertManyBudgets = vi.fn();

      const aggregate = createStoryPlanAggregate({
        volumePlans: { upsertMany: upsertManyPlans },
        chapterCards: { upsertMany: upsertManyCards },
        chapterTensionBudgets: { upsertMany: upsertManyBudgets },
      });

      aggregate.createFromBundle(bookId, {
        worldSetting: '',
        masterOutline: '',
        volumeOutlines: [],
        chapterOutlines: [],
      });

      expect(upsertManyPlans).not.toHaveBeenCalled();
      expect(upsertManyCards).not.toHaveBeenCalled();
      expect(upsertManyBudgets).not.toHaveBeenCalled();
    });
  });

  describe('listChapterCards', () => {
    it('returns chapter cards from the repo', () => {
      const cards = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          title: 'Chapter 1',
          plotFunction: 'Setup',
        },
      ];
      const listByBook = vi.fn().mockReturnValue(cards);
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn(), listByBook },
      });

      const result = aggregate.listChapterCards(bookId);

      expect(result).toEqual(cards);
      expect(listByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns empty array when chapterCards repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.listChapterCards(bookId)).toEqual([]);
    });

    it('returns empty array when listByBook is absent', () => {
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn() },
      });

      expect(aggregate.listChapterCards(bookId)).toEqual([]);
    });
  });

  describe('getNextUnwritten', () => {
    it('returns next unwritten chapter card from the repo', () => {
      const card = {
        bookId,
        volumeIndex: 0,
        chapterIndex: 3,
        title: 'Chapter 3',
        plotFunction: 'Climax',
      };
      const getNextUnwritten = vi.fn().mockReturnValue(card);
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn(), getNextUnwritten },
      });

      const result = aggregate.getNextUnwritten(bookId);

      expect(result).toEqual(card);
      expect(getNextUnwritten).toHaveBeenCalledWith(bookId);
    });

    it('returns null when no unwritten card exists', () => {
      const getNextUnwritten = vi.fn().mockReturnValue(null);
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn(), getNextUnwritten },
      });

      expect(aggregate.getNextUnwritten(bookId)).toBeNull();
    });

    it('returns null when chapterCards repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.getNextUnwritten(bookId)).toBeNull();
    });
  });

  describe('listTensionBudgets', () => {
    it('returns tension budgets from the repo', () => {
      const budgets = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          pressureLevel: 'high' as const,
          dominantTension: 'danger' as const,
        },
      ];
      const listByBook = vi.fn().mockReturnValue(budgets);
      const aggregate = createStoryPlanAggregate({
        chapterTensionBudgets: { upsertMany: vi.fn(), listByBook },
      });

      const result = aggregate.listTensionBudgets(bookId);

      expect(result).toEqual(budgets);
      expect(listByBook).toHaveBeenCalledWith(bookId);
    });

    it('returns empty array when chapterTensionBudgets repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.listTensionBudgets(bookId)).toEqual([]);
    });
  });

  describe('getTensionBudgetByChapter', () => {
    it('returns budget matching the chapter', () => {
      const budget = {
        bookId,
        volumeIndex: 0,
        chapterIndex: 1,
        pressureLevel: 'high' as const,
        dominantTension: 'danger' as const,
      };
      const getByChapter = vi.fn().mockReturnValue(budget);
      const aggregate = createStoryPlanAggregate({
        chapterTensionBudgets: { upsertMany: vi.fn(), getByChapter },
      });

      const result = aggregate.getTensionBudgetByChapter(bookId, 0, 1);

      expect(result).toEqual(budget);
      expect(getByChapter).toHaveBeenCalledWith(bookId, 0, 1);
    });

    it('returns null when no budget matches', () => {
      const getByChapter = vi.fn().mockReturnValue(null);
      const aggregate = createStoryPlanAggregate({
        chapterTensionBudgets: { upsertMany: vi.fn(), getByChapter },
      });

      expect(aggregate.getTensionBudgetByChapter(bookId, 0, 5)).toBeNull();
    });

    it('returns null when chapterTensionBudgets repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.getTensionBudgetByChapter(bookId, 0, 1)).toBeNull();
    });
  });

  describe('listThreadActions', () => {
    it('returns thread actions from the repo', () => {
      const actions = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          threadId: 'thread-1',
          action: 'plant' as const,
          requiredEffect: 'Plant mystery',
        },
      ];
      const listThreadActions = vi.fn().mockReturnValue(actions);
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn(), listThreadActions },
      });

      const result = aggregate.listThreadActions(bookId, 0, 1);

      expect(result).toEqual(actions);
      expect(listThreadActions).toHaveBeenCalledWith(bookId, 0, 1);
    });

    it('returns empty array when chapterCards repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.listThreadActions(bookId, 0, 1)).toEqual([]);
    });

    it('returns empty array when listThreadActions is absent', () => {
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn() },
      });

      expect(aggregate.listThreadActions(bookId, 0, 1)).toEqual([]);
    });
  });

  describe('listCharacterPressures', () => {
    it('returns character pressures from the repo', () => {
      const pressures = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          characterId: 'char-1',
          desirePressure: 'Want power',
          fearPressure: 'Fear loss',
          flawTrigger: 'Hubris',
          expectedChoice: 'Rash action',
        },
      ];
      const listCharacterPressures = vi.fn().mockReturnValue(pressures);
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn(), listCharacterPressures },
      });

      const result = aggregate.listCharacterPressures(bookId, 0, 1);

      expect(result).toEqual(pressures);
      expect(listCharacterPressures).toHaveBeenCalledWith(bookId, 0, 1);
    });

    it('returns empty array when chapterCards repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.listCharacterPressures(bookId, 0, 1)).toEqual([]);
    });
  });

  describe('listRelationshipActions', () => {
    it('returns relationship actions from the repo', () => {
      const actions = [
        {
          bookId,
          volumeIndex: 0,
          chapterIndex: 1,
          relationshipId: 'rel-1',
          action: 'strain' as const,
          requiredChange: 'Trust broken',
        },
      ];
      const listRelationshipActions = vi.fn().mockReturnValue(actions);
      const aggregate = createStoryPlanAggregate({
        chapterCards: { upsertMany: vi.fn(), listRelationshipActions },
      });

      const result = aggregate.listRelationshipActions(bookId, 0, 1);

      expect(result).toEqual(actions);
      expect(listRelationshipActions).toHaveBeenCalledWith(bookId, 0, 1);
    });

    it('returns empty array when chapterCards repo is absent', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.listRelationshipActions(bookId, 0, 1)).toEqual([]);
    });
  });

  describe('with all repos absent', () => {
    it('all read operations return safe defaults', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(aggregate.listChapterCards(bookId)).toEqual([]);
      expect(aggregate.getNextUnwritten(bookId)).toBeNull();
      expect(aggregate.listTensionBudgets(bookId)).toEqual([]);
      expect(aggregate.getTensionBudgetByChapter(bookId, 0, 1)).toBeNull();
      expect(aggregate.listThreadActions(bookId, 0, 1)).toEqual([]);
      expect(aggregate.listCharacterPressures(bookId, 0, 1)).toEqual([]);
      expect(aggregate.listRelationshipActions(bookId, 0, 1)).toEqual([]);
    });

    it('createFromBundle is a no-op', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(() =>
        aggregate.createFromBundle(bookId, {
          worldSetting: '',
          masterOutline: '',
          volumeOutlines: [],
          chapterOutlines: [],
        })
      ).not.toThrow();
    });

    it('createFromBundle with full bundle data is a no-op', () => {
      const aggregate = createStoryPlanAggregate({});

      expect(() =>
        aggregate.createFromBundle(bookId, {
          worldSetting: '',
          masterOutline: '',
          volumeOutlines: [],
          chapterOutlines: [],
          volumePlans: [
            {
              volumeIndex: 0,
              title: 'V1',
              chapterStart: 1,
              chapterEnd: 10,
              roleInStory: 'Setup',
              mainPressure: 'Discovery',
              promisedPayoff: 'Climax',
              characterArcMovement: 'Growth',
              relationshipMovement: 'Bond',
              worldExpansion: 'Reveal',
              endingTurn: 'Turn',
            },
          ],
          chapterCards: [
            {
              bookId,
              volumeIndex: 0,
              chapterIndex: 1,
              title: 'Ch1',
              plotFunction: 'Setup',
              povCharacterId: null,
              externalConflict: 'Threat',
              internalConflict: 'Doubt',
              relationshipChange: 'Meet',
              worldRuleUsedOrTested: 'Rule',
              informationReveal: 'Secret',
              readerReward: 'breakthrough' as const,
              endingHook: 'Hook',
              mustChange: 'Change',
              forbiddenMoves: [],
            },
          ],
          chapterTensionBudgets: [
            {
              bookId,
              volumeIndex: 0,
              chapterIndex: 1,
              pressureLevel: 'high' as const,
              dominantTension: 'danger' as const,
              requiredTurn: 'Twist',
              forcedChoice: 'Choice',
              costToPay: 'Cost',
              irreversibleChange: 'Change',
              readerQuestion: 'Question',
              hookPressure: 'Pressure',
              flatnessRisks: [],
            },
          ],
          chapterThreadActions: [
            {
              bookId,
              volumeIndex: 0,
              chapterIndex: 1,
              threadId: 't-1',
              action: 'plant' as const,
              requiredEffect: 'Effect',
            },
          ],
          chapterCharacterPressures: [
            {
              bookId,
              volumeIndex: 0,
              chapterIndex: 1,
              characterId: 'c-1',
              desirePressure: 'Desire',
              fearPressure: 'Fear',
              flawTrigger: 'Flaw',
              expectedChoice: 'Choice',
            },
          ],
          chapterRelationshipActions: [
            {
              bookId,
              volumeIndex: 0,
              chapterIndex: 1,
              relationshipId: 'r-1',
              action: 'strain' as const,
              requiredChange: 'Change',
            },
          ],
        })
      ).not.toThrow();
    });
  });
});
