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
        currentStage?: number | null;
        currentArc?: number | null;
        stepLabel?: string | null;
        activeTaskType?: string | null;
        errorMsg?: string | null;
        driftLevel?: 'none' | 'light' | 'medium' | 'heavy';
        lastHealthyCheckpointChapter?: number | null;
        cooldownUntil?: string | null;
        starvationScore?: number | null;
      }
    ) {
      const hasDriftLevel = Object.hasOwn(metadata ?? {}, 'driftLevel');
      const hasLastHealthyCheckpointChapter = Object.hasOwn(
        metadata ?? {},
        'lastHealthyCheckpointChapter'
      );
      const hasCooldownUntil = Object.hasOwn(metadata ?? {}, 'cooldownUntil');
      const hasStarvationScore = Object.hasOwn(metadata ?? {}, 'starvationScore');

      drizzleDb
        .insert(writingProgress)
        .values({
          bookId,
          currentVolume: metadata?.currentVolume ?? null,
          currentChapter: metadata?.currentChapter ?? null,
          currentStage: metadata?.currentStage ?? null,
          currentArc: metadata?.currentArc ?? null,
          phase,
          stepLabel: metadata?.stepLabel ?? null,
          activeTaskType: metadata?.activeTaskType ?? null,
          errorMsg: metadata?.errorMsg ?? null,
          driftLevel: metadata?.driftLevel ?? 'none',
          lastHealthyCheckpointChapter: metadata?.lastHealthyCheckpointChapter ?? null,
          cooldownUntil: metadata?.cooldownUntil ?? null,
          starvationScore: metadata?.starvationScore ?? 0,
        })
        .onConflictDoUpdate({
          target: writingProgress.bookId,
          set: {
            currentVolume: metadata?.currentVolume ?? null,
            currentChapter: metadata?.currentChapter ?? null,
            currentStage: metadata?.currentStage ?? null,
            currentArc: metadata?.currentArc ?? null,
            phase,
            stepLabel: metadata?.stepLabel ?? null,
            activeTaskType: metadata?.activeTaskType ?? null,
            errorMsg: metadata?.errorMsg ?? null,
            ...(hasDriftLevel ? { driftLevel: metadata?.driftLevel ?? 'none' } : {}),
            ...(hasLastHealthyCheckpointChapter
              ? {
                  lastHealthyCheckpointChapter:
                    metadata?.lastHealthyCheckpointChapter ?? null,
                }
              : {}),
            ...(hasCooldownUntil
              ? { cooldownUntil: metadata?.cooldownUntil ?? null }
              : {}),
            ...(hasStarvationScore
              ? { starvationScore: metadata?.starvationScore ?? 0 }
              : {}),
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
          currentStage: writingProgress.currentStage,
          currentArc: writingProgress.currentArc,
          phase: writingProgress.phase,
          stepLabel: writingProgress.stepLabel,
          activeTaskType: writingProgress.activeTaskType,
          retryCount: writingProgress.retryCount,
          errorMsg: writingProgress.errorMsg,
          driftLevel: writingProgress.driftLevel,
          lastHealthyCheckpointChapter:
            writingProgress.lastHealthyCheckpointChapter,
          cooldownUntil: writingProgress.cooldownUntil,
          starvationScore: writingProgress.starvationScore,
        })
        .from(writingProgress)
        .where(eq(writingProgress.bookId, bookId))
        .get() as
        | {
            bookId: string;
            currentVolume: number | null;
            currentChapter: number | null;
            currentStage: number | null;
            currentArc: number | null;
            phase: string | null;
            stepLabel: string | null;
            activeTaskType: string | null;
            retryCount: number;
            errorMsg: string | null;
            driftLevel: 'none' | 'light' | 'medium' | 'heavy';
            lastHealthyCheckpointChapter: number | null;
            cooldownUntil: string | null;
            starvationScore: number;
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
          currentStage: null,
          currentArc: null,
          phase,
          stepLabel: null,
          activeTaskType: null,
          retryCount: 0,
          errorMsg: null,
          driftLevel: 'none',
          lastHealthyCheckpointChapter: null,
          cooldownUntil: null,
          starvationScore: 0,
        })
        .onConflictDoUpdate({
          target: writingProgress.bookId,
          set: {
            currentVolume: null,
            currentChapter: null,
            currentStage: null,
            currentArc: null,
            phase,
            stepLabel: null,
            activeTaskType: null,
            retryCount: 0,
            errorMsg: null,
            driftLevel: 'none',
            lastHealthyCheckpointChapter: null,
            cooldownUntil: null,
            starvationScore: 0,
          },
        })
        .run();
    },

    deleteByBook(bookId: string) {
      drizzleDb.delete(writingProgress).where(eq(writingProgress.bookId, bookId)).run();
    },
  };
}
