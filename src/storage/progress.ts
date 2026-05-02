import { eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { writingProgress } from '../db/schema/index.js';

export function createProgressRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    updatePhase(
      bookId: string,
      phase: string,
      metadata?: {
        currentVolume?: number | null;
        currentChapter?: number | null;
        stepLabel?: string | null;
        errorMsg?: string | null;
      }
    ) {
      drizzleDb
        .insert(writingProgress)
        .values({
          bookId,
          currentVolume: metadata?.currentVolume ?? null,
          currentChapter: metadata?.currentChapter ?? null,
          phase,
          stepLabel: metadata?.stepLabel ?? null,
          errorMsg: metadata?.errorMsg ?? null,
        })
        .onConflictDoUpdate({
          target: writingProgress.bookId,
          set: {
            currentVolume: metadata?.currentVolume ?? null,
            currentChapter: metadata?.currentChapter ?? null,
            phase,
            stepLabel: metadata?.stepLabel ?? null,
            errorMsg: metadata?.errorMsg ?? null,
          },
        })
        .run();
    },

    getByBookId(bookId: string) {
      return drizzleDb
        .select({
          bookId: writingProgress.bookId,
          currentVolume: writingProgress.currentVolume,
          currentChapter: writingProgress.currentChapter,
          phase: writingProgress.phase,
          stepLabel: writingProgress.stepLabel,
          retryCount: writingProgress.retryCount,
          errorMsg: writingProgress.errorMsg,
        })
        .from(writingProgress)
        .where(eq(writingProgress.bookId, bookId))
        .get() as
        | {
            bookId: string;
            currentVolume: number | null;
            currentChapter: number | null;
            phase: string | null;
            stepLabel: string | null;
            retryCount: number;
            errorMsg: string | null;
          }
        | undefined;
    },

    reset(bookId: string, phase: string) {
      drizzleDb
        .insert(writingProgress)
        .values({
          bookId,
          currentVolume: null,
          currentChapter: null,
          phase,
          stepLabel: null,
          retryCount: 0,
          errorMsg: null,
        })
        .onConflictDoUpdate({
          target: writingProgress.bookId,
          set: {
            currentVolume: null,
            currentChapter: null,
            phase,
            stepLabel: null,
            retryCount: 0,
            errorMsg: null,
          },
        })
        .run();
    },

    deleteByBook(bookId: string) {
      drizzleDb.delete(writingProgress).where(eq(writingProgress.bookId, bookId)).run();
    },
  };
}
