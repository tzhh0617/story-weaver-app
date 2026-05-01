import type { BookGenerationEvent } from '@story-weaver/shared/contracts';

export function createLoggingService(deps: {
  books: { getById: (bookId: string) => { title: string } | undefined };
  logs: { emit: (entry: any) => void };
}) {
  function getBookSnapshot(bookId: string) {
    const book = deps.books.getById(bookId);

    return {
      bookId,
      bookTitle: book?.title ?? null,
    };
  }

  function logExecution(input: {
    bookId?: string | null;
    level: 'info' | 'success' | 'error';
    eventType: string;
    phase?: string | null;
    message: string;
    volumeIndex?: number | null;
    chapterIndex?: number | null;
    errorMessage?: string | null;
  }) {
    deps.logs.emit({
      ...(input.bookId ? getBookSnapshot(input.bookId) : {}),
      level: input.level,
      eventType: input.eventType,
      phase: input.phase ?? null,
      message: input.message,
      volumeIndex: input.volumeIndex ?? null,
      chapterIndex: input.chapterIndex ?? null,
      errorMessage: input.errorMessage ?? null,
    });
  }

  function classifyProgressEvent(event: Extract<BookGenerationEvent, { type: 'progress' }>) {
    if (event.phase === 'naming_title') {
      return 'book_title_generation';
    }
    if (event.phase === 'building_world') {
      return 'story_world_planning';
    }
    if (event.phase === 'building_outline') {
      return 'story_outline_planning';
    }
    if (event.phase === 'planning_chapters') {
      return 'chapter_planning';
    }
    if (event.phase === 'auditing_chapter') {
      return 'chapter_auditing';
    }
    if (event.phase === 'revising_chapter') {
      return 'chapter_revision';
    }
    if (event.phase === 'extracting_continuity') {
      return 'chapter_continuity_extraction';
    }
    if (event.phase === 'extracting_state') {
      return 'chapter_state_extraction';
    }
    if (event.phase === 'checkpoint_review') {
      return 'narrative_checkpoint';
    }
    if (/重写第 \d+ 章/.test(event.stepLabel)) {
      return 'chapter_rewriting';
    }
    if (/写第 \d+ 章/.test(event.stepLabel)) {
      return 'chapter_writing';
    }

    return 'book_progress';
  }

  function logGenerationEvent(event: BookGenerationEvent) {
    if (event.type === 'progress') {
      logExecution({
        bookId: event.bookId,
        level: 'info',
        eventType: classifyProgressEvent(event),
        phase: event.phase,
        message: event.stepLabel,
        volumeIndex: event.currentVolume ?? null,
        chapterIndex: event.currentChapter ?? null,
      });
      return;
    }

    if (event.type === 'chapter-complete') {
      logExecution({
        bookId: event.bookId,
        level: 'success',
        eventType: 'chapter_completed',
        message: `第 ${event.chapterIndex} 章完成`,
        volumeIndex: event.volumeIndex,
        chapterIndex: event.chapterIndex,
      });
      return;
    }

    if (event.type === 'error') {
      logExecution({
        bookId: event.bookId,
        level: 'error',
        eventType: 'book_failed',
        phase: event.phase,
        message: event.stepLabel,
        volumeIndex: event.currentVolume ?? null,
        chapterIndex: event.currentChapter ?? null,
        errorMessage: event.error,
      });
    }
  }

  return { getBookSnapshot, logExecution, classifyProgressEvent, logGenerationEvent };
}
