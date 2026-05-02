import { createAuditReviser } from './audit-reviser.js';
import { createCheckpointRunner } from './checkpoint-runner.js';
import { createChapterDiscovery } from './chapter-discovery.js';
import { createContinuityPersister } from './continuity-persister.js';
import { createContextBuilder } from './context-builder.js';
import { createDraftWriter } from './draft-writer.js';
import { createNarrativeStateWriter } from './narrative-state-writer.js';
import type { ChapterAggregateDeps } from './chapter-aggregate-deps.js';

export type { ChapterAggregateDeps } from './chapter-aggregate-deps.js';

export function createChapterAggregate(deps: ChapterAggregateDeps) {
  const discovery = createChapterDiscovery(deps);
  const contextBuilder = createContextBuilder(deps);
  const draftWriter = createDraftWriter(deps);
  const auditReviser = createAuditReviser(deps);
  const continuityPersister = createContinuityPersister(deps);
  const stateWriter = createNarrativeStateWriter(deps);
  const checkpointRunner = createCheckpointRunner(deps);

  async function writeNext(bookId: string) {
    const {
      book,
      context,
      chapters,
      nextChapter,
      chapterCard,
      outline: nextChapterOutline,
      title: nextChapterTitle,
    } = discovery.findNextChapter({ bookId });

    const {
      modelId,
      storyBible,
      effectiveChapterCard,
      legacyContinuityContext,
      commandContext,
      routePlanText,
      prompt,
    } = contextBuilder.buildWriteContext({
      bookId,
      book: {
        title: book.title,
        idea: book.idea,
        wordsPerChapter: book.wordsPerChapter,
        targetChapters: book.targetChapters,
      },
      context,
      chapters,
      nextChapter,
      nextChapterOutline,
      nextChapterTitle,
      chapterCard,
    });

    const draftResult = await draftWriter.writeDraft({
      bookId,
      modelId,
      prompt,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      title: nextChapterTitle,
      wordsPerChapter: book.wordsPerChapter,
    });
    if (draftResult.deleted) {
      return {
        deleted: true as const,
      };
    }
    if (draftResult.paused) {
      return {
        paused: true as const,
      };
    }
    let result = draftResult.result;

    const { result: auditedResult, auditScore, draftAttempts } = await auditReviser.auditAndRevise({
      bookId,
      modelId,
      content: result.content,
      prompt,
      commandContext,
      legacyContinuityContext,
      routePlanText,
      storyBible,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      effectiveChapterCard,
    });
    result = auditedResult;

    const continuityResult = await continuityPersister.extractAndSaveContinuity({
      bookId,
      modelId,
      content: result.content,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      auditScore,
      draftAttempts,
    });
    if (continuityResult.deleted) {
      return {
        deleted: true as const,
      };
    }

    await stateWriter.extractNarrativeState({
      bookId,
      modelId,
      content: result.content,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
    });

    await checkpointRunner.runCheckpoint({
      bookId,
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
    });

    const latestBook = deps.books.getById(bookId);
    if (!latestBook) {
      return {
        deleted: true as const,
      };
    }

    if (latestBook.status === 'paused') {
      deps.progress.updatePhase(bookId, 'paused');
      deps.onBookUpdated?.(bookId);
      return result;
    }

    deps.books.updateStatus(bookId, 'writing');
    deps.progress.updatePhase(bookId, 'writing', {
      currentVolume: nextChapter.volumeIndex,
      currentChapter: nextChapter.chapterIndex,
      stepLabel: `正在生成第 ${nextChapter.chapterIndex} 章摘要与连续性`,
    });
    deps.onGenerationEvent?.({
      bookId,
      type: 'chapter-complete',
      volumeIndex: nextChapter.volumeIndex,
      chapterIndex: nextChapter.chapterIndex,
      title: nextChapterTitle,
    });
    deps.onBookUpdated?.(bookId);

    return result;
  }

  return {
    writeNext,
  };
}
