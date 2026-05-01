import { describe, expect, it } from 'vitest';
import {
  buildStoredChapterContext,
  selectOpenThreads,
} from '@story-weaver/backend/core/consistency';

describe('selectOpenThreads', () => {
  it('returns unresolved threads ordered by nearest expected payoff', () => {
    const result = selectOpenThreads([
      { id: 'late', expectedPayoff: 40, resolvedAt: null },
      { id: 'soon', expectedPayoff: 12, resolvedAt: null },
      { id: 'closed', expectedPayoff: 8, resolvedAt: 8 },
    ]);

    expect(result.map((thread) => thread.id)).toEqual(['soon', 'late']);
  });
});

describe('buildStoredChapterContext', () => {
  it('keeps the current chapter outline while trimming oversized stored context', () => {
    const result = buildStoredChapterContext({
      worldSetting: Array.from(
        { length: 20 },
        (_, index) => `World rule ${index}: ${'x'.repeat(30)}`
      ).join('\n'),
      characterStates: Array.from({ length: 10 }, (_, index) => ({
        characterName: `Character ${index}`,
        location: `Location ${index}`,
        status: `Status ${index} ${'y'.repeat(30)}`,
        knowledge: `Knowledge ${index}`,
        emotion: 'Focused',
        powerLevel: 'Awakened',
      })),
      plotThreads: Array.from({ length: 10 }, (_, index) => ({
        id: `thread-${index}`,
        description: `Thread description ${index} ${'z'.repeat(30)}`,
        plantedAt: index,
        expectedPayoff: index + 2,
        resolvedAt: null,
        importance: 'normal',
      })),
      latestScene: {
        location: 'Archive Gate',
        timeInStory: 'Dawn',
        charactersPresent: ['Lin Mo'],
        events: 'A very long scene event that should be trimmed if needed',
      },
      chapters: [
        {
          volumeIndex: 1,
          chapterIndex: 1,
          summary: `Previous summary ${'s'.repeat(60)}`,
          content: `Previous chapter content ${'c'.repeat(300)}`,
        },
      ],
      currentChapter: {
        volumeIndex: 1,
        chapterIndex: 2,
        outline: 'Escalate the debt court conflict.',
      },
      maxCharacters: 260,
    });

    expect(result.length).toBeLessThanOrEqual(260);
    expect(result).toContain(
      'Current chapter outline: Escalate the debt court conflict.'
    );
    expect(result).toContain('World rules:');
    expect(result).not.toContain('World rule 19');
  });
});
