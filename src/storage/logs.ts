import type {
  ExecutionLogLevel,
  ExecutionLogRecord,
} from '../shared/contracts.js';

type ExecutionLogInput = {
  bookId?: string | null;
  bookTitle?: string | null;
  level: ExecutionLogLevel;
  eventType: string;
  phase?: string | null;
  message: string;
  volumeIndex?: number | null;
  chapterIndex?: number | null;
  errorMessage?: string | null;
};

export function createExecutionLogStream() {
  let nextId = 1;
  const listeners = new Set<(log: ExecutionLogRecord) => void>();

  return {
    emit(input: ExecutionLogInput) {
      const log: ExecutionLogRecord = {
        id: nextId,
        bookId: input.bookId ?? null,
        bookTitle: input.bookTitle ?? null,
        level: input.level,
        eventType: input.eventType,
        phase: input.phase ?? null,
        message: input.message,
        volumeIndex: input.volumeIndex ?? null,
        chapterIndex: input.chapterIndex ?? null,
        errorMessage: input.errorMessage ?? null,
        createdAt: new Date().toISOString(),
      };
      nextId += 1;

      for (const listener of listeners) {
        listener(log);
      }

      return log;
    },

    subscribe(listener: (log: ExecutionLogRecord) => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
