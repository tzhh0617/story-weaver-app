export function createBatchOperationsService(deps: {
  bookService: {
    listBooks: () => Array<{ id: string; status: string }>;
    pauseBook: (bookId: string) => void;
  };
  logging: {
    logExecution: (input: {
      bookId?: string | null;
      level: 'info' | 'success' | 'error';
      eventType: string;
      phase?: string | null;
      message: string;
    }) => void;
  };
  bookRunner: {
    registerBackgroundRunner: (book: { id: string; status: string }) => void;
  };
  scheduler: { startAll: () => Promise<void>; pauseAll: () => void };
  emitSchedulerStatus: () => void;
}) {
  async function startAllBooks() {
    const runnableBooks = deps.bookService
      .listBooks()
      .filter((book) => book.status !== 'completed' && book.status !== 'paused');

    deps.logging.logExecution({
      level: 'info',
      eventType: 'scheduler_start_all',
      message: `批量开始 ${runnableBooks.length} 本作品`,
    });

    for (const book of runnableBooks) {
      deps.logging.logExecution({
        bookId: book.id,
        level: 'info',
        eventType: 'book_queued',
        message: '作品已加入后台执行队列',
      });
      deps.bookRunner.registerBackgroundRunner(book);
    }

    await deps.scheduler.startAll();
  }

  async function pauseAllBooks() {
    deps.scheduler.pauseAll();

    const pausableBooks = deps.bookService
      .listBooks()
      .filter((book) => book.status !== 'completed' && book.status !== 'paused');

    deps.logging.logExecution({
      level: 'info',
      eventType: 'scheduler_pause_all',
      message: `批量暂停 ${pausableBooks.length} 本作品`,
    });

    for (const book of pausableBooks) {
      deps.bookService.pauseBook(book.id);
      deps.logging.logExecution({
        bookId: book.id,
        level: 'info',
        eventType: 'book_paused',
        phase: 'paused',
        message: '作品已暂停',
      });
    }

    deps.emitSchedulerStatus();
  }

  return { startAllBooks, pauseAllBooks };
}
