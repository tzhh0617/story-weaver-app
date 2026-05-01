import type { BookGenerationEvent, BookStatus } from '@story-weaver/shared/contracts';

export function createBookRunner(deps: {
  books: { getById: (bookId: string) => any; updateStatus: (bookId: string, status: BookStatus) => void };
  progress: { getByBookId: (bookId: string) => any; updatePhase: (bookId: string, phase: string, extra: any) => void };
  bookService: {
    resumeBook: (bookId: string) => Promise<any>;
    writeRemainingChapters: (bookId: string) => Promise<any>;
    getBookDetail: (bookId: string) => any;
    startBook: (bookId: string) => Promise<void>;
  };
  logExecution: (input: {
    bookId?: string | null;
    level: 'info' | 'success' | 'error';
    eventType: string;
    phase?: string | null;
    message: string;
    volumeIndex?: number | null;
    chapterIndex?: number | null;
    errorMessage?: string | null;
  }) => void;
  emitBookGeneration: (event: BookGenerationEvent) => void;
  emitSchedulerStatus: () => void;
  scheduler: { register: (input: { bookId: string; start: () => Promise<void> }) => void };
  runningBookIds: Set<string>;
  createEngineForBook: (bookId: string) => { start: () => Promise<void> };
}) {
  function markBookErrored(bookId: string, error: unknown) {
    const currentProgress = deps.progress.getByBookId(bookId);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stepLabel = currentProgress?.stepLabel ?? '后台执行失败';

    if (deps.books.getById(bookId)) {
      deps.books.updateStatus(bookId, 'error');
      deps.progress.updatePhase(bookId, 'error', {
        currentVolume: currentProgress?.currentVolume ?? null,
        currentChapter: currentProgress?.currentChapter ?? null,
        stepLabel,
        errorMsg: errorMessage,
      });
    }

    deps.emitBookGeneration({
      bookId,
      type: 'error',
      phase: 'error',
      stepLabel,
      error: errorMessage,
      currentVolume: currentProgress?.currentVolume ?? null,
      currentChapter: currentProgress?.currentChapter ?? null,
    });
    deps.emitSchedulerStatus();
  }

  async function runBook(bookId: string) {
    deps.runningBookIds.add(bookId);
    try {
      deps.logExecution({
        bookId,
        level: 'info',
        eventType: 'book_started',
        phase: 'building_world',
        message: '开始后台执行作品',
      });
      await deps.createEngineForBook(bookId).start();

      const book = deps.books.getById(bookId);
      if (book?.status === 'completed') {
        deps.logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }
    } catch (error) {
      markBookErrored(bookId, error);
    } finally {
      deps.runningBookIds.delete(bookId);
    }
  }

  async function continueBook(bookId: string) {
    deps.runningBookIds.add(bookId);
    try {
      const result = await deps.bookService.resumeBook(bookId);
      if (result?.status === 'completed') {
        deps.logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }
    } catch (error) {
      markBookErrored(bookId, error);
    } finally {
      deps.runningBookIds.delete(bookId);
    }
  }

  function registerBackgroundRunner(book: { id: string; status: string }) {
    deps.scheduler.register({
      bookId: book.id,
      start: async () =>
        book.status === 'writing' || book.status === 'building_outline'
          ? continueBook(book.id)
          : runBook(book.id),
    });
  }

  return { markBookErrored, runBook, continueBook, registerBackgroundRunner };
}
