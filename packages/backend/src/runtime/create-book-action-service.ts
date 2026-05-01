export function createBookActionService(deps: {
  bookService: {
    pauseBook: (bookId: string) => void;
    writeNextChapter: (bookId: string) => Promise<unknown>;
    writeRemainingChapters: (bookId: string) => Promise<{
      completedChapters: number;
      status: 'completed' | 'paused' | 'deleted';
    }>;
    restartBook: (bookId: string) => Promise<{
      completedChapters: number;
      status: 'completed' | 'paused' | 'deleted';
    } | void>;
    deleteBook: (bookId: string) => void;
  };
  bookRunner: {
    runBook: (bookId: string) => Promise<void>;
    continueBook: (bookId: string) => Promise<void>;
    markBookErrored: (bookId: string, error: unknown) => void;
  };
  scheduler: {
    register: (input: { bookId: string; start: () => Promise<void> }) => void;
    start: (bookId: string) => Promise<void>;
    unregister: (bookId: string) => void;
  };
  progress: {
    getByBookId: (bookId: string) => {
      phase: string | null;
      stepLabel: string | null;
    } | undefined;
  };
  logging: {
    logExecution: (input: {
      bookId?: string | null;
      level: 'info' | 'success' | 'error';
      eventType: string;
      phase?: string | null;
      message: string;
      errorMessage?: string | null;
    }) => void;
  };
  emitSchedulerStatus: () => void;
}) {
  async function startBook(bookId: string) {
    deps.logging.logExecution({
      bookId,
      level: 'info',
      eventType: 'book_queued',
      message: '作品已加入后台执行队列',
    });
    deps.scheduler.register({
      bookId,
      start: async () => deps.bookRunner.runBook(bookId),
    });
    await deps.scheduler.start(bookId);
  }

  function pauseBook(bookId: string) {
    deps.bookService.pauseBook(bookId);
    deps.logging.logExecution({
      bookId,
      level: 'info',
      eventType: 'book_paused',
      phase: 'paused',
      message: '作品已暂停',
    });
    deps.emitSchedulerStatus();
  }

  async function writeNextChapter(bookId: string) {
    deps.logging.logExecution({
      bookId,
      level: 'info',
      eventType: 'book_write_next',
      phase: 'writing',
      message: '开始手动写下一章',
    });

    try {
      return await deps.bookService.writeNextChapter(bookId);
    } catch (error) {
      const currentProgress = deps.progress.getByBookId(bookId);
      deps.logging.logExecution({
        bookId,
        level: 'error',
        eventType: 'book_failed',
        phase: currentProgress?.phase ?? null,
        message: currentProgress?.stepLabel ?? '手动写下一章失败',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async function writeRemainingChapters(bookId: string) {
    deps.logging.logExecution({
      bookId,
      level: 'info',
      eventType: 'book_write_all',
      phase: 'writing',
      message: '开始手动写完剩余章节',
    });

    try {
      const result = await deps.bookService.writeRemainingChapters(bookId);
      if (result.status === 'completed') {
        deps.logging.logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }

      return result;
    } catch (error) {
      const currentProgress = deps.progress.getByBookId(bookId);
      deps.logging.logExecution({
        bookId,
        level: 'error',
        eventType: 'book_failed',
        phase: currentProgress?.phase ?? null,
        message: currentProgress?.stepLabel ?? '手动写完剩余章节失败',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async function resumeBook(bookId: string) {
    deps.logging.logExecution({
      bookId,
      level: 'info',
      eventType: 'book_resumed',
      phase: 'writing',
      message: '作品已恢复后台执行',
    });
    deps.scheduler.register({
      bookId,
      start: async () => deps.bookRunner.continueBook(bookId),
    });
    await deps.scheduler.start(bookId);
  }

  async function restartBook(bookId: string) {
    deps.logging.logExecution({
      bookId,
      level: 'info',
      eventType: 'book_restarted',
      phase: 'building_outline',
      message: '作品已重新开始后台执行',
    });
    try {
      const result = await deps.bookService.restartBook(bookId);
      if (result?.status === 'completed') {
        deps.logging.logExecution({
          bookId,
          level: 'success',
          eventType: 'book_completed',
          phase: 'completed',
          message: '后台执行完成',
        });
      }
    } catch (error) {
      deps.bookRunner.markBookErrored(bookId, error);
      throw error;
    }
    deps.emitSchedulerStatus();
  }

  async function deleteBook(bookId: string) {
    deps.scheduler.unregister(bookId);
    deps.bookService.deleteBook(bookId);
    deps.emitSchedulerStatus();
  }

  return {
    startBook,
    pauseBook,
    writeNextChapter,
    writeRemainingChapters,
    resumeBook,
    restartBook,
    deleteBook,
  };
}
