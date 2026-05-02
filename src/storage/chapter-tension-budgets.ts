import { and, asc, eq } from 'drizzle-orm';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { createDrizzleDb } from '../db/client.js';
import { chapterTensionBudgets } from '../db/schema/index.js';
import type { ChapterTensionBudget } from '../core/narrative/types.js';

type TensionBudgetRow = Omit<ChapterTensionBudget, 'flatnessRisks'> & {
  flatnessRisksJson: string;
};

function mapBudget(row: TensionBudgetRow): ChapterTensionBudget {
  return {
    ...row,
    flatnessRisks: JSON.parse(row.flatnessRisksJson) as string[],
  };
}

export function createChapterTensionBudgetRepository(db: SqliteDatabase) {
  const drizzleDb = createDrizzleDb(db);

  function upsert(budget: ChapterTensionBudget) {
    drizzleDb
      .insert(chapterTensionBudgets)
      .values({
        ...budget,
        flatnessRisksJson: JSON.stringify(budget.flatnessRisks),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [
          chapterTensionBudgets.bookId,
          chapterTensionBudgets.volumeIndex,
          chapterTensionBudgets.chapterIndex,
        ],
        set: {
          pressureLevel: budget.pressureLevel,
          dominantTension: budget.dominantTension,
          requiredTurn: budget.requiredTurn,
          forcedChoice: budget.forcedChoice,
          costToPay: budget.costToPay,
          irreversibleChange: budget.irreversibleChange,
          readerQuestion: budget.readerQuestion,
          hookPressure: budget.hookPressure,
          flatnessRisksJson: JSON.stringify(budget.flatnessRisks),
          updatedAt: new Date().toISOString(),
        },
      })
      .run();
  }

  return {
    upsert,

    upsertMany(budgets: ChapterTensionBudget[]) {
      for (const budget of budgets) upsert(budget);
    },

    getByChapter(
      bookId: string,
      volumeIndex: number,
      chapterIndex: number
    ): ChapterTensionBudget | null {
      const row = drizzleDb
        .select({
          bookId: chapterTensionBudgets.bookId,
          volumeIndex: chapterTensionBudgets.volumeIndex,
          chapterIndex: chapterTensionBudgets.chapterIndex,
          pressureLevel: chapterTensionBudgets.pressureLevel,
          dominantTension: chapterTensionBudgets.dominantTension,
          requiredTurn: chapterTensionBudgets.requiredTurn,
          forcedChoice: chapterTensionBudgets.forcedChoice,
          costToPay: chapterTensionBudgets.costToPay,
          irreversibleChange: chapterTensionBudgets.irreversibleChange,
          readerQuestion: chapterTensionBudgets.readerQuestion,
          hookPressure: chapterTensionBudgets.hookPressure,
          flatnessRisksJson: chapterTensionBudgets.flatnessRisksJson,
        })
        .from(chapterTensionBudgets)
        .where(
          and(
            eq(chapterTensionBudgets.bookId, bookId),
            eq(chapterTensionBudgets.volumeIndex, volumeIndex),
            eq(chapterTensionBudgets.chapterIndex, chapterIndex)
          )
        )
        .get() as TensionBudgetRow | undefined;

      return row ? mapBudget(row) : null;
    },

    listByBook(bookId: string): ChapterTensionBudget[] {
      return drizzleDb
        .select({
          bookId: chapterTensionBudgets.bookId,
          volumeIndex: chapterTensionBudgets.volumeIndex,
          chapterIndex: chapterTensionBudgets.chapterIndex,
          pressureLevel: chapterTensionBudgets.pressureLevel,
          dominantTension: chapterTensionBudgets.dominantTension,
          requiredTurn: chapterTensionBudgets.requiredTurn,
          forcedChoice: chapterTensionBudgets.forcedChoice,
          costToPay: chapterTensionBudgets.costToPay,
          irreversibleChange: chapterTensionBudgets.irreversibleChange,
          readerQuestion: chapterTensionBudgets.readerQuestion,
          hookPressure: chapterTensionBudgets.hookPressure,
          flatnessRisksJson: chapterTensionBudgets.flatnessRisksJson,
        })
        .from(chapterTensionBudgets)
        .where(eq(chapterTensionBudgets.bookId, bookId))
        .orderBy(
          asc(chapterTensionBudgets.volumeIndex),
          asc(chapterTensionBudgets.chapterIndex)
        )
        .all()
        .map((row) => mapBudget(row as TensionBudgetRow));
    },

    clearByBook(bookId: string) {
      drizzleDb
        .delete(chapterTensionBudgets)
        .where(eq(chapterTensionBudgets.bookId, bookId))
        .run();
    },

    deleteByBook(bookId: string) {
      drizzleDb
        .delete(chapterTensionBudgets)
        .where(eq(chapterTensionBudgets.bookId, bookId))
        .run();
    },
  };
}
