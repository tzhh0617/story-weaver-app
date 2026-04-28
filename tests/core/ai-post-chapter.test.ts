import { describe, expect, it, vi } from 'vitest';
import {
  createAiChapterUpdateExtractor,
  createAiCharacterStateExtractor,
  createAiPlotThreadExtractor,
  createAiSceneRecordExtractor,
  createAiSummaryGenerator,
} from '../../src/core/ai-post-chapter';

describe('AI post-chapter extractors', () => {
  it('summarizes a chapter with the selected model', async () => {
    const fakeModel = { id: 'model' };
    const registry = {
      languageModel: vi.fn().mockReturnValue(fakeModel),
    };
    const generateText = vi.fn().mockResolvedValue({
      text: 'A concise chapter summary.',
    });

    const generator = createAiSummaryGenerator({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      generator.summarizeChapter({
        modelId: 'openai:gpt-4o-mini',
        content: 'Long chapter content',
      })
    ).resolves.toBe('A concise chapter summary.');
  });

  it('extracts plot threads from JSON text', async () => {
    const registry = {
      languageModel: vi.fn().mockReturnValue({ id: 'model' }),
    };
    const generateText = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        openedThreads: [
          {
            id: 'thread-1',
            description: 'A hidden debt resurfaces later',
            plantedAt: 1,
            expectedPayoff: 6,
            importance: 'critical',
          },
        ],
        resolvedThreadIds: ['thread-0'],
      }),
    });

    const extractor = createAiPlotThreadExtractor({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      extractor.extractThreads({
        modelId: 'openai:gpt-4o-mini',
        chapterIndex: 1,
        content: 'Chapter content',
      })
    ).resolves.toEqual({
      openedThreads: [
        {
          id: 'thread-1',
          description: 'A hidden debt resurfaces later',
          plantedAt: 1,
          expectedPayoff: 6,
          importance: 'critical',
        },
      ],
      resolvedThreadIds: ['thread-0'],
    });
  });

  it('extracts character states from fenced JSON', async () => {
    const registry = {
      languageModel: vi.fn().mockReturnValue({ id: 'model' }),
    };
    const generateText = vi.fn().mockResolvedValue({
      text: [
        '```json',
        JSON.stringify([
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            location: 'Rain Market',
            status: 'Investigating the debt ledger',
            knowledge: 'Knows the ledger is forged',
            emotion: 'Suspicious',
            powerLevel: 'Awakened',
          },
        ]),
        '```',
      ].join('\n'),
    });

    const extractor = createAiCharacterStateExtractor({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      extractor.extractStates({
        modelId: 'openai:gpt-4o-mini',
        chapterIndex: 1,
        content: 'Chapter content',
      })
    ).resolves.toEqual([
      {
        characterId: 'protagonist',
        characterName: 'Lin Mo',
        location: 'Rain Market',
        status: 'Investigating the debt ledger',
        knowledge: 'Knows the ledger is forged',
        emotion: 'Suspicious',
        powerLevel: 'Awakened',
      },
    ]);
  });

  it('extracts the latest scene from JSON text', async () => {
    const registry = {
      languageModel: vi.fn().mockReturnValue({ id: 'model' }),
    };
    const generateText = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        location: 'Debt Court',
        timeInStory: 'Noon',
        charactersPresent: ['Lin Mo'],
        events: 'Lin Mo confronts the magistrate',
      }),
    });

    const extractor = createAiSceneRecordExtractor({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      extractor.extractScene({
        modelId: 'openai:gpt-4o-mini',
        chapterIndex: 2,
        content: 'Chapter content',
      })
    ).resolves.toEqual({
      location: 'Debt Court',
      timeInStory: 'Noon',
      charactersPresent: ['Lin Mo'],
      events: 'Lin Mo confronts the magistrate',
    });
  });

  it('extracts all post-chapter updates with one model call', async () => {
    const registry = {
      languageModel: vi.fn().mockReturnValue({ id: 'model' }),
    };
    const generateText = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        summary: 'Lin Mo opens the sealed vault.',
        openedThreads: [
          {
            id: 'thread-1',
            description: 'The vault debt is unpaid',
            plantedAt: 1,
            expectedPayoff: 3,
            importance: 'critical',
          },
        ],
        resolvedThreadIds: ['thread-0'],
        characterStates: [
          {
            characterId: 'protagonist',
            characterName: 'Lin Mo',
            location: 'Archive Gate',
            status: 'Holding the vault key',
            knowledge: 'Knows the sigil is forged',
            emotion: 'Focused',
            powerLevel: 'Awakened',
          },
        ],
        scene: {
          location: 'Archive Gate',
          timeInStory: 'Dawn',
          charactersPresent: ['Lin Mo'],
          events: 'Lin Mo opens the sealed vault',
        },
      }),
    });

    const extractor = createAiChapterUpdateExtractor({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      extractor.extractChapterUpdate({
        modelId: 'openai:gpt-4o-mini',
        chapterIndex: 1,
        content: 'Chapter content',
      })
    ).resolves.toEqual({
      summary: 'Lin Mo opens the sealed vault.',
      openedThreads: [
        {
          id: 'thread-1',
          description: 'The vault debt is unpaid',
          plantedAt: 1,
          expectedPayoff: 3,
          importance: 'critical',
        },
      ],
      resolvedThreadIds: ['thread-0'],
      characterStates: [
        {
          characterId: 'protagonist',
          characterName: 'Lin Mo',
          location: 'Archive Gate',
          status: 'Holding the vault key',
          knowledge: 'Knows the sigil is forged',
          emotion: 'Focused',
          powerLevel: 'Awakened',
        },
      ],
      scene: {
        location: 'Archive Gate',
        timeInStory: 'Dawn',
        charactersPresent: ['Lin Mo'],
        events: 'Lin Mo opens the sealed vault',
      },
    });

    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('normalizes partial chapter updates from JSON text', async () => {
    const registry = {
      languageModel: vi.fn().mockReturnValue({ id: 'model' }),
    };
    const generateText = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        summary: 'Only summary was returned.',
        scene: null,
      }),
    });

    const extractor = createAiChapterUpdateExtractor({
      registry: registry as never,
      generateText: generateText as never,
    });

    await expect(
      extractor.extractChapterUpdate({
        modelId: 'openai:gpt-4o-mini',
        chapterIndex: 1,
        content: 'Chapter content',
      })
    ).resolves.toEqual({
      summary: 'Only summary was returned.',
      openedThreads: [],
      resolvedThreadIds: [],
      characterStates: [],
      scene: null,
    });
  });
});
