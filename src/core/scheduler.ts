export type SchedulerTaskType =
  | 'book:plan:init'
  | 'book:plan:rebuild-arc'
  | 'book:plan:rebuild-chapters'
  | 'book:write:chapter';

type Runner = {
  taskKey: string;
  bookId: string;
  taskType: SchedulerTaskType;
  start: () => Promise<void>;
};

function isPlanningTask(taskType: SchedulerTaskType) {
  return taskType.startsWith('book:plan:');
}

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
  const runningTaskKeys = new Set<string>();
  const runningBooksByTaskKey = new Map<string, string>();

  function enqueueTask(taskKey: string) {
    if (!queue.includes(taskKey) && !runningTaskKeys.has(taskKey) && runners.has(taskKey)) {
      queue.push(taskKey);
    }
  }

  function emitStatus() {
    onStatusChange?.({
      runningBookIds: [...new Set(runningBooksByTaskKey.values())],
      queuedBookIds: queue
        .map((taskKey) => runners.get(taskKey)?.bookId)
        .filter((bookId): bookId is string => Boolean(bookId)),
      concurrencyLimit: currentConcurrencyLimit,
    });
  }

  function isBookRunning(bookId: string) {
    return [...runningBooksByTaskKey.values()].includes(bookId);
  }

  function sortQueue() {
    queue.sort((leftTaskKey, rightTaskKey) => {
      const leftRunner = runners.get(leftTaskKey);
      const rightRunner = runners.get(rightTaskKey);

      if (!leftRunner || !rightRunner) {
        return 0;
      }

      const leftPriority = isPlanningTask(leftRunner.taskType) ? 0 : 1;
      const rightPriority = isPlanningTask(rightRunner.taskType) ? 0 : 1;

      return leftPriority - rightPriority;
    });
  }

  function pumpQueue() {
    const limit = currentConcurrencyLimit ?? Number.POSITIVE_INFINITY;

    while (runningTaskKeys.size < limit && queue.length > 0) {
      sortQueue();
      const nextTaskKeyIndex = queue.findIndex((taskKey) => {
        const runner = runners.get(taskKey);
        return runner ? !isBookRunning(runner.bookId) : false;
      });

      if (nextTaskKeyIndex < 0) {
        break;
      }

      const [nextTaskKey] = queue.splice(nextTaskKeyIndex, 1);
      if (!nextTaskKey) {
        break;
      }

      const runner = runners.get(nextTaskKey);
      if (!runner || isBookRunning(runner.bookId)) {
        continue;
      }

      runningTaskKeys.add(nextTaskKey);
      runningBooksByTaskKey.set(nextTaskKey, runner.bookId);
      emitStatus();

      void runner.start().finally(() => {
        runningTaskKeys.delete(nextTaskKey);
        runningBooksByTaskKey.delete(nextTaskKey);
        emitStatus();
        pumpQueue();
      });
    }
  }

  return {
    register(runner: Runner) {
      runners.set(runner.taskKey, runner);
    },

    async startAll() {
      for (const [taskKey] of runners) {
        if (!queue.includes(taskKey) && !runningTaskKeys.has(taskKey)) {
          queue.push(taskKey);
        }
      }

      emitStatus();
      pumpQueue();
    },

    async start(taskKey: string) {
      const runner = runners.get(taskKey);

      if (runner && !isPlanningTask(runner.taskType)) {
        for (const siblingRunner of runners.values()) {
          if (
            siblingRunner.bookId === runner.bookId &&
            isPlanningTask(siblingRunner.taskType)
          ) {
            enqueueTask(siblingRunner.taskKey);
          }
        }
      }

      enqueueTask(taskKey);

      emitStatus();
      pumpQueue();
    },

    pauseAll() {
      queue.splice(0, queue.length);
      emitStatus();
    },

    unregister(taskKeyOrBookId: string) {
      const taskKeysToRemove = runners.has(taskKeyOrBookId)
        ? [taskKeyOrBookId]
        : [...runners.values()]
            .filter((runner) => runner.bookId === taskKeyOrBookId)
            .map((runner) => runner.taskKey);

      for (const taskKey of taskKeysToRemove) {
        runners.delete(taskKey);
        const queueIndex = queue.indexOf(taskKey);
        if (queueIndex >= 0) {
          queue.splice(queueIndex, 1);
        }
      }

      if (taskKeysToRemove.length === 0) {
        const queueIndex = queue.indexOf(taskKeyOrBookId);
        if (queueIndex >= 0) {
          queue.splice(queueIndex, 1);
        }
      }

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
        runningBookIds: [...new Set(runningBooksByTaskKey.values())],
        queuedBookIds: queue
          .map((taskKey) => runners.get(taskKey)?.bookId)
          .filter((bookId): bookId is string => Boolean(bookId)),
        concurrencyLimit: currentConcurrencyLimit,
      };
    },
  };
}
