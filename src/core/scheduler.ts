type Runner = {
  bookId: string;
  start: () => Promise<void>;
};

export function createScheduler({
  concurrencyLimit,
  onStatusChange,
}: {
  concurrencyLimit: number | null;
  onStatusChange?: (status: {
    runningBookIds: string[];
    queuedBookIds: string[];
    concurrencyLimit: number | null;
  }) => void;
}) {
  let currentConcurrencyLimit = concurrencyLimit;
  const runners = new Map<string, Runner>();
  const queue: string[] = [];
  const running = new Set<string>();

  function emitStatus() {
    onStatusChange?.({
      runningBookIds: [...running],
      queuedBookIds: [...queue],
      concurrencyLimit: currentConcurrencyLimit,
    });
  }

  function pumpQueue() {
    const limit = currentConcurrencyLimit ?? runners.size;

    while (running.size < limit && queue.length > 0) {
      const nextBookId = queue.shift();
      if (!nextBookId) {
        break;
      }

      const runner = runners.get(nextBookId);
      if (!runner || running.has(nextBookId)) {
        continue;
      }

      running.add(nextBookId);
      emitStatus();

      void runner.start().finally(() => {
        running.delete(nextBookId);
        emitStatus();
        pumpQueue();
      });
    }
  }

  return {
    register(runner: Runner) {
      runners.set(runner.bookId, runner);
    },

    async startAll() {
      for (const bookId of runners.keys()) {
        if (!queue.includes(bookId) && !running.has(bookId)) {
          queue.push(bookId);
        }
      }

      emitStatus();
      pumpQueue();
    },

    async start(bookId: string) {
      if (!queue.includes(bookId) && !running.has(bookId) && runners.has(bookId)) {
        queue.push(bookId);
      }

      emitStatus();
      pumpQueue();
    },

    pauseAll() {
      queue.splice(0, queue.length);
      emitStatus();
    },

    unregister(bookId: string) {
      runners.delete(bookId);

      const queueIndex = queue.indexOf(bookId);
      if (queueIndex >= 0) {
        queue.splice(queueIndex, 1);
      }

      running.delete(bookId);
      emitStatus();
      pumpQueue();
    },

    setConcurrencyLimit(limit: number | null) {
      currentConcurrencyLimit = limit;
      emitStatus();
      pumpQueue();
    },

    getStatus() {
      return {
        runningBookIds: [...running],
        queuedBookIds: [...queue],
        concurrencyLimit: currentConcurrencyLimit,
      };
    },
  };
}
