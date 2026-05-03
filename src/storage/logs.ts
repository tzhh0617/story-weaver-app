import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  ExecutionLogDebugContext,
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
  errorStack?: string | null;
  durationMs?: number | null;
  debugContext?: ExecutionLogDebugContext | null;
};

type ExecutionLogStreamOptions = {
  logDir?: string;
  runId?: string;
  now?: () => Date;
  writeLine?: (filePath: string, line: string) => void;
  maxFileSizeBytes?: number;
  retentionDays?: number;
};

function defaultWriteLine(filePath: string, line: string) {
  appendFileSync(filePath, line, 'utf8');
}

function sanitizeDebugContext(
  value: ExecutionLogDebugContext | null | undefined
): ExecutionLogDebugContext | null {
  if (!value) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as ExecutionLogDebugContext;
}

function buildLogFilePath(logDir: string, date: Date) {
  const day = date.toISOString().slice(0, 10);
  return path.join(logDir, `${day}.log`);
}

function buildRotatedLogFilePath(logDir: string, date: Date, index: number) {
  const day = date.toISOString().slice(0, 10);
  if (index === 0) {
    return path.join(logDir, `${day}.log`);
  }

  return path.join(logDir, `${day}.${index}.log`);
}

function parseLogFileDate(fileName: string) {
  const match = fileName.match(/^(\d{4}-\d{2}-\d{2})(?:\.\d+)?\.log$/);
  if (!match) {
    return null;
  }

  return match[1];
}

export function createExecutionLogStream(options: ExecutionLogStreamOptions = {}) {
  let nextId = 1;
  const listeners = new Set<(log: ExecutionLogRecord) => void>();
  const runId = options.runId ?? randomUUID();
  const now = options.now ?? (() => new Date());
  const writeLine = options.writeLine ?? defaultWriteLine;
  const logDir = options.logDir ?? null;
  const maxFileSizeBytes = options.maxFileSizeBytes ?? 5 * 1024 * 1024;
  const retentionDays = options.retentionDays ?? 14;

  if (logDir) {
    mkdirSync(logDir, { recursive: true });
  }

  function pruneExpiredLogFiles(currentDate: Date) {
    if (!logDir || retentionDays < 1) {
      return;
    }

    const cutoff = new Date(currentDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - (retentionDays - 1));
    const cutoffDay = cutoff.toISOString().slice(0, 10);

    for (const fileName of readdirSync(logDir)) {
      const fileDay = parseLogFileDate(fileName);
      if (!fileDay || fileDay >= cutoffDay) {
        continue;
      }

      rmSync(path.join(logDir, fileName), { force: true });
    }
  }

  function resolveWritableLogFilePath(currentDate: Date, line: string) {
    if (!logDir) {
      return null;
    }

    pruneExpiredLogFiles(currentDate);

    for (let index = 0; index < 10_000; index += 1) {
      const filePath = buildRotatedLogFilePath(logDir, currentDate, index);
      if (!existsSync(filePath)) {
        return filePath;
      }

      if (statSync(filePath).size + Buffer.byteLength(line, 'utf8') <= maxFileSizeBytes) {
        return filePath;
      }
    }

    return buildLogFilePath(logDir, currentDate);
  }

  return {
    emit(input: ExecutionLogInput) {
      const timestamp = now();
      const debugContext = sanitizeDebugContext(input.debugContext);
      const log: ExecutionLogRecord = {
        id: nextId,
        sequence: nextId,
        runId,
        bookId: input.bookId ?? null,
        bookTitle: input.bookTitle ?? null,
        level: input.level,
        eventType: input.eventType,
        phase: input.phase ?? null,
        message: input.message,
        volumeIndex: input.volumeIndex ?? null,
        chapterIndex: input.chapterIndex ?? null,
        errorMessage: input.errorMessage ?? null,
        errorStack: input.errorStack ?? null,
        durationMs: input.durationMs ?? null,
        debugContext,
        createdAt: timestamp.toISOString(),
      };
      nextId += 1;

      if (logDir) {
        const line = `${JSON.stringify(log)}\n`;
        const filePath = resolveWritableLogFilePath(timestamp, line);
        if (filePath) {
          writeLine(filePath, line);
        }
      }

      const consoleLine = `[${log.createdAt}] ${log.level.toUpperCase()} ${log.eventType}: ${log.message}`;
      if (log.level === 'error') {
        console.error(consoleLine);
        if (log.errorMessage) {
          console.error(log.errorMessage);
        }
      } else {
        console.log(consoleLine);
      }

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
