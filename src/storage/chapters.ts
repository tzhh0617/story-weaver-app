import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import {
  chapterPlans,
  chapters,
} from '../db/schema/index.js';

export function createChapterRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  return {
    upsertOutline(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) {
      const now = new Date().toISOString();

      drizzleDb
        .insert(chapters)
        .values({
          bookId: input.bookId,
          volumeIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
          title: input.title,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [chapters.bookId, chapters.volumeIndex, chapters.chapterIndex],
          set: {
            title: input.title,
            updatedAt: now,
          },
        })
        .run();

      drizzleDb
        .insert(chapterPlans)
        .values({
          bookId: input.bookId,
          batchIndex: input.volumeIndex,
          chapterIndex: input.chapterIndex,
          arcIndex: input.volumeIndex,
          goal: input.outline,
          conflict: input.outline,
          pressureSource: input.outline,
          changeType: '',
          threadActionsJson: JSON.stringify({
            title: input.title,
            plotFunction: input.outline,
            povCharacterId: null,
            externalConflict: input.outline,
            internalConflict: input.outline,
            relationshipChange: '',
            worldRuleUsedOrTested: '',
            informationReveal: '',
            readerReward: 'truth',
            endingHook: '',
            mustChange: input.outline,
            forbiddenMoves: [],
          }),
          reveal: '',
          payoffOrCost: input.outline,
          endingHook: '',
          titleIdeaLink: '',
          batchGoal: input.title,
          requiredPayoffsJson: '["truth"]',
          forbiddenDriftJson: '[]',
          status: 'planned',
        })
        .onConflictDoUpdate({
          target: [chapterPlans.bookId, chapterPlans.chapterIndex],
          set: {
            batchIndex: input.volumeIndex,
            arcIndex: input.volumeIndex,
            goal: input.outline,
            conflict: input.outline,
            pressureSource: input.outline,
            threadActionsJson: JSON.stringify({
              title: input.title,
              plotFunction: input.outline,
              povCharacterId: null,
              externalConflict: input.outline,
              internalConflict: input.outline,
              relationshipChange: '',
              worldRuleUsedOrTested: '',
              informationReveal: '',
              readerReward: 'truth',
              endingHook: '',
              mustChange: input.outline,
              forbiddenMoves: [],
            }),
            payoffOrCost: input.outline,
            batchGoal: input.title,
          },
        })
        .run();
    },

    upsertPlanned(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      title: string;
      outline: string;
    }) {
      this.upsertOutline(input);
    },

    listByBook(bookId: string) {
      return drizzleDb
        .select({
          bookId: chapters.bookId,
          volumeIndex: chapters.volumeIndex,
          chapterIndex: chapters.chapterIndex,
          title: chapters.title,
          outline: sql<string | null>`(
            SELECT json_extract(${chapterPlans.threadActionsJson}, '$.plotFunction')
            FROM ${chapterPlans}
            WHERE ${chapterPlans.bookId} = ${chapters.bookId}
              AND ${chapterPlans.batchIndex} = ${chapters.volumeIndex}
              AND ${chapterPlans.chapterIndex} = ${chapters.chapterIndex}
          )`,
          content: chapters.content,
          summary: chapters.summary,
          wordCount: chapters.wordCount,
          auditScore: chapters.auditScore,
          draftAttempts: chapters.draftAttempts,
        })
        .from(chapters)
        .where(eq(chapters.bookId, bookId))
        .orderBy(chapters.volumeIndex, chapters.chapterIndex)
        .all() as Array<{
        bookId: string;
        volumeIndex: number;
        chapterIndex: number;
        title: string | null;
        outline: string | null;
        content: string | null;
        summary: string | null;
        wordCount: number;
        auditScore: number | null;
        draftAttempts: number;
      }>;
    },

    listProgressByBookIds(bookIds: string[]) {
      if (!bookIds.length) {
        return new Map<
          string,
          { completedChapters: number; totalChapters: number }
        >();
      }

      const rows = drizzleDb
        .select({
          bookId: chapters.bookId,
          totalChapters: sql<number>`COUNT(*)`,
          completedChapters:
            sql<number | null>`SUM(CASE WHEN ${chapters.content} IS NOT NULL AND ${chapters.content} != '' THEN 1 ELSE 0 END)`,
        })
        .from(chapters)
        .where(inArray(chapters.bookId, bookIds))
        .groupBy(chapters.bookId)
        .all() as Array<{
        bookId: string;
        completedChapters: number | null;
        totalChapters: number;
      }>;

      return new Map(
        rows.map((row) => [
          row.bookId,
          {
            completedChapters: row.completedChapters ?? 0,
            totalChapters: row.totalChapters,
          },
        ])
      );
    },

    saveContent(input: {
      bookId: string;
      volumeIndex: number;
      chapterIndex: number;
      content: string;
      summary?: string | null;
      wordCount: number;
      auditScore?: number | null;
      draftAttempts?: number;
    }) {
      const existing = drizzleDb
        .select({
          auditScore: chapters.auditScore,
          draftAttempts: chapters.draftAttempts,
        })
        .from(chapters)
        .where(
          and(
            eq(chapters.bookId, input.bookId),
            eq(chapters.volumeIndex, input.volumeIndex),
            eq(chapters.chapterIndex, input.chapterIndex)
          )
        )
        .get();

      drizzleDb
        .update(chapters)
        .set({
          content: input.content,
          summary: input.summary ?? null,
          wordCount: input.wordCount,
          auditScore: input.auditScore ?? existing?.auditScore ?? null,
          draftAttempts: input.draftAttempts ?? existing?.draftAttempts ?? 0,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(chapters.bookId, input.bookId),
            eq(chapters.volumeIndex, input.volumeIndex),
            eq(chapters.chapterIndex, input.chapterIndex)
          )
        )
        .run();
    },

    clearGeneratedContent(bookId: string) {
      drizzleDb
        .update(chapters)
        .set({
          content: null,
          summary: null,
          wordCount: 0,
          auditScore: null,
          draftAttempts: 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(chapters.bookId, bookId))
        .run();
    },

    deleteByBook(bookId: string) {
      drizzleDb.delete(chapters).where(eq(chapters.bookId, bookId)).run();
    },
  };
}
