import type { BookGenerationEvent, BookStatus } from '@story-weaver/shared/contracts';
import { countStoryCharacters } from '../../story-constraints.js';
import { isBookPaused } from '../book/index.js';
import { buildShortChapterRewritePrompt } from './chapter-types.js';
import type { ProgressTrackerDeps } from './progress-tracker.js';

export type DraftWriterDeps = {
  books: {
    getById: (bookId: string) =>
      | { id: string; title: string; status: string }
      | undefined;
    updateStatus: (bookId: string, status: BookStatus) => void;
  };
  chapterWriter: {
    writeChapter: (input: {
      modelId: string;
      prompt: string;
      onChunk?: (chunk: string) => void;
    }) => Promise<{
      content: string;
      usage?: { inputTokens?: number; outputTokens?: number };
    }>;
  };
  shouldRewriteShortChapter?: (input: {
    content: string;
    wordsPerChapter: number;
  }) => boolean;
} & ProgressTrackerDeps;

export function createDraftWriter(deps: DraftWriterDeps) {
  async function writeDraft(input: {
    bookId: string;
    modelId: string;
    prompt: string;
    volumeIndex: number;
    chapterIndex: number;
    title: string;
    wordsPerChapter: number;
  }): Promise<{ result: { content: string; usage?: { inputTokens?: number; outputTokens?: number } }; deleted: boolean; paused: boolean }> {
    const writingStepLabel = `正在写第 ${input.chapterIndex} 章`;

    deps.progress.updatePhase(input.bookId, 'writing', {
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
      stepLabel: writingStepLabel,
    });
    deps.onGenerationEvent?.({
      bookId: input.bookId,
      type: 'progress',
      phase: 'writing',
      stepLabel: writingStepLabel,
      currentVolume: input.volumeIndex,
      currentChapter: input.chapterIndex,
    });

    let result = await deps.chapterWriter.writeChapter({
      modelId: input.modelId,
      prompt: input.prompt,
      onChunk: (delta) => {
        if (!isBookPaused(deps, input.bookId)) {
          deps.onGenerationEvent?.({
            bookId: input.bookId,
            type: 'chapter-stream',
            volumeIndex: input.volumeIndex,
            chapterIndex: input.chapterIndex,
            title: input.title,
            delta,
          });
        }
      },
    });

    const bookAfterDraft = deps.books.getById(input.bookId);
    if (!bookAfterDraft) {
      return {
        result,
        deleted: true,
        paused: false,
      };
    }
    if (bookAfterDraft.status === 'paused') {
      deps.progress.updatePhase(input.bookId, 'paused');
      deps.onBookUpdated?.(input.bookId);
      return {
        result,
        deleted: false,
        paused: true,
      };
    }

    if (
      deps.shouldRewriteShortChapter?.({
        content: result.content,
        wordsPerChapter: input.wordsPerChapter,
      })
    ) {
      const rewriteStepLabel = `正在重写第 ${input.chapterIndex} 章`;
      deps.progress.updatePhase(input.bookId, 'writing', {
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
        stepLabel: rewriteStepLabel,
      });
      deps.onGenerationEvent?.({
        bookId: input.bookId,
        type: 'progress',
        phase: 'writing',
        stepLabel: rewriteStepLabel,
        currentVolume: input.volumeIndex,
        currentChapter: input.chapterIndex,
      });

      let isFirstRewriteChunk = true;
      result = await deps.chapterWriter.writeChapter({
        modelId: input.modelId,
        prompt: buildShortChapterRewritePrompt({
          originalPrompt: input.prompt,
          wordsPerChapter: input.wordsPerChapter,
          actualWordCount: countStoryCharacters(result.content),
        }),
        onChunk: (delta) => {
          const streamEvent: BookGenerationEvent = {
            bookId: input.bookId,
            type: 'chapter-stream',
            volumeIndex: input.volumeIndex,
            chapterIndex: input.chapterIndex,
            title: input.title,
            delta,
            ...(isFirstRewriteChunk ? { replace: true } : {}),
          };
          if (!isBookPaused(deps, input.bookId)) {
            deps.onGenerationEvent?.(streamEvent);
          }
          isFirstRewriteChunk = false;
        },
      });
    }

    const bookAfterFinalDraft = deps.books.getById(input.bookId);
    if (!bookAfterFinalDraft) {
      return {
        result,
        deleted: true,
        paused: false,
      };
    }
    if (bookAfterFinalDraft.status === 'paused') {
      deps.progress.updatePhase(input.bookId, 'paused');
      deps.onBookUpdated?.(input.bookId);
      return {
        result,
        deleted: false,
        paused: true,
      };
    }

    return { result, deleted: false, paused: false };
  }

  return { writeDraft };
}
