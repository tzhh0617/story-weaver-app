import type { BookGenerationEvent } from '@story-weaver/shared/contracts';

export type SchedulerStatusView = {
  runningBookIds: string[];
  queuedBookIds: string[];
  pausedBookIds: string[];
  concurrencyLimit: number | null;
};

export function createEventBroadcastService(deps: {
  getSchedulerStatus: () => {
    runningBookIds: string[];
    queuedBookIds: string[];
    concurrencyLimit: number | null;
  };
  getBooks: () => Array<{ id: string; status: string }>;
  logging: { logGenerationEvent: (event: BookGenerationEvent) => void };
}) {
  const schedulerListeners = new Set<(status: SchedulerStatusView) => void>();
  const bookGenerationListeners = new Set<(event: BookGenerationEvent) => void>();

  function currentSchedulerStatus(): SchedulerStatusView {
    const schedulerStatus = deps.getSchedulerStatus();
    return {
      ...schedulerStatus,
      pausedBookIds: deps
        .getBooks()
        .filter((book) => book.status === 'paused')
        .map((book) => book.id),
    };
  }

  function emitSchedulerStatus() {
    const status = currentSchedulerStatus();
    for (const listener of schedulerListeners) {
      listener(status);
    }
  }

  function emitBookGeneration(event: BookGenerationEvent) {
    deps.logging.logGenerationEvent(event);

    for (const listener of bookGenerationListeners) {
      listener(event);
    }
  }

  function subscribeSchedulerStatus(
    listener: (status: SchedulerStatusView) => void
  ) {
    schedulerListeners.add(listener);
    listener(currentSchedulerStatus());
    return () => {
      schedulerListeners.delete(listener);
    };
  }

  function subscribeBookGeneration(
    listener: (event: BookGenerationEvent) => void
  ) {
    bookGenerationListeners.add(listener);
    return () => {
      bookGenerationListeners.delete(listener);
    };
  }

  function clear() {
    schedulerListeners.clear();
    bookGenerationListeners.clear();
  }

  return {
    currentSchedulerStatus,
    emitSchedulerStatus,
    emitBookGeneration,
    subscribeSchedulerStatus,
    subscribeBookGeneration,
    clear,
  };
}
